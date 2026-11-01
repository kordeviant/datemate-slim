package friends

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

		pr.Post("/friends/add", h.AddFriend)
		pr.Get("/friends/requests", h.GetFriendRequests)
		pr.Post("/friends/accept/{id}", h.AcceptFriendRequest)
		pr.Post("/friends/reject/{id}", h.RejectFriendRequest)
		pr.Post("/friends/cancel/{id}", h.CancelFriendRequest)
		pr.Get("/friends", h.GetFriends)
		pr.Delete("/friends/{friendId}", h.RemoveFriend)
	})
}

func (h *Handler) AddFriend(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	var payload AddFriendPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	item, msg, err := h.svc.AddFriend(r.Context(), u.ID, int64(payload.UserID))
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, msg, item)
}

func (h *Handler) GetFriendRequests(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	vals := r.URL.Query()
	q := FriendRequestsQuery{
		Type:   vals.Get("type"),
		Status: vals.Get("status"),
		Page:   1,
		Limit:  10,
	}
	if p := vals.Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			q.Page = v
		}
	}
	if l := vals.Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			q.Limit = v
		}
	}

	res, err := h.svc.GetFriendRequests(r.Context(), u.ID, q)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Friend requests retrieved successfully", res)
}

func (h *Handler) AcceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid request ID", common.ErrBadRequest)
		return
	}

	item, err := h.svc.AcceptFriendRequest(r.Context(), u.ID, id)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Friend request accepted successfully", item)
}

func (h *Handler) RejectFriendRequest(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid request ID", common.ErrBadRequest)
		return
	}

	item, err := h.svc.RejectFriendRequest(r.Context(), u.ID, id)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Friend request rejected successfully", item)
}

func (h *Handler) CancelFriendRequest(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid request ID", common.ErrBadRequest)
		return
	}

	item, err := h.svc.CancelFriendRequest(r.Context(), u.ID, id)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Friend request cancelled successfully", item)
}

func (h *Handler) GetFriends(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	vals := r.URL.Query()
	q := FriendsQuery{
		Page:   1,
		Limit:  10,
		Search: vals.Get("search"),
	}
	if p := vals.Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			q.Page = v
		}
	}
	if l := vals.Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			q.Limit = v
		}
	}

	res, err := h.svc.GetFriends(r.Context(), u.ID, q)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Friends retrieved successfully", res)
}

func (h *Handler) RemoveFriend(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	idStr := chi.URLParam(r, "friendId")
	friendId, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid friend ID", common.ErrBadRequest)
		return
	}

	err = h.svc.RemoveFriend(r.Context(), u.ID, friendId)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Friend removed successfully", nil)
}
