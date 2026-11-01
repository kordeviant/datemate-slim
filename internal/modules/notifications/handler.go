package notifications

import (
	"encoding/json"
	"net/http"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/platform/fcm"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PushNotificationPayload struct {
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	DeviceToken *string                `json:"device_token,omitempty"`
	Tokens      []string               `json:"tokens,omitempty"`
	UserID      *int64                 `json:"userId,omitempty"`
	Topic       *string                `json:"topic,omitempty"`
	Data        map[string]interface{} `json:"data,omitempty"`
	Priority    string                 `json:"priority,omitempty"`
}

type PushResponseDto struct {
	JobID   string `json:"job_id"`
	Status  string `json:"status"`
	Title   string `json:"title"`
	Message string `json:"message"`
}

type Handler struct {
	cfg        *config.Config
	dispatcher *fcm.Dispatcher
}

func NewHandler(cfg *config.Config, dispatcher *fcm.Dispatcher) *Handler {
	return &Handler{
		cfg:        cfg,
		dispatcher: dispatcher,
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	apiKeyGuard := middleware.ApiKeyGuard(h.cfg)

	r.Group(func(pr chi.Router) {
		pr.Use(apiKeyGuard)

		pr.Post("/push", h.SendPush)
		pr.Post("/notifications/push", h.SendPush)
	})
}

func (h *Handler) SendPush(w http.ResponseWriter, r *http.Request) {
	var payload PushNotificationPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid JSON payload", common.ErrBadRequest)
		return
	}

	if payload.Title == "" || payload.Body == "" {
		common.RespondError(w, http.StatusBadRequest, "Title and body are required", common.ErrBadRequest)
		return
	}

	var tokens []string
	if payload.DeviceToken != nil && *payload.DeviceToken != "" {
		tokens = append(tokens, *payload.DeviceToken)
	}
	if len(payload.Tokens) > 0 {
		tokens = append(tokens, payload.Tokens...)
	}

	jobID := uuid.NewString()
	if h.dispatcher != nil {
		h.dispatcher.Enqueue(fcm.NotificationJob{
			ID:       jobID,
			Tokens:   tokens,
			UserID:   payload.UserID,
			Title:    payload.Title,
			Body:     payload.Body,
			Data:     payload.Data,
			Priority: payload.Priority,
		})
	}

	res := PushResponseDto{
		JobID:   jobID,
		Status:  "QUEUED",
		Title:   payload.Title,
		Message: "Push notification accepted and queued for immediate delivery",
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(res)
}
