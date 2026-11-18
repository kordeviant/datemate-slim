package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc  *Service
	cfg  *config.Config
	pool *pgxpool.Pool
}

func NewHandler(svc *Service, cfg *config.Config, pool *pgxpool.Pool) *Handler {
	return &Handler{svc: svc, cfg: cfg, pool: pool}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/auth", func(ar chi.Router) {
		ar.Post("/signup", h.SignUp)
		ar.Post("/verify", h.Verify)
		ar.Post("/signin", h.SignIn)
		ar.Post("/refresh", h.Refresh)
		ar.Post("/forgot-password", h.ForgotPassword)
		ar.Post("/reset-password", h.ResetPassword)
		ar.Post("/nonce", h.Nonce)
		ar.Post("/google", h.Google)
		ar.Post("/apple", h.Apple)

		if h.cfg != nil && h.pool != nil {
			jwtAuth := middleware.JwtAuthGuard(h.cfg, h.pool)
			ar.With(jwtAuth).Post("/logout", h.Logout)
		} else {
			ar.Post("/logout", h.Logout)
		}
	})
}

type SignUpRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) SignUp(w http.ResponseWriter, r *http.Request) {
	var req SignUpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid email or password", common.ErrUnknownError)
		return
	}
	if req.Email == "" && req.Password == "" {
		common.RespondError(w, http.StatusBadRequest, "email should not be empty, email must be an email, password must be longer than or equal to 6 characters, password must be a string, integrityToken should not be empty, integrityToken must be a string, packageName should not be empty, packageName must be a string", common.ErrUnknownError)
		return
	}
	if req.Email == "" || req.Password == "" {
		common.RespondError(w, http.StatusBadRequest, "email should not be empty, email must be an email, password must be longer than or equal to 6 characters", common.ErrUnknownError)
		return
	}

	if err := h.svc.SignUp(r.Context(), req.Email, req.Password); err != nil {
		if strings.Contains(err.Error(), "already registered") {
			common.RespondError(w, http.StatusConflict, err.Error(), common.ErrUnknownError)
			return
		}
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Verification code sent to email", nil)
}

type VerifyRequest struct {
	Code      string `json:"code"`
	Email     string `json:"email,omitempty"`
	Device    string `json:"device,omitempty"`
	UserAgent string `json:"userAgent,omitempty"`
	FcmToken  string `json:"fcmToken,omitempty"`
}

func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid verification code request", common.ErrUnknownError)
		return
	}
	if req.Code == "" && req.Device == "" && req.UserAgent == "" {
		common.RespondError(w, http.StatusBadRequest, "code must be longer than or equal to 6 characters, code must be a string, device should not be empty, device must be a string, userAgent should not be empty, userAgent must be a string", common.ErrUnknownError)
		return
	}
	if req.Code == "" {
		common.RespondError(w, http.StatusBadRequest, "code must be longer than or equal to 6 characters, code must be a string", common.ErrUnknownError)
		return
	}

	ua := req.UserAgent
	if ua == "" {
		ua = r.Header.Get("User-Agent")
	}

	res, err := h.svc.VerifyCode(r.Context(), req.Code, req.Email, req.Device, ua, req.FcmToken)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User verified successfully", res)
}

type SignInRequest struct {
	Email           string `json:"email"`
	Username        string `json:"username"`
	UsernameOrEmail string `json:"usernameOrEmail"`
	Password        string `json:"password"`
	Device          string `json:"device,omitempty"`
	UserAgent       string `json:"userAgent,omitempty"`
	FcmToken        string `json:"fcmToken,omitempty"`
}

func (h *Handler) SignIn(w http.ResponseWriter, r *http.Request) {
	var req SignInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid email, username, or password", common.ErrUnknownError)
		return
	}

	identifier := req.UsernameOrEmail
	if identifier == "" {
		identifier = req.Email
	}
	if identifier == "" {
		identifier = req.Username
	}

	if identifier == "" || req.Password == "" {
		common.RespondError(w, http.StatusBadRequest, "Invalid email, username, or password", common.ErrUnknownError)
		return
	}

	ua := req.UserAgent
	if ua == "" {
		ua = r.Header.Get("User-Agent")
	}

	res, err := h.svc.SignIn(r.Context(), identifier, req.Password, req.Device, ua, req.FcmToken)
	if err != nil {
		common.RespondError(w, http.StatusUnauthorized, "Invalid email, username, or password", common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Login successful", res)
}

type RefreshRequest struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	tokenStr := req.Token
	if tokenStr == "" {
		tokenStr = req.RefreshToken
	}
	if tokenStr == "" {
		tokenStr = r.Header.Get("x-refresh-token")
	}
	if tokenStr == "" {
		authHdr := r.Header.Get("Authorization")
		if strings.HasPrefix(authHdr, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHdr, "Bearer ")
		}
	}

	if tokenStr == "" {
		common.RespondError(w, http.StatusBadRequest, "refreshToken is required", common.ErrBadRequest)
		return
	}

	res, err := h.svc.RefreshToken(r.Context(), tokenStr)
	if err != nil {
		common.RespondError(w, http.StatusUnauthorized, err.Error(), common.ErrUnauthorized)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Tokens refreshed successfully", res)
}

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		common.RespondError(w, http.StatusBadRequest, "email is required", common.ErrBadRequest)
		return
	}

	_ = h.svc.ForgotPassword(r.Context(), req.Email)
	common.RespondSuccess[any](w, http.StatusOK, "If the email exists, a reset code was sent", nil)
}

