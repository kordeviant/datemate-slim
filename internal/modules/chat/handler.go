package chat

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
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
	// Public file serving for chat media/attachments
	r.Get("/uploads/{fileName}", h.ServeUpload)
	r.Head("/uploads/{fileName}", h.ServeUpload)
	r.Get("/uploads/chat/{fileName}", h.ServeUpload)
	r.Head("/uploads/chat/{fileName}", h.ServeUpload)
	r.Get("/chat/files/{fileName}", h.ServeUpload)
	r.Head("/chat/files/{fileName}", h.ServeUpload)
	r.Get("/assets/chat/{fileName}", h.ServeUpload)
	r.Head("/assets/chat/{fileName}", h.ServeUpload)

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
	pr.Get("/conversations/groups", h.ListGroupConversations)
	pr.Post("/conversations/group", h.CreateGroupConversation)
	pr.Post("/conversations/groups", h.CreateGroupConversation)
	pr.Get("/conversations/{conversationId}", h.GetConversationDetails)
	pr.Get("/conversations/{conversationId}/messages", h.GetMessageHistory)

	// Groups
	pr.Post("/groups", h.CreateGroup)
	pr.Get("/groups", h.ListGroupConversations)
	pr.Get("/groups/{conversationId}", h.GetGroup)
	pr.Patch("/groups/{conversationId}", h.UpdateGroup)
	pr.Post("/groups/{conversationId}/join", h.JoinGroup)
	pr.Post("/groups/{conversationId}/members", h.AddGroupMember)
	pr.Delete("/groups/{conversationId}/members/{userId}", h.RemoveGroupMember)
	pr.Post("/groups/{conversationId}/bans", h.BanGroupUser)
	pr.Delete("/groups/{conversationId}/bans/{userId}", h.UnbanGroupUser)
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

func (h *Handler) respondSuccess(w http.ResponseWriter, statusCode int, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"status":  "success",
		"message": message,
		"data":    data,
		"error":   nil,
	})
}

func (h *Handler) respondError(w http.ResponseWriter, statusCode int, message, errType string) {
	if errType == "" {
		errType = common.ErrUnknownError
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"status":  "error",
		"message": message,
		"data":    nil,
		"error": map[string]interface{}{
			"type":    errType,
			"message": message,
		},
	})
}

func (h *Handler) respondAppError(w http.ResponseWriter, err error) {
	if appErr, ok := err.(*common.AppError); ok {
		h.respondError(w, appErr.HTTPStatus, appErr.Message, appErr.Type)
		return
	}
	h.respondError(w, http.StatusInternalServerError, err.Error(), common.ErrUnknownError)
}

