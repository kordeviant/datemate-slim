package chat

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc          *Service
	cfg          *config.Config
	pool         *pgxpool.Pool
	assetHandler *storage.AssetHandler
}

func NewHandler(svc *Service, cfg *config.Config, pool *pgxpool.Pool) *Handler {
	var accel bool
	if cfg != nil {
		accel = cfg.NginxAccelRedirect
	}
	return &Handler{
		svc:          svc,
		cfg:          cfg,
		pool:         pool,
		assetHandler: storage.NewAssetHandler(svc.storage, accel),
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	// Public or JWT file serving
	r.Get("/uploads/{fileName}", h.ServeUpload)
	r.Get("/chat/files/{fileName}", h.ServeUpload)

	if h.cfg != nil && h.pool != nil {
		jwtAuth := middleware.JwtAuthGuard(h.cfg, h.pool)
		r.Group(func(pr chi.Router) {
			pr.Use(jwtAuth)
			h.registerProtected(pr)
		})
	} else {
		h.registerProtected(r)
	}
}

func (h *Handler) registerProtected(pr chi.Router) {
	// Conversations
	pr.Post("/conversations", h.CreateConversation)
	pr.Get("/conversations", h.ListConversations)
	pr.Get("/conversations/direct", h.ListDirectConversations)
	pr.Get("/conversations/group", h.ListGroupConversations)
	pr.Get("/conversations/{conversationId}", h.GetConversationDetails)
	pr.Get("/conversations/{conversationId}/messages", h.GetMessageHistory)

	// Groups
	pr.Post("/groups", h.CreateGroup)
	pr.Get("/groups/{conversationId}", h.GetGroup)
	pr.Patch("/groups/{conversationId}", h.UpdateGroup)
	pr.Post("/groups/{conversationId}/join", h.JoinGroup)
	pr.Post("/groups/{conversationId}/bans", h.BanGroupUser)
	pr.Get("/groups/{conversationId}/participants", h.ListGroupParticipants)
	pr.Get("/groups/{conversationId}/participants/{userId}", h.GetGroupParticipant)
	pr.Post("/groups/{conversationId}/invitations/accept", h.AcceptGroupInvitation)
	pr.Post("/groups/{conversationId}/join-requests/approve", h.ApproveJoinRequest)

	// Chat presence / users
	pr.Get("/users/{userId}/activity", h.GetUserActivity)
	pr.Post("/users/activity", h.GetBatchUserActivity)

	// Uploads
	pr.Post("/chat/upload", h.Upload)
	pr.Post("/upload", h.Upload)
}

func (h *Handler) ServeUpload(w http.ResponseWriter, r *http.Request) {
	fileName := chi.URLParam(r, "fileName")
	if fileName == "" {
		fileName = chi.URLParam(r, "filename")
	}
	h.assetHandler.ServeAsset(w, r, "chat", fileName)
}

func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	var dto CreateConversationDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	convType := strings.ToUpper(dto.Type)
	if convType == "GROUP" {
		title := "Group Conversation"
		if dto.Title != nil && *dto.Title != "" {
			title = *dto.Title
		}
		conv, err := h.svc.CreateGroupConversation(r.Context(), u.ID, CreateGroupDto{
			Title:          title,
			ParticipantIds: dto.ParticipantIds,
		})
		if err != nil {
			common.RespondAppError(w, err)
			return
		}
		common.RespondSuccess(w, http.StatusOK, "Conversation created successfully", CreateConversationResponseData{Conversation: *conv})
		return
	}

	// DIRECT conversation
	targetID := dto.TargetUserId
	if targetID == nil {
		targetID = dto.RecipientId
	}
	if targetID == nil {
		common.RespondError(w, http.StatusBadRequest, "targetUserId is required for direct conversation", common.ErrBadRequest)
		return
	}

	conv, err := h.svc.CreateDirectConversation(r.Context(), u.ID, *targetID)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Conversation created or retrieved successfully", CreateConversationResponseData{Conversation: *conv})
}

func (h *Handler) ListConversations(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	limit := 30
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	list, err := h.svc.ListConversations(r.Context(), u.ID, "", limit)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Conversations retrieved successfully", PaginatedResult[ConversationDto]{
		Items:   list,
		HasMore: len(list) >= limit,
	})
}

func (h *Handler) ListDirectConversations(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	limit := 30
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	list, err := h.svc.ListConversations(r.Context(), u.ID, "DIRECT", limit)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Direct conversations retrieved successfully", PaginatedResult[ConversationDto]{
		Items:   list,
		HasMore: len(list) >= limit,
	})
}

func (h *Handler) ListGroupConversations(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	limit := 30
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	list, err := h.svc.ListConversations(r.Context(), u.ID, "GROUP", limit)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Group conversations retrieved successfully", PaginatedResult[ConversationDto]{
		Items:   list,
		HasMore: len(list) >= limit,
	})
}

func (h *Handler) GetConversationDetails(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	conv, err := h.svc.GetConversationDetails(r.Context(), convID, u.ID)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Conversation details retrieved", conv)
}

