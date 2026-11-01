package recommended

import (
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

		pr.Get("/recommended", h.GetRecommended)
		pr.Get("/recommended/detail", h.GetRecommendedDetail)
	})
}

func parseRecommendedQuery(r *http.Request) RecommendedQuery {
	var q RecommendedQuery
	vals := r.URL.Query()

	if s := vals.Get("start"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			q.Start = &v
		}
	}
	if s := vals.Get("candidateId"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			q.CandidateID = &v
		}
	}
	if s := vals.Get("limit"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			q.Limit = &v
		}
	}
	if s := vals.Get("end"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			q.End = &v
		}
	}
	if s := vals.Get("offset"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			q.Offset = &v
		}
	}
	if s := vals.Get("anchorUserId"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			q.AnchorUserID = &v
		}
	}
	if s := vals.Get("before"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			q.Before = &v
		}
	}
	if s := vals.Get("after"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			q.After = &v
		}
	}

	return q
}

func (h *Handler) GetRecommended(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	q := parseRecommendedQuery(r)

	res, err := h.svc.GetRecommended(r.Context(), u.ID, q)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Recommended profiles retrieved successfully", res)
}

func (h *Handler) GetRecommendedDetail(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	q := parseRecommendedQuery(r)

	res, err := h.svc.GetRecommendedDetail(r.Context(), u.ID, q)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Recommended detailed profiles retrieved successfully", res)
}