func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	var dto CreateConversationDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	convType := strings.ToUpper(strings.TrimSpace(dto.Type))
	if convType == "GROUP" {
		title := "Group Conversation"
		if dto.Title != nil && *dto.Title != "" {
			title = *dto.Title
		} else if dto.Name != nil && *dto.Name != "" {
			title = *dto.Name
		}
		conv, err := h.svc.CreateGroupConversation(r.Context(), u.ID, CreateGroupDto{
			Title:          title,
			ParticipantIds: dto.ParticipantIds,
		})
		if err != nil {
			h.respondAppError(w, err)
			return
		}
		h.respondSuccess(w, http.StatusOK, "Conversation created successfully", CreateConversationResponseData{Conversation: *conv})
		return
	}

	// DIRECT conversation (default)
	targetID := dto.TargetUserId
	if targetID == nil {
		targetID = dto.RecipientId
	}
	if targetID == nil && len(dto.ParticipantIds) > 0 {
		for _, pid := range dto.ParticipantIds {
			if pid != u.ID && pid > 0 {
				targetID = &pid
				break
			}
		}
		if targetID == nil && len(dto.ParticipantIds) == 1 && dto.ParticipantIds[0] == u.ID {
			h.respondError(w, http.StatusBadRequest, "Self-conversation is not allowed", common.ErrBadRequest)
			return
		}
	}
	if targetID == nil {
		h.respondError(w, http.StatusBadRequest, "targetUserId or participantIds is required for direct conversation", common.ErrBadRequest)
		return
	}

	conv, err := h.svc.CreateDirectConversation(r.Context(), u.ID, *targetID)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusOK, "Conversation created or retrieved successfully", CreateConversationResponseData{Conversation: *conv})
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
		h.respondAppError(w, err)
		return
	}
	if list == nil {
		list = make([]ConversationDto, 0)
	}

	h.respondSuccess(w, http.StatusOK, "Conversations retrieved successfully", PaginatedResult[ConversationDto]{
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
		h.respondAppError(w, err)
		return
	}
	if list == nil {
		list = make([]ConversationDto, 0)
	}

	h.respondSuccess(w, http.StatusOK, "Direct conversations retrieved successfully", PaginatedResult[ConversationDto]{
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
		h.respondAppError(w, err)
		return
	}
	if list == nil {
		list = make([]ConversationDto, 0)
	}

	h.respondSuccess(w, http.StatusOK, "Group conversations retrieved successfully", PaginatedResult[ConversationDto]{
		Items:   list,
		HasMore: len(list) >= limit,
	})
}

func (h *Handler) GetConversationDetails(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	conv, err := h.svc.GetConversationDetails(r.Context(), convID, u.ID)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusOK, "Conversation details retrieved", conv)
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
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusOK, "Messages retrieved successfully", res)
}

func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	var dto CreateGroupDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	conv, err := h.svc.CreateGroupConversation(r.Context(), u.ID, dto)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	grp, err := h.svc.GetGroup(r.Context(), conv.ConversationID, u.ID)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusCreated, "Group conversation created successfully", grp)
}

func (h *Handler) CreateGroupConversation(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	var groupDto CreateGroupDto
	_ = json.Unmarshal(bodyBytes, &groupDto)

	var convDto CreateConversationDto
	_ = json.Unmarshal(bodyBytes, &convDto)

	title := "Group Conversation"
	if groupDto.Title != "" {
		title = groupDto.Title
	} else if convDto.Title != nil && *convDto.Title != "" {
		title = *convDto.Title
	} else if convDto.Name != nil && *convDto.Name != "" {
		title = *convDto.Name
	}

	participantIDs := groupDto.ParticipantIds
	if len(participantIDs) == 0 && len(convDto.ParticipantIds) > 0 {
		participantIDs = convDto.ParticipantIds
	}

	groupDto.Title = title
	groupDto.ParticipantIds = participantIDs

	conv, err := h.svc.CreateGroupConversation(r.Context(), u.ID, groupDto)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusCreated, "Group conversation created successfully", CreateConversationResponseData{Conversation: *conv})
}

func (h *Handler) GetGroup(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	grp, err := h.svc.GetGroup(r.Context(), convID, u.ID)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusOK, "Group profile returned successfully", grp)
}

func (h *Handler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	var dto UpdateGroupDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	grp, err := h.svc.UpdateGroup(r.Context(), convID, u.ID, dto)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusOK, "Group profile updated successfully", grp)
}

func (h *Handler) JoinGroup(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	grp, err := h.svc.JoinGroup(r.Context(), convID, u.ID)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusOK, "Joined group successfully", grp)
}

func (h *Handler) BanGroupUser(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	var dto BanGroupUserDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	err := h.svc.BanGroupUser(r.Context(), convID, u.ID, dto.UserID, dto.Reason)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) AddGroupMember(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")

	var payload AddGroupMemberPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	var targets []int64
	if payload.UserID != nil {
		targets = append(targets, *payload.UserID)
	}
	if len(payload.UserIDs) > 0 {
		targets = append(targets, payload.UserIDs...)
	}

	if len(targets) == 0 {
		common.RespondError(w, http.StatusBadRequest, "userId or userIds is required", common.ErrBadRequest)
		return
	}

	var lastRes *GroupResponseDto
	var err error
	for _, targetID := range targets {
		lastRes, err = h.svc.AddGroupMember(r.Context(), convID, u.ID, targetID)
		if err != nil {
			common.RespondAppError(w, err)
			return
		}
	}

	common.RespondSuccess(w, http.StatusOK, "Member(s) added successfully", lastRes)
}