func (h *Handler) GetMessageHistory(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	limit := 30
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}
	cursor := r.URL.Query().Get("cursor")

	res, err := h.svc.GetMessageHistory(r.Context(), convID, u.ID, limit, cursor)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Messages retrieved successfully", res)
}

func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	var dto CreateGroupDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	conv, err := h.svc.CreateGroupConversation(r.Context(), u.ID, dto)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	grp, err := h.svc.GetGroup(r.Context(), conv.ConversationID, u.ID)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusCreated, "Group conversation created successfully", grp)
}

func (h *Handler) GetGroup(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	grp, err := h.svc.GetGroup(r.Context(), convID, u.ID)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Group profile returned successfully", grp)
}

func (h *Handler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	var dto UpdateGroupDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	grp, err := h.svc.UpdateGroup(r.Context(), convID, u.ID, dto)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Group profile updated successfully", grp)
}

func (h *Handler) JoinGroup(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	grp, err := h.svc.JoinGroup(r.Context(), convID, u.ID)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "Joined group successfully", grp)
}

func (h *Handler) BanGroupUser(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	var dto BanGroupUserDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	err := h.svc.BanGroupUser(r.Context(), convID, u.ID, dto.UserID, dto.Reason)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetUserActivity(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "userId")
	targetID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	act, err := h.svc.GetUserActivity(r.Context(), targetID)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "User activity details", act)
}

func (h *Handler) GetBatchUserActivity(w http.ResponseWriter, r *http.Request) {
	var dto BatchUserActivityRequestDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	activities, err := h.svc.GetBatchUserActivity(r.Context(), dto.UserIDs)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess(w, http.StatusOK, "List of user activities", BatchUserActivityResponseDto{
		Activities: activities,
	})
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	if err := r.ParseMultipartForm(50 << 20); err != nil { // 50MB max
		common.RespondError(w, http.StatusBadRequest, "Failed to parse multipart upload", common.ErrBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Missing 'file' form field", common.ErrBadRequest)
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Failed to read file", common.ErrBadRequest)
		return
	}

	if err := storage.ValidateFilename(header.Filename); err != nil {
		common.RespondError(w, http.StatusBadRequest, err.Error(), common.ErrBadRequest)
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	mediaType := "file"
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		mediaType = "image"
	case ".mp4", ".mov", ".avi", ".webm":
		mediaType = "video"
	case ".mp3", ".ogg", ".wav", ".m4a":
		mediaType = "voice"
	}
	if formType := r.FormValue("type"); formType != "" {
		mediaType = formType
	}

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	safeFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	relPath, err := h.svc.storage.Save(r.Context(), "chat", safeFilename, bytes.NewReader(fileBytes), int64(len(fileBytes)), mimeType)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, "Failed to save file", common.ErrUnknownError)
		return
	}

	resolvedUrl := h.svc.resolveAssetURL(relPath)

	var dur *float64
	if durStr := r.FormValue("duration"); durStr != "" {
		if d, err := strconv.ParseFloat(durStr, 64); err == nil {
			dur = &d
		}
	}

	res := UploadMediaResponseData{
		Url:      resolvedUrl,
		Type:     mediaType,
		Duration: dur,
		FileName: safeFilename,
		FileSize: int64(len(fileBytes)),
		MimeType: mimeType,
	}

	common.RespondSuccess(w, http.StatusCreated, "File uploaded successfully", res)
	_ = u
}

func (h *Handler) ListGroupParticipants(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	participants, err := h.svc.ListGroupParticipants(r.Context(), convID, u.ID)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Group participants retrieved", participants)
}

func (h *Handler) GetGroupParticipant(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	targetID, err := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid userId", common.ErrBadRequest)
		return
	}
	participant, err := h.svc.GetGroupParticipant(r.Context(), convID, u.ID, targetID)
	if err != nil {
		common.RespondAppError(w, err)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Group participant retrieved", participant)
}

func (h *Handler) AcceptGroupInvitation(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	if err := h.svc.AcceptGroupInvitation(r.Context(), convID, u.ID); err != nil {
		common.RespondAppError(w, err)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Group invitation accepted", map[string]interface{}{"success": true})
}

type ApproveJoinRequestDto struct {
	ApplicantID int64 `json:"applicantId"`
	UserID      int64 `json:"userId,omitempty"`
}

func (h *Handler) ApproveJoinRequest(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	var dto ApproveJoinRequestDto
	_ = json.NewDecoder(r.Body).Decode(&dto)
	applicantID := dto.ApplicantID
	if applicantID == 0 {
		applicantID = dto.UserID
	}
	if applicantID == 0 {
		common.RespondError(w, http.StatusBadRequest, "applicantId is required", common.ErrBadRequest)
		return
	}
	if err := h.svc.ApproveJoinRequest(r.Context(), convID, u.ID, applicantID); err != nil {
		common.RespondAppError(w, err)
		return
	}
	common.RespondSuccess(w, http.StatusOK, "Group join request approved", map[string]interface{}{"success": true})
}
