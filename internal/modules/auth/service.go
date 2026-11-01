package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"datemate/internal/config"
	"datemate/internal/platform/database/db"
	"datemate/internal/platform/mail"
	platformRedis "datemate/internal/platform/redis"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthResult struct {
	Access  string `json:"access"`
	Refresh string `json:"refresh"`
	UserID  int64  `json:"userId"`
	Role    string `json:"role"`
}

type Service struct {
	cfg     *config.Config
	pool    *pgxpool.Pool
	queries *db.Queries
	rdb     *platformRedis.Client
	mailer  mail.Mailer
}

func NewService(cfg *config.Config, pool *pgxpool.Pool, rdb *platformRedis.Client, mailer mail.Mailer) *Service {
	return &Service{
		cfg:     cfg,
		pool:    pool,
		queries: db.New(pool),
		rdb:     rdb,
		mailer:  mailer,
	}
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func HashRefreshToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func GenerateSecureRandomString(length int) string {
	bytes := make([]byte, length)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func GenerateOTP(digits int) string {
	max := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits)), nil)
	n, _ := rand.Int(rand.Reader, max)
	return fmt.Sprintf("%0*d", digits, n.Int64())
}

func (s *Service) GenerateTokens(ctx context.Context, userID int64, email, role, deviceInfo, fcmToken string) (*AuthResult, error) {
	accessDuration, err := time.ParseDuration(s.cfg.JWTAccessExpiresIn)
	if err != nil {
		accessDuration = 15 * time.Minute
	}
	refreshDuration, err := time.ParseDuration(s.cfg.JWTRefreshExpiresIn)
	if err != nil {
		refreshDuration = 30 * 24 * time.Hour
	}

	rawRefreshToken := GenerateSecureRandomString(32)
	refreshHash := HashRefreshToken(rawRefreshToken)

	session, err := s.queries.CreateUserSession(ctx, db.CreateUserSessionParams{
		UserID:           int32(userID),
		RefreshTokenHash: refreshHash,
		DeviceInfo:       pgtype.Text{String: deviceInfo, Valid: deviceInfo != ""},
		FcmToken:         pgtype.Text{String: fcmToken, Valid: fcmToken != ""},
		ExpiresAt:        pgtype.Timestamp{Time: time.Now().Add(refreshDuration), Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	claims := jwt.MapClaims{
		"sub":       userID,
		"email":     email,
		"role":      role,
		"sessionId": session.ID,
		"iat":       time.Now().Unix(),
		"exp":       time.Now().Add(accessDuration).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString([]byte(s.cfg.JWTAccessSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	return &AuthResult{
		Access:  accessToken,
		Refresh: rawRefreshToken,
		UserID:  userID,
		Role:    role,
	}, nil
}

func (s *Service) SignUp(ctx context.Context, email, password string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	_, err := s.queries.GetUserByEmail(ctx, email)
	if err == nil {
		return errors.New("Email already registered")
	}

	code := GenerateOTP(6)
	pwdHash, err := HashPassword(password)
	if err != nil {
		return err
	}

	key := fmt.Sprintf("otp:signup:%s", email)
	val := fmt.Sprintf("%s|%s", code, pwdHash)
	if err := s.rdb.Raw().Set(ctx, key, val, 10*time.Minute).Err(); err != nil {
		return fmt.Errorf("failed to save OTP: %w", err)
	}

	_ = s.mailer.SendEmail(ctx, email, "DateMate Verification Code", fmt.Sprintf("Your DateMate verification code is: %s", code))
	return nil
}

func (s *Service) VerifyCode(ctx context.Context, email, code string) (*AuthResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	key := fmt.Sprintf("otp:signup:%s", email)
	val, err := s.rdb.Raw().Get(ctx, key).Result()
	if err != nil {
		return nil, errors.New("Invalid or expired verification code")
	}

	parts := strings.Split(val, "|")
	if len(parts) != 2 || parts[0] != code {
		return nil, errors.New("Invalid or expired verification code")
	}
	passwordHash := parts[1]

	user, err := s.queries.CreateUser(ctx, db.CreateUserParams{
		Email:            email,
		PasswordHash:     passwordHash,
		Role:             db.RoleUSER,
		Language:         db.LanguageEN,
		ProfileValidated: false,
		IsPremium:        false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	_ = s.rdb.Raw().Del(ctx, key).Err()

	// Initialize basic profile and demographic
	_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
		UserID:    user.ID,
		FirstName: "User",
		AvatarUrl: "",
		Latitude:  pgtype.Numeric{Valid: true},
		Longitude: pgtype.Numeric{Valid: true},
	})
	_, _ = s.queries.UpsertDemographic(ctx, db.UpsertDemographicParams{
		UserID:    user.ID,
		BirthDate: pgtype.Date{Time: time.Now().AddDate(-25, 0, 0), Valid: true},
		Gender:    db.GenderMALE,
	})

	return s.GenerateTokens(ctx, int64(user.ID), user.Email, string(user.Role), "", "")
}

func (s *Service) SignIn(ctx context.Context, email, password string) (*AuthResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, errors.New("Invalid credentials")
	}

	if !CheckPassword(password, user.PasswordHash) {
		return nil, errors.New("Invalid credentials")
	}

	if user.BannedUntil.Valid && user.BannedUntil.Time.After(time.Now()) {
		return nil, errors.New("User account is banned")
	}

	return s.GenerateTokens(ctx, int64(user.ID), user.Email, string(user.Role), "", "")
}

func (s *Service) RefreshToken(ctx context.Context, rawRefreshToken string) (*AuthResult, error) {
	hash := HashRefreshToken(rawRefreshToken)
	session, err := s.queries.GetUserSessionByTokenHash(ctx, hash)
	if err != nil {
		return nil, errors.New("Invalid or expired refresh token")
	}

	if session.ExpiresAt.Valid && session.ExpiresAt.Time.Before(time.Now()) {
		_ = s.queries.DeleteUserSession(ctx, session.ID)
		return nil, errors.New("Refresh token expired")
	}

	user, err := s.queries.GetUserByID(ctx, session.UserID)
	if err != nil {
		return nil, errors.New("User not found")
	}

	// Delete used session (rotation)
	_ = s.queries.DeleteUserSession(ctx, session.ID)

	deviceInfo := ""
	if session.DeviceInfo.Valid {
		deviceInfo = session.DeviceInfo.String
	}
	fcmToken := ""
	if session.FcmToken.Valid {
		fcmToken = session.FcmToken.String
	}

	return s.GenerateTokens(ctx, int64(user.ID), user.Email, string(user.Role), deviceInfo, fcmToken)
}

func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		// Return success silently for security
		return nil
	}

	code := GenerateOTP(6)
	key := fmt.Sprintf("otp:reset:%s", email)
	_ = s.rdb.Raw().Set(ctx, key, code, 10*time.Minute).Err()
	_ = s.mailer.SendEmail(ctx, user.Email, "DateMate Password Reset", fmt.Sprintf("Your reset code is: %s", code))
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, email, code, newPassword string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	key := fmt.Sprintf("otp:reset:%s", email)
	savedCode, err := s.rdb.Raw().Get(ctx, key).Result()
	if err != nil || savedCode != code {
		return errors.New("Invalid or expired reset code")
	}

	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		return errors.New("User not found")
	}

	newHash, err := HashPassword(newPassword)
	if err != nil {
		return err
	}

	_ = s.queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: newHash,
	})
	_ = s.queries.DeleteUserSessionsByUserID(ctx, user.ID)
	_ = s.rdb.Raw().Del(ctx, key).Err()

	return nil
}

