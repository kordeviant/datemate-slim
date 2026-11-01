package users

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/middleware"

	"github.com/go-chi/chi/v5"
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
	r.Route("/users", func(ur chi.Router) {
		if h.cfg != nil && h.pool != nil {
			jwtAuth := middleware.JwtAuthGuard(h.cfg, h.pool)
			apiKeyAuth := middleware.ApiKeyGuard(h.cfg)

			// API key protected endpoint
			ur.With(apiKeyAuth).Get("/{userId}/device-token", h.GetDeviceTokenByUserId)

			// JWT protected endpoints
			ur.Group(func(pr chi.Router) {
				pr.Use(jwtAuth)

				pr.Delete("/me", h.DeleteAccount)
				pr.Delete("/account", h.DeleteAccount)
				pr.Delete("/gallery/{galleryId}", h.DeleteGalleryImage)
				pr.Get("/devices", h.GetUserDevices)
				pr.Delete("/devices/{deviceId}", h.TerminateDevice)
				pr.Delete("/devices", h.TerminateAllDevices)
				pr.Put("/device-token", h.UpdateDeviceToken)
				pr.Get("/me", h.GetMe)
				pr.Get("/profile", h.CheckProfileStatus)
				pr.Put("/profile", h.UpdateProfile)
				pr.Post("/profile", h.UpdateProfile)
				pr.Post("/bulk", h.GetBulkUsers)
				pr.Get("/avatars/{ids}", h.GetBulkAvatars)
				pr.Get("/{id}/avatar", h.GetUserAvatar)
				pr.Get("/{id}", h.GetUserProfile)
			})
		} else {
			ur.Get("/{userId}/device-token", h.GetDeviceTokenByUserId)
			ur.Delete("/me", h.DeleteAccount)
			ur.Delete("/account", h.DeleteAccount)
			ur.Delete("/gallery/{galleryId}", h.DeleteGalleryImage)
			ur.Get("/devices", h.GetUserDevices)
			ur.Delete("/devices/{deviceId}", h.TerminateDevice)
			ur.Delete("/devices", h.TerminateAllDevices)
			ur.Put("/device-token", h.UpdateDeviceToken)
			ur.Get("/me", h.GetMe)
			ur.Get("/profile", h.CheckProfileStatus)
			ur.Put("/profile", h.UpdateProfile)
			ur.Post("/profile", h.UpdateProfile)
			ur.Post("/bulk", h.GetBulkUsers)
			ur.Get("/avatars/{ids}", h.GetBulkAvatars)
			ur.Get("/{id}/avatar", h.GetUserAvatar)
			ur.Get("/{id}", h.GetUserProfile)
		}
	})
}

func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	if err := h.svc.DeleteAccount(r.Context(), u.ID); err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Account deleted successfully", map[string]interface{}{
		"success": true,
		"message": "Account deleted successfully",
	})
}

func (h *Handler) DeleteGalleryImage(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	galleryIDStr := chi.URLParam(r, "galleryId")
	galleryID, err := strconv.ParseInt(galleryIDStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid gallery ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.DeleteGalleryImage(r.Context(), u.ID, galleryID); err != nil {
		common.RespondError(w, http.StatusNotFound, err.Error(), common.ErrNotFound)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Gallery image deleted successfully", map[string]interface{}{
		"success":   true,
		"galleryId": galleryID,
	})
}

func (h *Handler) GetUserDevices(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	res, err := h.svc.GetUserDevices(r.Context(), u.ID, u.SessionID)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "User devices retrieved successfully", res)
}

func (h *Handler) TerminateDevice(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	deviceIDStr := chi.URLParam(r, "deviceId")
	deviceID, err := strconv.ParseInt(deviceIDStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid device ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.TerminateDevice(r.Context(), u.ID, deviceID); err != nil {
		common.RespondError(w, http.StatusNotFound, "Device session not found", common.ErrNotFound)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Device session terminated successfully", map[string]interface{}{
		"success":  true,
		"deviceId": deviceID,
	})
}

type TerminateAllRequest struct {
	ExcludeCurrent bool `json:"excludeCurrent"`
}

func (h *Handler) TerminateAllDevices(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	var req TerminateAllRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	if err := h.svc.TerminateAllDevices(r.Context(), u.ID, u.SessionID, req.ExcludeCurrent); err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Device sessions terminated successfully", map[string]interface{}{
		"success": true,
	})
}

func (h *Handler) UpdateDeviceToken(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	var req DeviceTokenDto
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		common.RespondError(w, http.StatusBadRequest, "Missing or invalid token", common.ErrBadRequest)
		return
	}

	devInfo := ""
	if req.DeviceInfo != nil {
		devInfo = *req.DeviceInfo
	}

	if err := h.svc.UpdateDeviceToken(r.Context(), u.ID, req.Token, devInfo); err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Device token updated successfully", req)
}