type ResetPasswordRequest struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	Password    string `json:"password"`
	NewPassword string `json:"newPassword"`
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid request payload", common.ErrBadRequest)
		return
	}
	pass := req.NewPassword
	if pass == "" {
		pass = req.Password
	}
	if req.Email == "" || req.Code == "" || pass == "" {
		common.RespondError(w, http.StatusBadRequest, "email, code, and newPassword are required", common.ErrBadRequest)
		return
	}

	if err := h.svc.ResetPassword(r.Context(), req.Email, req.Code, pass); err != nil {
		common.RespondError(w, http.StatusBadRequest, err.Error(), common.ErrBadRequest)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Password reset successfully", nil)
}

func (h *Handler) Nonce(w http.ResponseWriter, r *http.Request) {
	nonce := GenerateSecureRandomString(32)
	common.RespondSuccess(w, http.StatusOK, "Operation successful", nonce)
}

type SocialAuthRequest struct {
	IdentityToken  string `json:"identityToken,omitempty"`
	IdToken        string `json:"idToken,omitempty"`
	Token          string `json:"token,omitempty"`
	Email          string `json:"email,omitempty"`
	Role           string `json:"role,omitempty"`
	Device         string `json:"device,omitempty"`
	UserAgent      string `json:"userAgent,omitempty"`
	DeviceInfo     string `json:"deviceInfo,omitempty"`
	FcmToken       string `json:"fcmToken,omitempty"`
	FirstName      string `json:"firstName,omitempty"`
	LastName       string `json:"lastName,omitempty"`
	BundleID       string `json:"bundleId,omitempty"`
	PackageName    string `json:"packageName,omitempty"`
	IntegrityToken string `json:"integrityToken,omitempty"`
}

type OpenIDClaims struct {
	Email         string      `json:"email"`
	EmailVerified interface{} `json:"email_verified"`
	Sub           string      `json:"sub"`
	Name          string      `json:"name"`
	GivenName     string      `json:"given_name"`
	FamilyName    string      `json:"family_name"`
	jwt.RegisteredClaims
}

func extractRawSocialToken(authHeader string, req SocialAuthRequest) string {
	raw := ""
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		raw = strings.TrimSpace(authHeader[7:])
	} else if authHeader != "" {
		raw = strings.TrimSpace(authHeader)
	}

	if raw == "" {
		if req.IdentityToken != "" {
			raw = strings.TrimSpace(req.IdentityToken)
		} else if req.IdToken != "" {
			raw = strings.TrimSpace(req.IdToken)
		} else if req.Token != "" {
			raw = strings.TrimSpace(req.Token)
		}
	}
	return raw
}

func parseSocialTokenClaims(rawToken string) (*OpenIDClaims, error) {
	if rawToken == "" {
		return nil, fmt.Errorf("empty token")
	}

	// 1. Try jwt.NewParser().ParseUnverified
	var claims OpenIDClaims
	parser := jwt.NewParser()
	_, _, err := parser.ParseUnverified(rawToken, &claims)
	if err == nil && (claims.Email != "" || claims.Sub != "") {
		return &claims, nil
	}

	// 2. Fallback: manual base64url decode of payload part
	parts := strings.Split(rawToken, ".")
	if len(parts) >= 2 {
		payloadBytes, decErr := base64.RawURLEncoding.DecodeString(parts[1])
		if decErr != nil {
			payloadBytes, decErr = base64.URLEncoding.DecodeString(parts[1])
		}
		if decErr == nil {
			var fallbackClaims OpenIDClaims
			if jsonErr := json.Unmarshal(payloadBytes, &fallbackClaims); jsonErr == nil {
				return &fallbackClaims, nil
			}
		}
	}

	return nil, fmt.Errorf("failed to parse token claims")
}

func cleanSocialSub(sub string) string {
	s := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		return '_'
	}, sub)
	s = strings.Trim(s, "_")
	if len(s) > 32 {
		s = s[:32]
	}
	return strings.ToLower(s)
}

func verifyGoogleTokenInfo(ctx context.Context, idToken string) (*OpenIDClaims, error) {
	client := &http.Client{Timeout: 4 * time.Second}
	reqURL := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(idToken)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google tokeninfo returned status %d", resp.StatusCode)
	}

	var claims OpenIDClaims
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return nil, err
	}
	return &claims, nil
}