func (h *Handler) RemoveGroupMember(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	userIDStr := chi.URLParam(r, "userId")
	targetID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid target userId", common.ErrBadRequest)
		return
	}

	if err := h.svc.RemoveGroupMember(r.Context(), convID, u.ID, targetID); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "Member removed successfully", nil)
}

func (h *Handler) UnbanGroupUser(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	userIDStr := chi.URLParam(r, "userId")
	targetID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Invalid target userId", common.ErrBadRequest)
		return
	}

	if err := h.svc.UnbanGroupUser(r.Context(), convID, u.ID, targetID); err != nil {
		common.RespondAppError(w, err)
		return
	}

	common.RespondSuccess[any](w, http.StatusOK, "User unbanned successfully", nil)
}

func (h *Handler) GetUserActivity(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "userId")
	targetID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid user ID", common.ErrBadRequest)
		return
	}

	act, err := h.svc.GetUserActivity(r.Context(), targetID)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusOK, "User activity details", act)
}

func (h *Handler) GetBatchUserActivity(w http.ResponseWriter, r *http.Request) {
	var dto BatchUserActivityRequestDto
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid payload", common.ErrBadRequest)
		return
	}

	activities, err := h.svc.GetBatchUserActivity(r.Context(), dto.UserIDs)
	if err != nil {
		h.respondAppError(w, err)
		return
	}

	h.respondSuccess(w, http.StatusOK, "List of user activities", BatchUserActivityResponseDto{
		Activities: activities,
	})
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())

	if err := r.ParseMultipartForm(50 << 20); err != nil { // 50MB max
		h.respondError(w, http.StatusBadRequest, "Failed to parse multipart upload", common.ErrBadRequest)
		return
	}

	var file multipart.File
	var header *multipart.FileHeader
	for _, fieldName := range []string{"file", "media", "audio", "voice", "image", "attachment"} {
		f, hd, err := r.FormFile(fieldName)
		if err == nil {
			file = f
			header = hd
			break
		}
	}

	if file == nil || header == nil {
		h.respondError(w, http.StatusBadRequest, "Missing upload file (supported fields: file, media, audio, voice, image, attachment)", common.ErrBadRequest)
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Failed to read file", common.ErrBadRequest)
		return
	}

	rawFilename := header.Filename
	ext := strings.ToLower(filepath.Ext(rawFilename))

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = http.DetectContentType(fileBytes)
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// If extension missing or client uploaded generic "blob" (common in mobile voice recorders)
	if ext == "" || strings.EqualFold(rawFilename, "blob") {
		switch {
		case strings.Contains(mimeType, "ogg"):
			ext = ".ogg"
		case strings.Contains(mimeType, "mp4") || strings.Contains(mimeType, "m4a") || strings.Contains(mimeType, "aac"):
			ext = ".m4a"
		case strings.Contains(mimeType, "mpeg") || strings.Contains(mimeType, "mp3"):
			ext = ".mp3"
		case strings.Contains(mimeType, "wav"):
			ext = ".wav"
		case strings.Contains(mimeType, "opus"):
			ext = ".opus"
		case strings.Contains(mimeType, "webm"):
			ext = ".webm"
		case strings.Contains(mimeType, "jpeg"):
			ext = ".jpg"
		case strings.Contains(mimeType, "png"):
			ext = ".png"
		case strings.Contains(mimeType, "webp"):
			ext = ".webp"
		}
		if rawFilename == "" || strings.EqualFold(rawFilename, "blob") {
			rawFilename = "upload" + ext
		}
	}

	if err := storage.ValidateFilename(rawFilename); err != nil {
		h.respondError(w, http.StatusBadRequest, err.Error(), common.ErrBadRequest)
		return
	}

	mediaType := "file"
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic":
		mediaType = "image"
	case ".mp4", ".mov", ".avi", ".webm", ".m4v", ".mkv":
		mediaType = "video"
	case ".mp3", ".ogg", ".wav", ".m4a", ".aac", ".opus", ".weba":
		mediaType = "voice"
	}

	if formType := strings.ToLower(strings.TrimSpace(r.FormValue("type"))); formType != "" {
		switch formType {
		case "voice", "audio":
			mediaType = "voice"
		case "image", "photo", "picture":
			mediaType = "image"
		case "video":
			mediaType = "video"
		case "file", "document":
			mediaType = "file"
		default:
			mediaType = formType
		}
	}

	var dur *float64
	if durStr := r.FormValue("duration"); durStr != "" {
		if d, err := strconv.ParseFloat(durStr, 64); err == nil && d > 0 {
			dur = &d
			if mediaType == "file" {
				mediaType = "voice"
			}
		}
	}

	safeFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	_, err = h.svc.storage.Save(r.Context(), "chat", safeFilename, bytes.NewReader(fileBytes), int64(len(fileBytes)), mimeType)
	if err != nil {
		log.Printf("[ERROR chat Upload] Failed to save file %s: %v (storage=%T)", safeFilename, err, h.svc.storage)
		common.RespondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to save file: %v", err), common.ErrUnknownError)
		return
	}

	baseURL := "http://localhost:3000"
	if h.cfg != nil && h.cfg.AssetBaseURL != "" {
		baseURL = strings.TrimRight(h.cfg.AssetBaseURL, "/")
	}
	resolvedUrl := fmt.Sprintf("%s/uploads/%s", baseURL, safeFilename)

	res := UploadMediaResponseData{
		Url:            resolvedUrl,
		Type:           mediaType,
		Duration:       dur,
		FileName:       rawFilename,
		StoredFileName: safeFilename,
		FileSize:       int64(len(fileBytes)),
		Size:           int64(len(fileBytes)),
		MimeType:       mimeType,
	}

	h.respondSuccess(w, http.StatusCreated, "File uploaded successfully", res)
	_ = u
}

