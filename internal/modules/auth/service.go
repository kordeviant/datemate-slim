package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
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
		"sub":       fmt.Sprintf("%d", userID),
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
	_ = s.rdb.Raw().Set(ctx, key, val, 10*time.Minute).Err()

	pendingPayload, _ := json.Marshal(map[string]string{
		"email":        email,
		"passwordHash": pwdHash,
		"code":         code,
	})
	_ = s.rdb.Raw().Set(ctx, fmt.Sprintf("signup:pending:%s", email), string(pendingPayload), 10*time.Minute).Err()
	_ = s.rdb.Raw().Set(ctx, fmt.Sprintf("signup:code:%s", code), email, 10*time.Minute).Err()

	log.Printf("[AUTH] Verification OTP code generated for %s: %s", email, code)
	emailBody := mail.FormatVerificationEmail(code)
	if err := s.mailer.SendEmail(ctx, email, "DateMate Verification Code", emailBody); err != nil {
		log.Printf("[ERROR auth SignUp] Failed to deliver verification email to %s: %v", email, err)
	}
	return nil
}

func (s *Service) VerifyCode(ctx context.Context, code, email, device, userAgent, fcmToken string) (*AuthResult, error) {
	code = strings.TrimSpace(code)
	email = strings.ToLower(strings.TrimSpace(email))

	var passwordHash string

	// 1. Try finding email via signup:code:<code> if email wasn't provided
	if email == "" {
		storedEmail, err := s.rdb.Raw().Get(ctx, fmt.Sprintf("signup:code:%s", code)).Result()
		if err == nil && storedEmail != "" {
			email = strings.ToLower(strings.TrimSpace(storedEmail))
		}
	}

	// 2. Try loading signup:pending:<email>
	if email != "" {
		pendingRaw, err := s.rdb.Raw().Get(ctx, fmt.Sprintf("signup:pending:%s", email)).Result()
		if err == nil && pendingRaw != "" {
			var pendingData struct {
				Email        string `json:"email"`
				PasswordHash string `json:"passwordHash"`
				Code         string `json:"code"`
			}
			if err := json.Unmarshal([]byte(pendingRaw), &pendingData); err == nil && pendingData.Code == code {
				passwordHash = pendingData.PasswordHash
				if pendingData.Email != "" {
					email = strings.ToLower(strings.TrimSpace(pendingData.Email))
				}
			}
		}
	}

	// 3. Fallback to otp:signup:<email>
	if passwordHash == "" && email != "" {
		key := fmt.Sprintf("otp:signup:%s", email)
		val, err := s.rdb.Raw().Get(ctx, key).Result()
		if err == nil {
			parts := strings.Split(val, "|")
			if len(parts) == 2 && parts[0] == code {
				passwordHash = parts[1]
			}
		}
	}

	if passwordHash == "" || email == "" {
		return nil, errors.New("Invalid or expired verification code")
	}

	if _, err := s.queries.GetUserByEmail(ctx, email); err == nil {
		_ = s.rdb.Raw().Del(ctx, fmt.Sprintf("signup:code:%s", code)).Err()
		_ = s.rdb.Raw().Del(ctx, fmt.Sprintf("signup:pending:%s", email)).Err()
		_ = s.rdb.Raw().Del(ctx, fmt.Sprintf("otp:signup:%s", email)).Err()
		return nil, errors.New("Email already registered")
	}

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

	_ = s.rdb.Raw().Del(ctx, fmt.Sprintf("signup:code:%s", code)).Err()
	_ = s.rdb.Raw().Del(ctx, fmt.Sprintf("signup:pending:%s", email)).Err()
	_ = s.rdb.Raw().Del(ctx, fmt.Sprintf("otp:signup:%s", email)).Err()

	// Initialize basic profile without placeholder demographic values
	var zeroNumeric pgtype.Numeric
	_ = zeroNumeric.Scan("0")
	_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
		UserID:    user.ID,
		FirstName: "",
		AvatarUrl: "",
		Latitude:  zeroNumeric,
		Longitude: zeroNumeric,
	})

	deviceInfo := ""
	if device != "" && userAgent != "" {
		deviceInfo = fmt.Sprintf("%s (%s)", device, userAgent)
	} else if device != "" {
		deviceInfo = device
	} else if userAgent != "" {
		deviceInfo = userAgent
	}

	return s.GenerateTokens(ctx, int64(user.ID), user.Email, string(user.Role), deviceInfo, fcmToken)
}

