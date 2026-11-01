package interests

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

	// Public read routes
	r.Get("/interests", h.GetInterests)
	r.Get("/interest", h.GetInterests)
	r.Get("/interests/{id}", h.GetInterestByID)
	r.Get("/interest/{id}", h.GetInterestByID)

	// Admin mutation routes
	r.Group(func(pr chi.Router) {
		pr.Use(jwtAuth)

		pr.Post("/interests", h.CreateInterest)
		pr.Post("/interest", h.CreateInterest)
	})
}

func (h *Handler) GetInterests(w http.ResponseWriter, r *http.Request) {
	vals := r.URL.Query()
	language := vals.Get("language")

	var idFilter *int
	if idStr := vals.Get("id"); idStr != "" {
		if id, err := strconv.Atoi(idStr); err == nil {
			idFilter = &id
		} else {
			common.RespondError(w, http.StatusBadRequest, "Query parameter 'id' must be a valid number", common.ErrBadRequest)
			return
		}
	}

	categories, err := h.svc.GetInterests(r.Context(), language, idFilter)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Interests retrieved successfully", categories)
}

func (h *Handler) GetInterestByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid interest category ID", common.ErrBadRequest)
		return
	}

	language := r.URL.Query().Get("language")

	categories, err := h.svc.GetInterests(r.Context(), language, &id)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}
	if len(categories) == 0 {
		common.RespondError(w, http.StatusNotFound, "Interest category not found", common.ErrNotFound)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Interest category retrieved successfully", categories[0])
}

func (h *Handler) CreateInterest(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	if u.Role != "ADMIN" {
		common.RespondError(w, http.StatusForbidden, "Only administrators can create interest categories", common.ErrForbidden)
		return
	}

	var dto CreateInterestCategoryDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid JSON payload", common.ErrBadRequest)
		return
	}

	cat, err := h.svc.CreateInterestCategory(r.Context(), dto)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusCreated, "Interest category created successfully", cat)
}
