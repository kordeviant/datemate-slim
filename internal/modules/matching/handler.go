package matching

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

		pr.Get("/feed", h.GetFeed)
		pr.Post("/swipes", h.RecordSwipe)
		pr.Get("/likes", h.GetLikes)
		pr.Get("/matches", h.GetMatches)
	})
}

func (h *Handler) GetFeed(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	limit := h.cfg.PaginationDefaultLimit
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil {
			limit = l
		}
	}

	res, err := h.svc.GetFeed(r.Context(), u.ID, limit)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Feed retrieved successfully", res)
}

func (h *Handler) RecordSwipe(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	var req SwipeRequestDto
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TargetUserID <= 0 || req.Direction == "" {
		common.RespondError(w, http.StatusBadRequest, "Invalid swipe payload", common.ErrBadRequest)
		return
	}

	if err := h.svc.RecordSwipe(r.Context(), u.ID, req.TargetUserID, req.Direction); err != nil {
		if err.Error() == "Target user not found" {
			common.RespondError(w, http.StatusNotFound, err.Error(), common.ErrNotFound)
			return
		}
		common.RespondError(w, http.StatusBadRequest, err.Error(), common.ErrBadRequest)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Swipe recorded successfully", nil)
}

func (h *Handler) GetLikes(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	res, err := h.svc.GetLikesReceived(r.Context(), u.ID)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Likes retrieved successfully", res)
}

func (h *Handler) GetMatches(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	res, err := h.svc.GetLikesReceived(r.Context(), u.ID)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Matches retrieved successfully", res)
}