func (s *Service) SignIn(ctx context.Context, identifier, password, device, userAgent, fcmToken string) (*AuthResult, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" || password == "" {
		return nil, errors.New("Username or email and password are required")
	}

	user, err := s.queries.GetUserByEmailOrUsername(ctx, identifier)
	if err != nil {
		return nil, errors.New("Invalid credentials")
	}

	if !CheckPassword(password, user.PasswordHash) {
		return nil, errors.New("Invalid credentials")
	}

	if user.BannedUntil.Valid && user.BannedUntil.Time.After(time.Now()) {
		return nil, errors.New("User account is banned")
	}

	deviceInfo := "Web Browser"
	if device != "" && userAgent != "" {
		deviceInfo = fmt.Sprintf("%s (%s)", device, userAgent)
	} else if device != "" {
		deviceInfo = device
	} else if userAgent != "" {
		deviceInfo = userAgent
	}

	return s.GenerateTokens(ctx, int64(user.ID), user.Email, string(user.Role), deviceInfo, fcmToken)
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
	log.Printf("[AUTH] Password reset OTP code generated for %s: %s", email, code)
	emailBody := mail.FormatPasswordResetEmail(code)
	if err := s.mailer.SendEmail(ctx, user.Email, "DateMate Password Reset", emailBody); err != nil {
		log.Printf("[ERROR auth ForgotPassword] Failed to deliver password reset email to %s: %v", user.Email, err)
	}
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

func (s *Service) SocialAuth(ctx context.Context, email, provider, role, deviceInfo, fcmToken, firstName string) (*AuthResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, errors.New("email is required for social authentication")
	}

	user, err := s.queries.GetUserByEmail(ctx, email)
	isNew := false
	if err != nil {
		// Create new user
		randomPwd := GenerateSecureRandomString(16)
		pwdHash, _ := HashPassword(randomPwd)
		userRole := db.RoleUSER
		if strings.EqualFold(role, "ADMIN") {
			userRole = db.RoleADMIN
		}
		user, err = s.queries.CreateUser(ctx, db.CreateUserParams{
			Email:            email,
			PasswordHash:     pwdHash,
			Role:             userRole,
			Language:         db.LanguageEN,
			ProfileValidated: false,
			IsPremium:        false,
		})
		if err != nil {
			return nil, err
		}
		isNew = true

		var zeroNumeric pgtype.Numeric
		_ = zeroNumeric.Scan("0")
		_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
			UserID:    user.ID,
			FirstName: strings.TrimSpace(firstName),
			AvatarUrl: "",
			Latitude:  zeroNumeric,
			Longitude: zeroNumeric,
		})
	} else if firstName != "" {
		if existingProf, pErr := s.queries.GetProfileByUserID(ctx, user.ID); pErr == nil && existingProf.FirstName == "" {
			var zeroNumeric pgtype.Numeric
			_ = zeroNumeric.Scan("0")
			lat := zeroNumeric
			lon := zeroNumeric
			if existingProf.Latitude.Valid {
				lat = existingProf.Latitude
			}
			if existingProf.Longitude.Valid {
				lon = existingProf.Longitude
			}
			_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
				UserID:    user.ID,
				FirstName: strings.TrimSpace(firstName),
				AvatarUrl: existingProf.AvatarUrl,
				Latitude:  lat,
				Longitude: lon,
			})
		}
	}

	_ = isNew
	return s.GenerateTokens(ctx, int64(user.ID), user.Email, string(user.Role), deviceInfo, fcmToken)
}

func (s *Service) SocialAuthMock(ctx context.Context, email, provider, role, fullName string) (*AuthResult, error) {
	return s.SocialAuth(ctx, email, provider, role, "", "", fullName)
}
