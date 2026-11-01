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
		pr.Post("/admin/users/{id}/ban", h.BanUser)
		pr.Post("/admin/users/{id}/unban", h.UnbanUser)
		pr.Delete("/admin/users/{id}", h.DeleteUser)

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

	dur := 30
	if payload.DurationDays != nil {
		dur = *payload.DurationDays
	}

	if err := h.svc.BanUser(r.Context(), id, dur, payload.Reason); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "User banned successfully", nil)
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