func (h *Handler) GetDeviceTokenByUserId(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "userId")
	userID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid userId parameter", common.ErrBadRequest)
		return
	}

	res, err := h.svc.GetDeviceToken(r.Context(), userID)
	if err != nil {
		common.RespondError(w, http.StatusNotFound, "User device token not found", common.ErrNotFound)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Device token retrieved successfully", res)
}

func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	res, err := h.svc.GetProfile(r.Context(), u.ID)
	if err != nil {
		common.RespondError(w, http.StatusNotFound, err.Error(), common.ErrNotFound)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "User profile successfully retrieved", res)
}

func (h *Handler) CheckProfileStatus(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	res, err := h.svc.GetProfile(r.Context(), u.ID)
	if err != nil {
		common.RespondError(w, http.StatusNotFound, err.Error(), common.ErrNotFound)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Operation successful", res.Profile.ProfileCompleted)
}

func (h *Handler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	targetID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	res, err := h.svc.GetProfile(r.Context(), targetID)
	if err != nil {
		common.RespondError(w, http.StatusNotFound, fmt.Sprintf("User with ID %d not found", targetID), common.ErrNotFound)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User profile successfully retrieved", res)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	contentType := r.Header.Get("Content-Type")
	var payload UpdateProfilePayload
	var avatarBytes, selfieBytes, galleryBytes []byte

	if strings.HasPrefix(contentType, "multipart/form-data") {
		// Parse multipart form up to 50MB
		if err := r.ParseMultipartForm(50 * 1024 * 1024); err == nil {
			if dataStr := r.FormValue("data"); dataStr != "" {
				_ = json.Unmarshal([]byte(dataStr), &payload)
			} else {
				// Form values mapped
				payload = UpdateProfilePayload{}
				if lang := r.FormValue("language"); lang != "" {
					payload.Language = &lang
				}
				if latStr := r.FormValue("lat"); latStr != "" {
					if f, err := strconv.ParseFloat(latStr, 64); err == nil {
						payload.Lat = &f
					}
				}
				if lonStr := r.FormValue("lon"); lonStr != "" {
					if f, err := strconv.ParseFloat(lonStr, 64); err == nil {
						payload.Lon = &f
					}
				}
				if pPicIDStr := r.FormValue("profilePictureId"); pPicIDStr != "" {
					if id, err := strconv.Atoi(pPicIDStr); err == nil {
						payload.ProfilePictureID = &id
					}
				}
			}

			// Read uploaded files
			if r.MultipartForm != nil && r.MultipartForm.File != nil {
				if avatars := r.MultipartForm.File["avatar"]; len(avatars) > 0 {
					f, err := avatars[0].Open()
					if err == nil {
						avatarBytes, _ = io.ReadAll(f)
						f.Close()
					}
				}
				if selfies := r.MultipartForm.File["selfie"]; len(selfies) > 0 {
					f, err := selfies[0].Open()
					if err == nil {
						selfieBytes, _ = io.ReadAll(f)
						f.Close()
					}
				}
				if galleries := r.MultipartForm.File["gallery"]; len(galleries) > 0 {
					// Rule: Single Image Upload Per Request (maxCount: 1)
					f, err := galleries[0].Open()
					if err == nil {
						galleryBytes, _ = io.ReadAll(f)
						f.Close()
					}
				}
			}
		}
	} else {
		// Pure JSON request
		_ = json.NewDecoder(r.Body).Decode(&payload)
	}

	res, err := h.svc.UpdateProfile(r.Context(), u.ID, &payload, avatarBytes, selfieBytes, galleryBytes)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, err.Error(), common.ErrBadRequest)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Profile successfully updated", res)
}

func (h *Handler) GetBulkUsers(w http.ResponseWriter, r *http.Request) {
	var body interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid request body", common.ErrBadRequest)
		return
	}

	var ids []int64
	switch v := body.(type) {
	case []interface{}:
		for _, item := range v {
			if n, ok := item.(float64); ok {
				ids = append(ids, int64(n))
			}
		}
	case map[string]interface{}:
		var rawList []interface{}
		if l, ok := v["userIds"].([]interface{}); ok {
			rawList = l
		} else if l, ok := v["ids"].([]interface{}); ok {
			rawList = l
		}
		for _, item := range rawList {
			if n, ok := item.(float64); ok {
				ids = append(ids, int64(n))
			}
		}
	}

	res, err := h.svc.GetBulkUsers(r.Context(), ids)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Bulk users retrieved successfully", res)
}

func (h *Handler) GetBulkAvatars(w http.ResponseWriter, r *http.Request) {
	rawIds := chi.URLParam(r, "ids")
	parts := strings.Split(rawIds, ",")
	var ids []int64
	for _, p := range parts {
		if id, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64); err == nil {
			ids = append(ids, id)
		}
	}

	res, err := h.svc.GetBulkAvatars(r.Context(), ids)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User avatars retrieved successfully", res)
}

func (h *Handler) GetUserAvatar(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	res, err := h.svc.GetUserAvatar(r.Context(), id)
	if err != nil {
		common.RespondError(w, http.StatusNotFound, "User not found", common.ErrNotFound)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User avatar retrieved successfully", res)
}