func (h *Handler) ListGroupParticipants(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	participants, err := h.svc.ListGroupParticipants(r.Context(), convID, u.ID)
	if err != nil {
		h.respondAppError(w, err)
		return
	}
	h.respondSuccess(w, http.StatusOK, "Group participants retrieved", participants)
}

func (h *Handler) GetGroupParticipant(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	targetID, err := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid userId", common.ErrBadRequest)
		return
	}
	participant, err := h.svc.GetGroupParticipant(r.Context(), convID, u.ID, targetID)
	if err != nil {
		h.respondAppError(w, err)
		return
	}
	h.respondSuccess(w, http.StatusOK, "Group participant retrieved", participant)
}

func (h *Handler) AcceptGroupInvitation(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.GetAuthUser(r.Context())
	convID := chi.URLParam(r, "conversationId")
	if err := h.svc.AcceptGroupInvitation(r.Context(), convID, u.ID); err != nil {
		h.respondAppError(w, err)
		return
	}
	h.respondSuccess(w, http.StatusOK, "Group invitation accepted", map[string]interface{}{"success": true})
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
		h.respondError(w, http.StatusBadRequest, "applicantId is required", common.ErrBadRequest)
		return
	}
	if err := h.svc.ApproveJoinRequest(r.Context(), convID, u.ID, applicantID); err != nil {
		h.respondAppError(w, err)
		return
	}
	h.respondSuccess(w, http.StatusOK, "Group join request approved", map[string]interface{}{"success": true})
}
