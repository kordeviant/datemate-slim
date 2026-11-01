package admin

import (
	"encoding/json"
	"net/http"
	"strconv"

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
	jwtAuth := middleware.JwtAuthGuard(h.cfg, h.pool)

	r.Group(func(pr chi.Router) {
		pr.Use(jwtAuth)
		pr.Use(h.requireAdmin)

		// Dashboard
		pr.Get("/admin/dashboard/overview", h.GetOverview)
		pr.Get("/admin/dashboard/stats", h.GetStats)

		// Users
		pr.Get("/admin/users", h.GetUsers)
		pr.Get("/admin/users/count", h.GetUsersCount)
		pr.Get("/admin/users/pending-selfies/count", h.GetPendingSelfiesCount)
		pr.Get("/admin/users/{id}", h.GetUserDetails)
		pr.Patch("/admin/users/{id}", h.UpdateUser)
		pr.Put("/admin/users/{id}", h.UpdateUser)
		pr.Post("/admin/users/{id}/ban", h.BanUser)
		pr.Post("/admin/users/{id}/unban", h.UnbanUser)
		pr.Delete("/admin/users/{id}", h.DeleteUser)
		pr.Delete("/admin/users/{userId}/gallery/{galleryId}", h.DeleteUserGallery)
		pr.Get("/admin/users/{userId}/devices", h.GetUserDevices)
		pr.Delete("/admin/users/{userId}/devices/{deviceId}", h.TerminateUserDevice)
		pr.Delete("/admin/users/{userId}/devices", h.TerminateAllUserDevices)

		// Verifications
		pr.Get("/admin/verifications", h.GetPendingVerifications)
		pr.Get("/admin/verifications/count", h.GetPendingSelfiesCount)
		pr.Get("/admin/verifications/pending/count", h.GetPendingSelfiesCount)
		pr.Post("/admin/verifications/{id}/approve", h.ApproveVerification)
		pr.Post("/admin/verifications/{id}/reject", h.RejectVerification)
	})
}

func (h *Handler) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h.cfg == nil || h.pool == nil {
			next.ServeHTTP(w, r)
			return
		}
		u, ok := middleware.GetAuthUser(r.Context())
		if !ok || u.Role != "ADMIN" {
			common.RespondError(w, http.StatusForbidden, "Missing or insufficient administrator privileges", common.ErrForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.GetStats(r.Context())
	if err != nil {
		common.RespondAppError(w, err)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Dashboard stats retrieved", stats)
}

func (h *Handler) GetOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.svc.GetOverview(r.Context())
	if err != nil {
		common.RespondAppError(w, err)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Dashboard overview data retrieved successfully", overview)
}

func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	vals := r.URL.Query()
	page := 1
	if p := vals.Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			page = v
		}
	}
	limit := 20
	if l := vals.Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	res, err := h.svc.GetUsers(r.Context(), page, limit)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Users list retrieved successfully", res)
}

func (h *Handler) GetUsersCount(w http.ResponseWriter, r *http.Request) {
	count, err := h.svc.GetUsersCount(r.Context())
	if err != nil {
		common.RespondAppError(w, err)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Users count retrieved successfully", AdminCountDto{Count: count})
}

func (h *Handler) GetPendingSelfiesCount(w http.ResponseWriter, r *http.Request) {
	count, err := h.svc.GetPendingSelfiesCount(r.Context())
	if err != nil {
		common.RespondAppError(w, err)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Pending selfies count retrieved successfully", AdminCountDto{Count: count})
}

func (h *Handler) BanUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	var payload BanUserPayload
	_ = json.NewDecoder(r.Body).Decode(&payload)

	if err := h.svc.BanUser(r.Context(), id, payload.DurationHours, payload.DurationDays, payload.Reason); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "User banned successfully", nil)
}

func (h *Handler) GetUserDetails(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	details, err := h.svc.GetUserDetails(r.Context(), id)
	if err != nil {
		common.RespondError(w, http.StatusNotFound, "User not found", common.ErrNotFound)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User details retrieved successfully", details)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	var payload AdminUpdateUserPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid request payload", common.ErrBadRequest)
		return
	}

	updated, err := h.svc.UpdateUser(r.Context(), id, &payload)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User updated successfully", updated)
}

func (h *Handler) DeleteUserGallery(w http.ResponseWriter, r *http.Request) {
	userIdStr := chi.URLParam(r, "userId")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	galleryIdStr := chi.URLParam(r, "galleryId")
	galleryId, err := strconv.Atoi(galleryIdStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid gallery ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.DeleteUserGallery(r.Context(), userId, galleryId); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Gallery image deleted successfully", nil)
}

func (h *Handler) GetUserDevices(w http.ResponseWriter, r *http.Request) {
	userIdStr := chi.URLParam(r, "userId")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	devices, err := h.svc.GetUserDevices(r.Context(), userId)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User devices retrieved successfully", devices)
}

func (h *Handler) TerminateUserDevice(w http.ResponseWriter, r *http.Request) {
	userIdStr := chi.URLParam(r, "userId")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	deviceIdStr := chi.URLParam(r, "deviceId")
	deviceId, err := strconv.Atoi(deviceIdStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid device ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.TerminateDevice(r.Context(), userId, deviceId); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Device session terminated successfully", nil)
}

func (h *Handler) TerminateAllUserDevices(w http.ResponseWriter, r *http.Request) {
	userIdStr := chi.URLParam(r, "userId")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.TerminateAllDevices(r.Context(), userId); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "All user device sessions terminated successfully", nil)
}

func (h *Handler) UnbanUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.UnbanUser(r.Context(), id); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "User unbanned successfully", nil)
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.DeleteUser(r.Context(), id); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "User deleted successfully", nil)
}

func (h *Handler) GetPendingVerifications(w http.ResponseWriter, r *http.Request) {
	vals := r.URL.Query()
	page := 1
	if p := vals.Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			page = v
		}
	}
	limit := 20
	if l := vals.Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	res, err := h.svc.GetPendingVerifications(r.Context(), page, limit)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Pending verifications retrieved successfully", res)
}

func (h *Handler) ApproveVerification(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.ApproveVerification(r.Context(), id); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Identity verification approved successfully", nil)
}

func (h *Handler) RejectVerification(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.RejectVerification(r.Context(), id); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Identity verification rejected successfully", nil)
}
