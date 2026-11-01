package auth

import (
	"encoding/json"
	"net/http"
	"strings"

	"datemate/internal/common"
	"datemate/internal/middleware"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/signup", h.SignUp)
	r.Post("/verify", h.Verify)
	r.Post("/signin", h.SignIn)
	r.Post("/refresh", h.Refresh)
	r.Post("/forgot-password", h.ForgotPassword)
	r.Post("/reset-password", h.ResetPassword)
	r.Post("/nonce", h.Nonce)
	r.Post("/google", h.Google)
	r.Post("/apple", h.Apple)
	r.Post("/logout", h.Logout)
}

type SignUpRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) SignUp(w http.ResponseWriter, r *http.Request) {
	var req SignUpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || req.Password == "" {
		common.RespondError(w, http.StatusBadRequest, "Invalid email or password", common.ErrBadRequest)
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
	Email string `json:"email"`
	Code  string `json:"code"`
}

func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || req.Code == "" {
		common.RespondError(w, http.StatusBadRequest, "Invalid verification code request", common.ErrBadRequest)
		return
	}

	res, err := h.svc.VerifyCode(r.Context(), req.Email, req.Code)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, err.Error(), common.ErrBadRequest)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User verified successfully", res)
}

type SignInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) SignIn(w http.ResponseWriter, r *http.Request) {
	var req SignInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || req.Password == "" {
		common.RespondError(w, http.StatusBadRequest, "Email and password are required", common.ErrBadRequest)
		return
	}

	res, err := h.svc.SignIn(r.Context(), req.Email, req.Password)
	if err != nil {
		common.RespondError(w, http.StatusUnauthorized, err.Error(), common.ErrUnauthorized)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Login successful", res)
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		common.RespondError(w, http.StatusBadRequest, "refreshToken is required", common.ErrBadRequest)
		return
	}

	res, err := h.svc.RefreshToken(r.Context(), req.RefreshToken)
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
	NewPassword string `json:"newPassword"`
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || req.Code == "" || req.NewPassword == "" {
		common.RespondError(w, http.StatusBadRequest, "email, code, and newPassword are required", common.ErrBadRequest)
		return
	}

	if err := h.svc.ResetPassword(r.Context(), req.Email, req.Code, req.NewPassword); err != nil {
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
	IdentityToken string `json:"identityToken,omitempty"`
	Email         string `json:"email,omitempty"`
	Role          string `json:"role,omitempty"`
}

func (h *Handler) Google(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	var req SocialAuthRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	email := req.Email
	if email == "" {
		email = "google_user@example.com"
	}
	if authHeader == "" && req.IdentityToken == "" {
		common.RespondError(w, http.StatusUnauthorized, "Authorization header or identityToken is required", common.ErrUnauthorized)
		return
	}

	res, err := h.svc.SocialAuthMock(r.Context(), email, "google", "USER")
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

	token := authHeader
	if token == "" {
		token = req.IdentityToken
	}
	if token == "" {
		common.RespondError(w, http.StatusUnauthorized, "Apple Identity Token is required in Authorization header or request body", common.ErrUnauthorized)
		return
	}

	email := req.Email
	if email == "" {
		email = "apple_user@example.com"
	}

	res, err := h.svc.SocialAuthMock(r.Context(), email, "apple", "USER")
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