func (s *Service) Logout(ctx context.Context, rawRefreshToken string, currentSessionID int64) error {
	if rawRefreshToken != "" {
		hash := HashRefreshToken(rawRefreshToken)
		_ = s.queries.DeleteUserSessionByTokenHash(ctx, hash)
	}
	if currentSessionID > 0 {
		_ = s.queries.DeleteUserSession(ctx, int32(currentSessionID))
	}
	return nil
}

func (s *Service) SocialAuthMock(ctx context.Context, email, provider, role string) (*AuthResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		// Create new user
		randomPwd := GenerateSecureRandomString(16)
		pwdHash, _ := HashPassword(randomPwd)
		user, err = s.queries.CreateUser(ctx, db.CreateUserParams{
			Email:            email,
			PasswordHash:     pwdHash,
			Role:             db.RoleUSER,
			Language:         db.LanguageEN,
			ProfileValidated: false,
			IsPremium:        false,
		})
		if err != nil {
			return nil, err
		}

		_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
			UserID:    user.ID,
			FirstName: strings.Title(strings.Split(email, "@")[0]),
			AvatarUrl: "",
			Latitude:  pgtype.Numeric{Valid: true},
			Longitude: pgtype.Numeric{Valid: true},
		})
		_, _ = s.queries.UpsertDemographic(ctx, db.UpsertDemographicParams{
			UserID:    user.ID,
			BirthDate: pgtype.Date{Time: time.Now().AddDate(-24, 0, 0), Valid: true},
			Gender:    db.GenderMALE,
		})
	}

	return s.GenerateTokens(ctx, int64(user.ID), user.Email, string(user.Role), "", "")
}