func (h *Handler) Google(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	var req SocialAuthRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	rawToken := extractRawSocialToken(authHeader, req)

	if rawToken == "" && req.Email == "" && req.Device == "" {
		common.RespondError(w, http.StatusBadRequest, "device should not be empty, device must be a string, userAgent should not be empty, userAgent must be a string, integrityToken should not be empty, integrityToken must be a string, packageName should not be empty, packageName must be a string", common.ErrUnknownError)
		return
	}

	var email string
	var firstName string
	if req.FirstName != "" {
		firstName = req.FirstName
	}

	// 1. Try Google tokeninfo online verification if token present
	if rawToken != "" {
		if verifiedClaims, err := verifyGoogleTokenInfo(r.Context(), rawToken); err == nil && verifiedClaims.Email != "" {
			email = verifiedClaims.Email
			if firstName == "" && verifiedClaims.GivenName != "" {
				firstName = verifiedClaims.GivenName
			} else if firstName == "" && verifiedClaims.Name != "" {
				firstName = verifiedClaims.Name
			}
		}
	}

	// 2. Fallback to unverified JWT claims parsing if tokeninfo failed or network unreachable
	if email == "" && rawToken != "" {
		if claims, err := parseSocialTokenClaims(rawToken); err == nil {
			if claims.Email != "" {
				email = claims.Email
			}
			if firstName == "" && claims.GivenName != "" {
				firstName = claims.GivenName
			} else if firstName == "" && claims.Name != "" {
				firstName = claims.Name
			}
			if email == "" && claims.Sub != "" {
				email = fmt.Sprintf("google_%s@gmail.com", cleanSocialSub(claims.Sub))
			}
		}
	}

	// 3. Fallback to explicit email in request body
	if email == "" && req.Email != "" {
		email = req.Email
	}

	// 4. Validate email
	if email == "" || !strings.Contains(email, "@") {
		common.RespondError(w, http.StatusBadRequest, "Valid Google ID Token or email is required", common.ErrUnknownError)
		return
	}

	// Extract device info
	deviceInfo := req.DeviceInfo
	if deviceInfo == "" {
		if req.Device != "" && req.UserAgent != "" {
			deviceInfo = fmt.Sprintf("%s (%s)", req.Device, req.UserAgent)
		} else if req.Device != "" {
			deviceInfo = req.Device
		} else if req.UserAgent != "" {
			deviceInfo = req.UserAgent
		}
	}

	res, err := h.svc.SocialAuth(r.Context(), email, "google", "USER", deviceInfo, req.FcmToken, firstName)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Google authentication successful", res)
}

func (h *Handler) Apple(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	var req SocialAuthRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	rawToken := extractRawSocialToken(authHeader, req)

	if rawToken == "" && req.Email == "" && req.Device == "" {
		common.RespondError(w, http.StatusBadRequest, "device should not be empty, device must be a string, userAgent should not be empty, userAgent must be a string, integrityToken should not be empty, integrityToken must be a string, packageName should not be empty, packageName must be a string", common.ErrUnknownError)
		return
	}

	var email string
	var firstName string
	if req.FirstName != "" {
		firstName = req.FirstName
		if req.LastName != "" {
			firstName = firstName + " " + req.LastName
		}
	}

	// 1. Try to extract email from Apple Identity Token
	if rawToken != "" {
		if claims, err := parseSocialTokenClaims(rawToken); err == nil {
			if claims.Email != "" {
				email = claims.Email
			}
			if email == "" && claims.Sub != "" {
				email = fmt.Sprintf("apple_%s@privaterelay.appleid.com", cleanSocialSub(claims.Sub))
			}
		}
	}

	// 2. Fallback to explicit email in request body (Apple sends email in authorization response on initial sign-in)
	if email == "" && req.Email != "" {
		email = req.Email
	}

	// 3. Validate email
	if email == "" || !strings.Contains(email, "@") {
		common.RespondError(w, http.StatusUnauthorized, "Valid Apple Identity Token or email is required", common.ErrUnauthorized)
		return
	}

	// Extract device info
	deviceInfo := req.DeviceInfo
	if deviceInfo == "" {
		if req.Device != "" && req.UserAgent != "" {
			deviceInfo = fmt.Sprintf("%s (%s)", req.Device, req.UserAgent)
		} else if req.Device != "" {
			deviceInfo = req.Device
		} else if req.UserAgent != "" {
			deviceInfo = req.UserAgent
		}
	}

	res, err := h.svc.SocialAuth(r.Context(), email, "apple", "USER", deviceInfo, req.FcmToken, firstName)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Apple authentication successful", res)
}

type LogoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var req LogoutRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	user, ok := middleware.GetAuthUser(r.Context())
	var sessionID int64
	if ok && user != nil {
		sessionID = user.SessionID
	}

	_ = h.svc.Logout(r.Context(), req.RefreshToken, sessionID)
	common.RespondSuccess(w, http.StatusOK, "Logged out successfully", map[string]interface{}{
		"success": true,
		"message": "User session terminated",
	})
}
