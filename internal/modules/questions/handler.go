package questions

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

	// Public / Client read routes
	r.Get("/questions", h.GetQuestions)
	r.Get("/questions/search", h.SearchQuestions)
	r.Get("/questions/type/{type}", h.GetQuestionsByType)
	r.Get("/questions/{id}", h.GetQuestionByID)

	// Admin mutation routes
	r.Group(func(pr chi.Router) {
		pr.Use(jwtAuth)

		pr.Post("/questions", h.CreateQuestion)
		pr.Put("/questions/{id}", h.UpdateQuestion)
		pr.Delete("/questions/{id}", h.DeleteQuestion)
	})
}

func (h *Handler) GetQuestions(w http.ResponseWriter, r *http.Request) {
	vals := r.URL.Query()
	typeFilter := vals.Get("type")
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

	questions, err := h.svc.GetQuestions(r.Context(), typeFilter, language, idFilter)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Questions retrieved successfully", questions)
}

func (h *Handler) SearchQuestions(w http.ResponseWriter, r *http.Request) {
	vals := r.URL.Query()
	typeFilter := vals.Get("type")
	language := vals.Get("language")

	questions, err := h.svc.GetQuestions(r.Context(), typeFilter, language, nil)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Questions retrieved successfully", questions)
}

func (h *Handler) GetQuestionsByType(w http.ResponseWriter, r *http.Request) {
	typeParam := chi.URLParam(r, "type")
	language := r.URL.Query().Get("language")

	questions, err := h.svc.GetQuestions(r.Context(), typeParam, language, nil)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Questions of the specified type retrieved successfully", questions)
}

func (h *Handler) GetQuestionByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid question ID", common.ErrBadRequest)
		return
	}

	language := r.URL.Query().Get("language")

	questions, err := h.svc.GetQuestions(r.Context(), "", language, &id)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}
	if len(questions) == 0 {
		common.RespondError(w, http.StatusNotFound, "Question not found", common.ErrNotFound)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Question retrieved successfully", questions[0])
}

func (h *Handler) CreateQuestion(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	if u.Role != "ADMIN" {
		common.RespondError(w, http.StatusForbidden, "Only administrators can create questions", common.ErrForbidden)
		return
	}

	var payload CreateQuestionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid JSON payload", common.ErrBadRequest)
		return
	}

	q, err := h.svc.CreateQuestion(r.Context(), payload)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusCreated, "Question created successfully", q)
}

func (h *Handler) UpdateQuestion(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	if u.Role != "ADMIN" {
		common.RespondError(w, http.StatusForbidden, "Only administrators can update questions", common.ErrForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid question ID", common.ErrBadRequest)
		return
	}

	var payload UpdateQuestionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid JSON payload", common.ErrBadRequest)
		return
	}

	q, err := h.svc.UpdateQuestion(r.Context(), id, payload)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Question updated successfully", q)
}

func (h *Handler) DeleteQuestion(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	if u.Role != "ADMIN" {
		common.RespondError(w, http.StatusForbidden, "Only administrators can delete questions", common.ErrForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid question ID", common.ErrBadRequest)
		return
	}

	if err := h.svc.DeleteQuestion(r.Context(), id); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Question deleted successfully", nil)
}
