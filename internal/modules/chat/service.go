package chat

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/platform/database/db"
	"datemate/internal/platform/fcm"
	platformRedis "datemate/internal/platform/redis"
	"datemate/internal/platform/storage"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Broadcaster interface {
	BroadcastToRoom(room string, event string, data interface{})
}

type Service struct {
	cfg         *config.Config
	pool        *pgxpool.Pool
	queries     *db.Queries
	rdb         *platformRedis.Client
	dispatcher  *fcm.Dispatcher
	storage     storage.Engine
	broadcaster Broadcaster
}

func (s *Service) SetBroadcaster(b Broadcaster) {
	s.broadcaster = b
}

func NewService(
	cfg *config.Config,
	pool *pgxpool.Pool,
	rdb *platformRedis.Client,
	dispatcher *fcm.Dispatcher,
	storage storage.Engine,
) *Service {
	return &Service{
		cfg:        cfg,
		pool:       pool,
		queries:    db.New(pool),
		rdb:        rdb,
		dispatcher: dispatcher,
		storage:    storage,
	}
}

func (s *Service) resolveAssetURL(raw string) string {
	return common.ResolveAssetURL(s.cfg.AssetBaseURL, raw)
}

func (s *Service) getRecentMessages(ctx context.Context, conversationID pgtype.UUID) []RecentMessageDto {
	rows, err := s.pool.Query(ctx, `
		SELECT message_id, sender_id, content, created_at, message_type, media_url, duration,
		       attachment_name, attachment_size, mime_type
		FROM messages_by_conversation
		WHERE conversation_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT 20
	`, conversationID)
	if err != nil {
		return make([]RecentMessageDto, 0)
	}
	defer rows.Close()

	var list []RecentMessageDto
	for rows.Next() {
		var msgUUID pgtype.UUID
		var senderID int64
		var content pgtype.Text
		var createdAt time.Time
		var msgType string
		var mediaUrl pgtype.Text
		var dur pgtype.Float8
		var attachName, mimeType pgtype.Text
		var attachSize pgtype.Int8

		if err := rows.Scan(&msgUUID, &senderID, &content, &createdAt, &msgType, &mediaUrl, &dur, &attachName, &attachSize, &mimeType); err != nil {
			continue
		}

		var urlPtr *string
		if mediaUrl.Valid && mediaUrl.String != "" {
			u := s.resolveAssetURL(mediaUrl.String)
			urlPtr = &u
		}

		var durPtr *float64
		if dur.Valid {
			d := dur.Float64
			durPtr = &d
		}

		var attach *MessageAttachmentDto
		if urlPtr != nil {
			var fn *string
			if attachName.Valid {
				fn = &attachName.String
			}
			var fs *int64
			if attachSize.Valid {
				fs = &attachSize.Int64
			}
			var mt *string
			if mimeType.Valid {
				mt = &mimeType.String
			}
			attach = &MessageAttachmentDto{
				Url:      *urlPtr,
				Type:     msgType,
				Duration: durPtr,
				FileName: fn,
				FileSize: fs,
				MimeType: mt,
			}
		}

		cnt := ""
		if content.Valid {
			cnt = content.String
		}

		list = append(list, RecentMessageDto{
			MessageID:  uuid.UUID(msgUUID.Bytes).String(),
			SenderID:   senderID,
			Content:    cnt,
			CreatedAt:  createdAt.UTC().Format(time.RFC3339Nano),
			Type:       msgType,
			Url:        urlPtr,
			Duration:   durPtr,
			Attachment: attach,
		})
	}
	// Reverse to chronological order (oldest to newest)
	for i, j := 0, len(list)-1; i < j; i, j = i+1, j-1 {
		list[i], list[j] = list[j], list[i]
	}

	if list == nil {
		list = make([]RecentMessageDto, 0)
	}
	return list
}

func (s *Service) CreateDirectConversation(ctx context.Context, currentUserID, targetUserID int64) (*ConversationDto, error) {
	if currentUserID == targetUserID {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Self-conversation is not allowed")
	}

	pairKey, err := common.CreatePairKey(currentUserID, targetUserID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, err.Error())
	}

	if s.pool == nil {
		detUUID := common.GenerateDeterministicConversationID(pairKey)
		return &ConversationDto{
			ConversationID:   detUUID.String(),
			Type:             "direct",
			ConversationType: "DIRECT",
			CreatedBy:        currentUserID,
			MemberIDs:        []int64{currentUserID, targetUserID},
		}, nil
	}

	// 1. Check existing direct conversation pair
	existingPair, err := s.queries.GetDirectConversationPair(ctx, pairKey)
	if err == nil {
		convIDStr := uuid.UUID(existingPair.ConversationID.Bytes).String()
		_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
			UserID:           currentUserID,
			LastMessageAt:    existingPair.CreatedAt,
			ConversationID:   existingPair.ConversationID,
			ConversationType: "DIRECT",
		})
		_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
			UserID:           targetUserID,
			LastMessageAt:    existingPair.CreatedAt,
			ConversationID:   existingPair.ConversationID,
			ConversationType: "DIRECT",
		})
		return s.GetConversationDetails(ctx, convIDStr, currentUserID)
	}

	// 2. Deterministic UUIDv5 ID
	detUUID := common.GenerateDeterministicConversationID(pairKey)
	pgUUID := pgtype.UUID{Bytes: detUUID, Valid: true}

	// 3. Create direct_conversations_by_pair
	_, _ = s.queries.CreateDirectConversationPair(ctx, db.CreateDirectConversationPairParams{
		CanonicalPairKey: pairKey,
		ConversationID:   pgUUID,
	})

	// 4. Create conversation record
	conv, err := s.queries.CreateConversation(ctx, db.CreateConversationParams{
		ConversationID:   pgUUID,
		ConversationType: "DIRECT",
		CreatedBy:        currentUserID,
		Title:            pgtype.Text{Valid: false},
	})
	if err != nil {
		convIDStr := detUUID.String()
		return s.GetConversationDetails(ctx, convIDStr, currentUserID)
	}

	// 5. Add conversation members
	_, _ = s.queries.AddConversationMember(ctx, db.AddConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
		Role:           "MEMBER",
	})
	_, _ = s.queries.AddConversationMember(ctx, db.AddConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         targetUserID,
		Role:           "MEMBER",
	})

	// 6. Seed conversation by user for both
	_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
		UserID:           currentUserID,
		LastMessageAt:    conv.CreatedAt,
		ConversationID:   pgUUID,
		ConversationType: "DIRECT",
	})
	_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
		UserID:           targetUserID,
		LastMessageAt:    conv.CreatedAt,
		ConversationID:   pgUUID,
		ConversationType: "DIRECT",
	})

	convIDStr := detUUID.String()
	isCreated := true
	peerAct, _ := s.GetUserActivity(ctx, targetUserID)
	return &ConversationDto{
		ConversationID:   convIDStr,
		Type:             strings.ToLower(conv.ConversationType),
		ConversationType: conv.ConversationType,
		CreatedBy:        conv.CreatedBy,
		CreatedAt:        conv.CreatedAt.Time,
		Title:            nil,
		MemberIDs:        []int64{currentUserID, targetUserID},
		RecentMessages:   make([]RecentMessageDto, 0),
		PeerActivity:     peerAct,
		Created:          &isCreated,
	}, nil
}

func (s *Service) CreateGroupConversation(ctx context.Context, currentUserID int64, dto CreateGroupDto) (*ConversationDto, error) {
	groupUUID := uuid.New()
	pgUUID := pgtype.UUID{Bytes: groupUUID, Valid: true}

	if s.pool == nil {
		members := append([]int64{currentUserID}, dto.ParticipantIds...)
		return &ConversationDto{
			ConversationID:   groupUUID.String(),
			Type:             "group",
			ConversationType: "GROUP",
			CreatedBy:        currentUserID,
			Title:            &dto.Title,
			MemberIDs:        members,
		}, nil
	}

	conv, err := s.queries.CreateConversation(ctx, db.CreateConversationParams{
		ConversationID:   pgUUID,
		ConversationType: "GROUP",
		CreatedBy:        currentUserID,
		Title:            pgtype.Text{String: dto.Title, Valid: dto.Title != ""},
	})
	if err != nil {
		return nil, err
	}

	// Add owner
	_, _ = s.queries.AddConversationMember(ctx, db.AddConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
		Role:           "OWNER",
	})

	// Upsert group profile
	var gen pgtype.Text
	if dto.Gender != nil {
		gen = pgtype.Text{String: *dto.Gender, Valid: true}
	}
	var minAge, maxAge pgtype.Int4
	if dto.MinimumAge != nil {
		minAge = pgtype.Int4{Int32: int32(*dto.MinimumAge), Valid: true}
	}
	if dto.MaximumAge != nil {
		maxAge = pgtype.Int4{Int32: int32(*dto.MaximumAge), Valid: true}
	}
	var subID, cID pgtype.Int8
	if dto.SubjectID != nil {
		subID = pgtype.Int8{Int64: int64(*dto.SubjectID), Valid: true}
	}
	if dto.CityID != nil {
		cID = pgtype.Int8{Int64: int64(*dto.CityID), Valid: true}
	}
	var bioText, avatarText pgtype.Text
	if dto.Bio != nil {
		bioText = pgtype.Text{String: *dto.Bio, Valid: true}
	}
	if dto.Avatar != nil {
		avatarText = pgtype.Text{String: *dto.Avatar, Valid: true}
	}

	_, _ = s.queries.UpsertGroupProfile(ctx, db.UpsertGroupProfileParams{
		ConversationID: pgUUID,
		OwnerID:        currentUserID,
		Active:         true,
		IsPrivate:      dto.IsPrivate,
		Title:          pgtype.Text{String: dto.Title, Valid: true},
		Bio:            bioText,
		Gender:         gen,
		MinimumAge:     minAge,
		MaximumAge:     maxAge,
		SubjectID:      subID,
		CityID:         cID,
		Avatar:         avatarText,
	})

	memberIDs := []int64{currentUserID}
	for _, pid := range dto.ParticipantIds {
		if pid != currentUserID {
			_, _ = s.queries.AddConversationMember(ctx, db.AddConversationMemberParams{
				ConversationID: pgUUID,
				UserID:         pid,
				Role:           "MEMBER",
			})
			memberIDs = append(memberIDs, pid)

			_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
				UserID:           pid,
				LastMessageAt:    conv.CreatedAt,
				ConversationID:   pgUUID,
				ConversationType: "GROUP",
				Title:            pgtype.Text{String: dto.Title, Valid: true},
			})
		}
	}

	_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
		UserID:           currentUserID,
		LastMessageAt:    conv.CreatedAt,
		ConversationID:   pgUUID,
		ConversationType: "GROUP",
		Title:            pgtype.Text{String: dto.Title, Valid: true},
	})

	var titlePtr *string
	if conv.Title.Valid {
		titlePtr = &conv.Title.String
	}

	isCreated := true
	return &ConversationDto{
		ConversationID:   groupUUID.String(),
		Type:             strings.ToLower(conv.ConversationType),
		ConversationType: conv.ConversationType,
		CreatedBy:        conv.CreatedBy,
		CreatedAt:        conv.CreatedAt.Time,
		Title:            titlePtr,
		MemberIDs:        memberIDs,
		RecentMessages:   make([]RecentMessageDto, 0),
		Created:          &isCreated,
	}, nil
}

func (s *Service) GetConversationDetails(ctx context.Context, conversationID string, currentUserID int64) (*ConversationDto, error) {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	// Verify membership
	_, err = s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
	})
	if err != nil {
		return nil, common.NewAppError(403, common.ErrForbidden, "You are not a member of this conversation")
	}

	conv, err := s.queries.GetConversationByID(ctx, pgUUID)
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, "Conversation not found")
	}

	members, err := s.queries.ListConversationMembers(ctx, pgUUID)
	memberIDs := make([]int64, 0, len(members))
	for _, m := range members {
		memberIDs = append(memberIDs, m.UserID)
	}

	var titlePtr *string
	if conv.Title.Valid {
		titlePtr = &conv.Title.String
	}
	var lastMsgAt *time.Time
	if conv.LastMessageAt.Valid {
		lastMsgAt = &conv.LastMessageAt.Time
	}
	var lastMsgPrev *string
	if conv.LastMessagePreview.Valid {
		lastMsgPrev = &conv.LastMessagePreview.String
	}
	var lastSender *int64
	if conv.LastMessageSenderID.Valid {
		id := conv.LastMessageSenderID.Int64
		lastSender = &id
	}

	var peerActivity *UserActivityDto
	var peerID int64
	for _, id := range memberIDs {
		if id != currentUserID {
			peerID = id
			break
		}
	}
	if strings.EqualFold(conv.ConversationType, "DIRECT") && peerID > 0 {
		peerActivity, _ = s.GetUserActivity(ctx, peerID)
	}

	recent := s.getRecentMessages(ctx, pgUUID)

	var lastMsg *LastMessageDto
	if conv.LastMessagePreview.Valid && conv.LastMessagePreview.String != "" {
		var createdAtStr string
		if conv.LastMessageAt.Valid {
			createdAtStr = conv.LastMessageAt.Time.UTC().Format(time.RFC3339Nano)
		}
		var msgIDStr string
		if conv.LastMessageID.Valid {
			msgIDStr = uuid.UUID(conv.LastMessageID.Bytes).String()
		} else if len(recent) > 0 {
			msgIDStr = recent[len(recent)-1].MessageID
		}
		lastMsg = &LastMessageDto{
			MessageID: msgIDStr,
			SenderID:  conv.LastMessageSenderID.Int64,
			Content:   conv.LastMessagePreview.String,
			CreatedAt: createdAtStr,
			Type:      "text",
		}
	} else if len(recent) > 0 {
		lastRecent := recent[len(recent)-1]
		lastMsg = &LastMessageDto{
			MessageID: lastRecent.MessageID,
			SenderID:  lastRecent.SenderID,
			Content:   lastRecent.Content,
			CreatedAt: lastRecent.CreatedAt,
			Type:      lastRecent.Type,
		}
	}

	isGroup := strings.EqualFold(conv.ConversationType, "GROUP")
	var membersCount *int
	var lastUsers []int64
	if isGroup && len(members) > 0 {
		mc := len(members)
		membersCount = &mc
		lastUsers = make([]int64, 0, 3)
		for i := len(members) - 1; i >= 0 && len(lastUsers) < 3; i-- {
			lastUsers = append(lastUsers, members[i].UserID)
		}
	}

	return &ConversationDto{
		ConversationID:      conversationID,
		Type:                strings.ToLower(conv.ConversationType),
		ConversationType:    conv.ConversationType,
		CreatedBy:           conv.CreatedBy,
		CreatedAt:           conv.CreatedAt.Time,
		Title:               titlePtr,
		LastMessageAt:       lastMsgAt,
		LastMessagePreview:  lastMsgPrev,
		LastMessageSenderID: lastSender,
		LastMessage:         lastMsg,
		MemberIDs:           memberIDs,
		MembersCount:        membersCount,
		LastUsers:           lastUsers,
		RecentMessages:      recent,
		PeerActivity:        peerActivity,
		UnreadCount:         s.GetUnreadCount(ctx, conversationID, currentUserID),
	}, nil
}

func (s *Service) ListConversations(ctx context.Context, currentUserID int64, convType string, limit int) ([]ConversationDto, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	rows, err := s.queries.ListConversationsByUser(ctx, db.ListConversationsByUserParams{
		UserID: currentUserID,
		Limit:  int32(limit),
	})
	if err != nil {
		return nil, err
	}

	res := make([]ConversationDto, 0, len(rows))
	for _, r := range rows {
		if convType != "" && !strings.EqualFold(r.ConversationType, convType) {
			continue
		}

		convUUIDStr := uuid.UUID(r.ConversationID.Bytes).String()
		var titlePtr *string
		if r.Title.Valid {
			titlePtr = &r.Title.String
		}
		var lastMsgPrev *string
		if r.LastMessagePreview.Valid {
			lastMsgPrev = &r.LastMessagePreview.String
		}
		var lastSender *int64
		if r.LastMessageSenderID.Valid {
			id := r.LastMessageSenderID.Int64
			lastSender = &id
		}
		var lastMsgAt *time.Time
		if r.LastMessageAt.Valid {
			lastMsgAt = &r.LastMessageAt.Time
		}

		isGroup := strings.EqualFold(r.ConversationType, "GROUP")
		var membersCount *int
		var lastUsers []int64
		var memberIDs []int64
		var peerActivity *UserActivityDto

		// Fetch members for this conversation
		members, _ := s.queries.ListConversationMembers(ctx, r.ConversationID)
		if len(members) > 0 {
			if isGroup {
				mc := len(members)
				membersCount = &mc
				lastUsers = make([]int64, 0, 3)
				for i := len(members) - 1; i >= 0 && len(lastUsers) < 3; i-- {
					lastUsers = append(lastUsers, members[i].UserID)
				}
			} else {
				for _, m := range members {
					memberIDs = append(memberIDs, m.UserID)
					if m.UserID != currentUserID {
						act, _ := s.GetUserActivity(ctx, m.UserID)
						peerActivity = act
					}
				}
			}
		}

		recent := s.getRecentMessages(ctx, r.ConversationID)

		var lastMsg *LastMessageDto
		if r.LastMessagePreview.Valid && r.LastMessagePreview.String != "" {
			var createdAtStr string
			if r.LastMessageAt.Valid {
				createdAtStr = r.LastMessageAt.Time.UTC().Format(time.RFC3339Nano)
			}
			var msgIDStr string
			if len(recent) > 0 {
				msgIDStr = recent[len(recent)-1].MessageID
			}
			lastMsg = &LastMessageDto{
				MessageID: msgIDStr,
				SenderID:  r.LastMessageSenderID.Int64,
				Content:   r.LastMessagePreview.String,
				CreatedAt: createdAtStr,
				Type:      "text",
			}
		} else if len(recent) > 0 {
			lastRecent := recent[len(recent)-1]
			lastMsg = &LastMessageDto{
				MessageID: lastRecent.MessageID,
				SenderID:  lastRecent.SenderID,
				Content:   lastRecent.Content,
				CreatedAt: lastRecent.CreatedAt,
				Type:      lastRecent.Type,
			}
		}

		res = append(res, ConversationDto{
			ConversationID:      convUUIDStr,
			Type:                strings.ToLower(r.ConversationType),
			ConversationType:    r.ConversationType,
			CreatedBy:           0,
			CreatedAt:           r.LastMessageAt.Time,
			Title:               titlePtr,
			LastMessageAt:       lastMsgAt,
			LastMessagePreview:  lastMsgPrev,
			LastMessageSenderID: lastSender,
			LastMessage:         lastMsg,
			MemberIDs:           memberIDs,
			MembersCount:        membersCount,
			LastUsers:           lastUsers,
			RecentMessages:      recent,
			PeerActivity:        peerActivity,
			UnreadCount:         s.GetUnreadCount(ctx, convUUIDStr, currentUserID),
		})
	}

	return res, nil
}

func (s *Service) GetMessageHistory(ctx context.Context, conversationID string, currentUserID int64, limit int, cursorStr string) (*PaginatedResult[MessageItemDto], error) {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	// Verify membership
	_, err = s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
	})
	if err != nil {
		return nil, common.NewAppError(403, common.ErrForbidden, "You are not a member of this conversation")
	}

	if limit <= 0 || limit > 100 {
		limit = 30
	}

	bucket := common.GetBucket(time.Now().UTC())
	offset := 0

	if cursorStr != "" {
		cursorData, err := common.DecodeCursor(cursorStr)
		if err == nil && cursorData != nil {
			if cursorData.Bucket != "" {
				bucket = cursorData.Bucket
			}
			offset = cursorData.Offset
		}
	}

	deletedForUserMap := make(map[string]struct{})
	if delRows, err := s.queries.ListDeletedMessageIDsForUser(ctx, db.ListDeletedMessageIDsForUserParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
	}); err == nil {
		for _, dm := range delRows {
			deletedForUserMap[uuid.UUID(dm.Bytes).String()] = struct{}{}
		}
	}

	items := make([]MessageItemDto, 0)
	currentBucket := bucket
	bucketOffset := offset
	lookbackDays := 0
	hasMore := false
	var nextCursor *string

	for len(items) < limit && lookbackDays < 30 {
		needed := limit - len(items)
		rows, err := s.queries.ListMessagesByConversationBucket(ctx, db.ListMessagesByConversationBucketParams{
			ConversationID: pgUUID,
			Bucket:         currentBucket,
			Limit:          int32(needed + 1),
			Offset:         int32(bucketOffset),
		})
		if err != nil {
			break
		}

		bucketHasMore := len(rows) > needed
		takeRows := rows
		if bucketHasMore {
			takeRows = rows[:needed]
		}

		for _, r := range takeRows {
			msgUUIDStr := uuid.UUID(r.MessageID.Bytes).String()
			if r.DeletedAt.Valid {
				continue
			}
			if _, ok := deletedForUserMap[msgUUIDStr]; ok {
				continue
			}
			var clientMsgID *string
			if r.ClientMessageID.Valid {
				clientMsgID = &r.ClientMessageID.String
			}
			var urlPtr *string
			if r.MediaUrl.Valid && r.MediaUrl.String != "" {
				u := s.resolveAssetURL(r.MediaUrl.String)
				urlPtr = &u
			}
			var durPtr *float64
			if r.Duration.Valid {
				durPtr = &r.Duration.Float64
			}

			var attachment *MessageAttachmentDto
			normType := normalizeMessageType(r.MessageType)
			if urlPtr != nil {
				var fn *string
				if r.AttachmentName.Valid {
					fn = &r.AttachmentName.String
				}
				var fs *int64
				if r.AttachmentSize.Valid {
					fs = &r.AttachmentSize.Int64
				}
				var mt *string
				if r.MimeType.Valid {
					mt = &r.MimeType.String
				}
				attachment = &MessageAttachmentDto{
					Url:      *urlPtr,
					Type:     normType,
					Duration: durPtr,
					FileName: fn,
					FileSize: fs,
					MimeType: mt,
				}
			}

			items = append(items, MessageItemDto{
				MessageID:       msgUUIDStr,
				ConversationID:  conversationID,
				SenderID:        r.SenderID,
				Content:         r.Content.String,
				CreatedAt:       r.CreatedAt.Time.UTC().Format(time.RFC3339Nano),
				ClientMessageID: clientMsgID,
				Type:            normType,
				Url:             urlPtr,
				Duration:        durPtr,
				Attachment:      attachment,
			})
		}

		if bucketHasMore {
			hasMore = true
			cStr, err := common.EncodeCursor(common.PageCursorData{
				Bucket: currentBucket,
				Offset: bucketOffset + len(takeRows),
				T:      time.Now().UnixMilli(),
			})
			if err == nil {
				nextCursor = &cStr
			}
			break
		}

		// Current bucket exhausted; move to previous day bucket
		currentBucket = common.GetPreviousBucket(currentBucket)
		bucketOffset = 0
		lookbackDays++

		if len(items) >= limit {
			hasMore = true
			cStr, err := common.EncodeCursor(common.PageCursorData{
				Bucket: currentBucket,
				Offset: 0,
				T:      time.Now().UnixMilli(),
			})
			if err == nil {
				nextCursor = &cStr
			}
			break
		}
	}

	return &PaginatedResult[MessageItemDto]{
		Items:      items,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

func normalizeMessageType(t string) string {
	lower := strings.ToLower(strings.TrimSpace(t))
	switch lower {
	case "voice", "audio":
		return "voice"
	case "image", "photo", "picture":
		return "image"
	case "video":
		return "video"
	case "file", "document":
		return "file"
	case "text":
		return "text"
	default:
		if lower == "" {
			return "text"
		}
		return lower
	}
}

type SendMessageResult struct {
	Message          MessageItemDto
	RecipientUserIDs []int64
	IsDuplicate      bool
}

func (s *Service) SendMessage(ctx context.Context, senderID int64, dto SendMessageWsDto) (*SendMessageResult, error) {
	convUUID, err := uuid.Parse(dto.ConversationID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	// 1. Authorize sender membership
	_, err = s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         senderID,
	})
	if err != nil {
		return nil, common.NewAppError(403, common.ErrForbidden, "You are not an authorized member of this conversation")
	}

	// 2. Fetch recipients
	members, err := s.queries.ListConversationMembers(ctx, pgUUID)
	if err != nil {
		return nil, err
	}
	recipients := make([]int64, 0, len(members))
	for _, m := range members {
		recipients = append(recipients, m.UserID)
	}

	// Check if this is a direct conversation and whether sender is blocked
	if s.queries != nil {
		convRow, _ := s.queries.GetConversationByID(ctx, pgUUID)
		if strings.EqualFold(convRow.ConversationType, "direct") {
			for _, rID := range recipients {
				if rID != senderID && s.IsBlocked(ctx, senderID, rID) {
					return nil, common.NewAppError(http.StatusForbidden, common.ErrForbidden, "You cannot send messages to this user because of block settings")
				}
			}
		}
	}

	// 3. Resolve media & type
	mediaUrl := dto.Url
	if mediaUrl == "" && dto.Attachment != nil {
		mediaUrl = dto.Attachment.Url
	}
	hasAttachment := mediaUrl != ""

	if strings.TrimSpace(dto.Content) == "" && !hasAttachment {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Message content cannot be empty without attachment")
	}

	msgType := "text"
	if dto.Type != "" {
		msgType = normalizeMessageType(dto.Type)
	} else if hasAttachment {
		msgType = "file"
	}
	if dto.Duration != nil && *dto.Duration > 0 && (msgType == "text" || msgType == "file") {
		msgType = "voice"
	}

	if hasAttachment {
		if dto.Attachment == nil {
			dto.Attachment = &MessageAttachmentDto{
				Url:      mediaUrl,
				Type:     msgType,
				Duration: dto.Duration,
			}
		} else {
			dto.Attachment.Type = msgType
			if dto.Attachment.Url == "" {
				dto.Attachment.Url = mediaUrl
			}
			if dto.Attachment.Duration == nil {
				dto.Attachment.Duration = dto.Duration
			}
		}
	}

	now := time.Now().UTC()
	bucket := common.GetBucket(now)
	generatedMsgUUID := uuid.New()
	pgMsgUUID := pgtype.UUID{Bytes: generatedMsgUUID, Valid: true}

	// 4. Idempotency registration
	idemRow, err := s.queries.CreateMessageIdempotent(ctx, db.CreateMessageIdempotentParams{
		ConversationID:  pgUUID,
		SenderID:        senderID,
		ClientMessageID: dto.ClientMessageID,
		MessageID:       pgMsgUUID,
		CreatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
	})

	if err != nil || !idemRow.MessageID.Valid {
		existing, getErr := s.queries.GetMessageIdempotency(ctx, db.GetMessageIdempotencyParams{
			ConversationID:  pgUUID,
			SenderID:        senderID,
			ClientMessageID: dto.ClientMessageID,
		})
		if getErr == nil {
			exMsgUUID := uuid.UUID(existing.MessageID.Bytes).String()
			var exUrlPtr *string
			if mediaUrl != "" {
				u := s.resolveAssetURL(mediaUrl)
				exUrlPtr = &u
				if dto.Attachment != nil {
					dto.Attachment.Url = u
				}
			}
			return &SendMessageResult{
				Message: MessageItemDto{
					MessageID:       exMsgUUID,
					ConversationID:  dto.ConversationID,
					SenderID:        senderID,
					Content:         dto.Content,
					CreatedAt:       existing.CreatedAt.Time.Format(time.RFC3339Nano),
					ClientMessageID: &dto.ClientMessageID,
					Type:            msgType,
					Url:             exUrlPtr,
					Duration:        dto.Duration,
					Attachment:      dto.Attachment,
				},
				RecipientUserIDs: recipients,
				IsDuplicate:      true,
			}, nil
		}
	}

	// 5. Insert message into messages_by_conversation
	var dur pgtype.Float8
	if dto.Duration != nil {
		dur = pgtype.Float8{Float64: *dto.Duration, Valid: true}
	}
	var attachName, mimeType pgtype.Text
	var attachSize pgtype.Int8
	if dto.Attachment != nil {
		if dto.Attachment.FileName != nil {
			attachName = pgtype.Text{String: *dto.Attachment.FileName, Valid: true}
		}
		if dto.Attachment.FileSize != nil {
			attachSize = pgtype.Int8{Int64: *dto.Attachment.FileSize, Valid: true}
		}
		if dto.Attachment.MimeType != nil {
			mimeType = pgtype.Text{String: *dto.Attachment.MimeType, Valid: true}
		}
	}

	inserted, err := s.queries.InsertMessage(ctx, db.InsertMessageParams{
		ConversationID:  pgUUID,
		Bucket:          bucket,
		CreatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
		MessageID:       pgMsgUUID,
		SenderID:        senderID,
		Content:         pgtype.Text{String: dto.Content, Valid: true},
		ClientMessageID: pgtype.Text{String: dto.ClientMessageID, Valid: true},
		MessageType:     msgType,
		MediaUrl:        pgtype.Text{String: mediaUrl, Valid: mediaUrl != ""},
		Duration:        dur,
		AttachmentName:  attachName,
		AttachmentSize:  attachSize,
		MimeType:        mimeType,
	})
	if err != nil {
		return nil, err
	}

	// 6. Update conversation last message
	preview := dto.Content
	if preview == "" && hasAttachment {
		switch msgType {
		case "voice":
			preview = "[Voice message]"
		case "image":
			preview = "[Photo]"
		case "video":
			preview = "[Video]"
		default:
			preview = "[Attachment]"
		}
	}
	if len(preview) > 100 {
		preview = preview[:100]
	}

	_ = s.queries.UpdateConversationLastMessage(ctx, db.UpdateConversationLastMessageParams{
		ConversationID:      pgUUID,
		LastMessageAt:       pgtype.Timestamptz{Time: now, Valid: true},
		LastMessageID:       pgMsgUUID,
		LastMessageSenderID: pgtype.Int8{Int64: senderID, Valid: true},
		LastMessagePreview:  pgtype.Text{String: preview, Valid: true},
	})

	conv, _ := s.queries.GetConversationByID(ctx, pgUUID)
	convType := "DIRECT"
	var convTitle pgtype.Text
	if conv.ConversationType != "" {
		convType = conv.ConversationType
		convTitle = conv.Title
	}

	// 7. Update conversations_by_user and increment unread count for other members
	for _, rID := range recipients {
		_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
			UserID:              rID,
			LastMessageAt:       pgtype.Timestamptz{Time: now, Valid: true},
			ConversationID:      pgUUID,
			ConversationType:    convType,
			LastMessagePreview:  pgtype.Text{String: preview, Valid: true},
			LastMessageSenderID: pgtype.Int8{Int64: senderID, Valid: true},
			Title:               convTitle,
		})

		if rID != senderID {
			_ = s.queries.IncrementConversationUnread(ctx, db.IncrementConversationUnreadParams{
				ConversationID: pgUUID,
				UserID:         rID,
			})
		}
	}

	// 8. Dispatch Push Notification to other members (unless blocked)
	if s.dispatcher != nil {
		senderTitle := dto.SenderName
		if senderTitle == "" {
			if senderProf, err := s.queries.GetProfileByUserID(ctx, int32(senderID)); err == nil {
				if senderProf.FirstName != "" {
					senderTitle = senderProf.FirstName
				} else if senderProf.Username.Valid && senderProf.Username.String != "" {
					senderTitle = senderProf.Username.String
				}
			}
		}
		if senderTitle == "" {
			senderTitle = "New message"
		}

		for _, rID := range recipients {
			if rID != senderID {
				if s.IsBlocked(ctx, senderID, rID) {
					continue
				}
				recID := rID
				s.dispatcher.Enqueue(fcm.NotificationJob{
					UserID: &recID,
					Title:  senderTitle,
					Body:   preview,
					Data: map[string]interface{}{
						"conversationId": dto.ConversationID,
						"messageId":      generatedMsgUUID.String(),
						"type":           "NEW_MESSAGE",
						"thread-id":      dto.ConversationID,
					},
				})
			}
		}
	}

	var urlPtr *string
	if mediaUrl != "" {
		u := s.resolveAssetURL(mediaUrl)
		urlPtr = &u
		if dto.Attachment != nil {
			dto.Attachment.Url = u
		}
	}

	return &SendMessageResult{
		Message: MessageItemDto{
			MessageID:       generatedMsgUUID.String(),
			ConversationID:  dto.ConversationID,
			SenderID:        senderID,
			Content:         dto.Content,
			CreatedAt:       inserted.CreatedAt.Time.UTC().Format(time.RFC3339Nano),
			ClientMessageID: &dto.ClientMessageID,
			Type:            msgType,
			Url:             urlPtr,
			Duration:        dto.Duration,
			Attachment:      dto.Attachment,
		},
		RecipientUserIDs: recipients,
		IsDuplicate:      false,
	}, nil
}

func (s *Service) GetGroup(ctx context.Context, conversationID string, currentUserID int64) (*GroupResponseDto, error) {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	grp, err := s.queries.GetGroupProfileByID(ctx, pgUUID)
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, "Group not found")
	}

	mem, err := s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
	})
	membershipStatus := "none"
	role := ""
	if err == nil {
		membershipStatus = "active"
		role = mem.Role
	}

	var bio, avatar *string
	if grp.Bio.Valid {
		bio = &grp.Bio.String
	}
	if grp.Avatar.Valid && grp.Avatar.String != "" {
		u := s.resolveAssetURL(grp.Avatar.String)
		avatar = &u
	}

	return &GroupResponseDto{
		ConversationID:   conversationID,
		Title:            grp.Title.String,
		Bio:              bio,
		Avatar:           avatar,
		OwnerID:          int64(grp.OwnerID),
		IsPrivate:        grp.IsPrivate,
		Active:           grp.Active,
		MembershipStatus: membershipStatus,
		Role:             role,
		CreatedAt:        grp.CreatedAt.Time,
		UpdatedAt:        grp.UpdatedAt.Time,
	}, nil
}

func (s *Service) UpdateGroup(ctx context.Context, conversationID string, currentUserID int64, dto UpdateGroupDto) (*GroupResponseDto, error) {
	grp, err := s.GetGroup(ctx, conversationID, currentUserID)
	if err != nil {
		return nil, err
	}

	if grp.OwnerID != currentUserID {
		return nil, common.NewAppError(403, common.ErrForbidden, "Caller is not the group owner")
	}

	convUUID, _ := uuid.Parse(conversationID)
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	title := grp.Title
	if dto.Title != nil {
		title = *dto.Title
	}
	var bioText pgtype.Text
	if dto.Bio != nil {
		bioText = pgtype.Text{String: *dto.Bio, Valid: true}
	} else if grp.Bio != nil {
		bioText = pgtype.Text{String: *grp.Bio, Valid: true}
	}
	var avatarText pgtype.Text
	if dto.Avatar != nil {
		avatarText = pgtype.Text{String: *dto.Avatar, Valid: true}
	} else if grp.Avatar != nil {
		avatarText = pgtype.Text{String: *grp.Avatar, Valid: true}
	}
	isPrivate := grp.IsPrivate
	if dto.IsPrivate != nil {
		isPrivate = *dto.IsPrivate
	}
	active := grp.Active
	if dto.Active != nil {
		active = *dto.Active
	}

	_, err = s.queries.UpsertGroupProfile(ctx, db.UpsertGroupProfileParams{
		ConversationID: pgUUID,
		OwnerID:        currentUserID,
		Active:         active,
		IsPrivate:      isPrivate,
		Title:          pgtype.Text{String: title, Valid: true},
		Bio:            bioText,
		Avatar:         avatarText,
	})
	if err != nil {
		return nil, err
	}

	return s.GetGroup(ctx, conversationID, currentUserID)
}

func (s *Service) JoinGroup(ctx context.Context, conversationID string, currentUserID int64) (*GroupResponseDto, error) {
	grp, err := s.GetGroup(ctx, conversationID, currentUserID)
	if err != nil {
		return nil, err
	}

	convUUID, _ := uuid.Parse(conversationID)
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	_, _ = s.queries.AddConversationMember(ctx, db.AddConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
		Role:           "MEMBER",
	})

	_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
		UserID:           currentUserID,
		LastMessageAt:    pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		ConversationID:   pgUUID,
		ConversationType: "GROUP",
		Title:            pgtype.Text{String: grp.Title, Valid: true},
	})

	return s.GetGroup(ctx, conversationID, currentUserID)
}

func (s *Service) BanGroupUser(ctx context.Context, conversationID string, currentUserID, targetUserID int64, reason *string) error {
	grp, err := s.GetGroup(ctx, conversationID, currentUserID)
	if err != nil {
		return err
	}

	if grp.OwnerID != currentUserID {
		return common.NewAppError(403, common.ErrForbidden, "Only the group owner can ban members")
	}
	if grp.OwnerID == targetUserID {
		return common.NewAppError(400, common.ErrBadRequest, "The owner cannot be banned")
	}

	convUUID, _ := uuid.Parse(conversationID)
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	return s.queries.RemoveConversationMember(ctx, db.RemoveConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         targetUserID,
	})
}

func (s *Service) AddGroupMember(ctx context.Context, conversationID string, currentUserID, targetUserID int64) (*GroupResponseDto, error) {
	grp, err := s.GetGroup(ctx, conversationID, currentUserID)
	if err != nil {
		return nil, err
	}

	if grp.OwnerID != currentUserID {
		return nil, common.NewAppError(403, common.ErrForbidden, "Only the group owner can add members")
	}

	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	_, _ = s.queries.AddConversationMember(ctx, db.AddConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         targetUserID,
		Role:           "MEMBER",
	})

	_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
		UserID:           targetUserID,
		LastMessageAt:    pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		ConversationID:   pgUUID,
		ConversationType: "GROUP",
		Title:            pgtype.Text{String: grp.Title, Valid: true},
	})

	return s.GetGroup(ctx, conversationID, currentUserID)
}

func (s *Service) RemoveGroupMember(ctx context.Context, conversationID string, currentUserID, targetUserID int64) error {
	grp, err := s.GetGroup(ctx, conversationID, currentUserID)
	if err != nil {
		return err
	}

	if grp.OwnerID != currentUserID && currentUserID != targetUserID {
		return common.NewAppError(403, common.ErrForbidden, "Only the group owner can remove members")
	}
	if grp.OwnerID == targetUserID {
		return common.NewAppError(400, common.ErrBadRequest, "The owner cannot be removed")
	}

	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	return s.queries.RemoveConversationMember(ctx, db.RemoveConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         targetUserID,
	})
}

func (s *Service) UnbanGroupUser(ctx context.Context, conversationID string, currentUserID, targetUserID int64) error {
	grp, err := s.GetGroup(ctx, conversationID, currentUserID)
	if err != nil {
		return err
	}

	if grp.OwnerID != currentUserID {
		return common.NewAppError(403, common.ErrForbidden, "Only the group owner can unban users")
	}

	return nil
}

func (s *Service) GetUserActivity(ctx context.Context, userID int64) (*UserActivityDto, error) {
	pres, err := s.queries.GetUserPresence(ctx, userID)
	if err != nil {
		return &UserActivityDto{
			UserID:   userID,
			IsOnline: false,
		}, nil
	}

	var lastSeen *string
	if pres.LastSeenAt.Valid {
		ls := pres.LastSeenAt.Time.UTC().Format(time.RFC3339)
		lastSeen = &ls
	}

	return &UserActivityDto{
		UserID:     userID,
		IsOnline:   pres.IsOnline,
		LastSeenAt: lastSeen,
	}, nil
}

func (s *Service) GetBatchUserActivity(ctx context.Context, userIDs []int64) ([]UserActivityDto, error) {
	rows, err := s.queries.GetUserPresenceBatch(ctx, userIDs)
	if err != nil {
		return nil, err
	}

	resMap := make(map[int64]UserActivityDto, len(userIDs))
	for _, r := range rows {
		var lastSeen *string
		if r.LastSeenAt.Valid {
			ls := r.LastSeenAt.Time.UTC().Format(time.RFC3339)
			lastSeen = &ls
		}
		resMap[r.UserID] = UserActivityDto{
			UserID:     r.UserID,
			IsOnline:   r.IsOnline,
			LastSeenAt: lastSeen,
		}
	}

	var res []UserActivityDto
	for _, id := range userIDs {
		if act, ok := resMap[id]; ok {
			res = append(res, act)
		} else {
			res = append(res, UserActivityDto{
				UserID:   id,
				IsOnline: false,
			})
		}
	}

	return res, nil
}

func (s *Service) SetUserPresence(ctx context.Context, userID int64, isOnline bool) error {
	return s.queries.UpsertUserPresence(ctx, db.UpsertUserPresenceParams{
		UserID:     userID,
		IsOnline:   isOnline,
		LastSeenAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	})
}

func (s *Service) ListGroupParticipants(ctx context.Context, conversationID string, currentUserID int64) ([]GroupParticipantResponseDto, error) {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	_, err = s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
	})
	if err != nil {
		return nil, common.NewAppError(403, common.ErrForbidden, "You are not a member of this group")
	}

	members, err := s.queries.ListConversationMembers(ctx, pgUUID)
	if err != nil {
		return nil, err
	}

	result := make([]GroupParticipantResponseDto, 0, len(members))
	for _, m := range members {
		result = append(result, GroupParticipantResponseDto{
			UserID:   m.UserID,
			Status:   "ACTIVE",
			Role:     m.Role,
			JoinedAt: m.JoinedAt.Time,
		})
	}
	return result, nil
}

func (s *Service) GetGroupParticipant(ctx context.Context, conversationID string, currentUserID, targetUserID int64) (*GroupParticipantResponseDto, error) {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	_, err = s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
	})
	if err != nil {
		return nil, common.NewAppError(403, common.ErrForbidden, "You are not a member of this group")
	}

	m, err := s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         targetUserID,
	})
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, "Participant not found in this group")
	}

	return &GroupParticipantResponseDto{
		UserID:   m.UserID,
		Status:   "ACTIVE",
		Role:     m.Role,
		JoinedAt: m.JoinedAt.Time,
	}, nil
}

func (s *Service) AcceptGroupInvitation(ctx context.Context, conversationID string, currentUserID int64) error {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	conv, err := s.queries.GetConversationByID(ctx, pgUUID)
	if err != nil {
		return common.NewAppError(404, common.ErrNotFound, "Group conversation not found")
	}

	_, _ = s.queries.AddConversationMember(ctx, db.AddConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
		Role:           "MEMBER",
	})

	_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
		UserID:           currentUserID,
		LastMessageAt:    pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		ConversationID:   pgUUID,
		ConversationType: "GROUP",
		Title:            conv.Title,
	})

	return nil
}

func (s *Service) ApproveJoinRequest(ctx context.Context, conversationID string, currentUserID, applicantID int64) error {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return common.NewAppError(400, common.ErrBadRequest, "Invalid conversation UUID")
	}
	pgUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	member, err := s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         currentUserID,
	})
	if err != nil || (member.Role != "ADMIN" && member.Role != "OWNER") {
		return common.NewAppError(403, common.ErrForbidden, "Only group administrators or owners can approve join requests")
	}

	conv, err := s.queries.GetConversationByID(ctx, pgUUID)
	if err != nil {
		return common.NewAppError(404, common.ErrNotFound, "Group conversation not found")
	}

	_, _ = s.queries.AddConversationMember(ctx, db.AddConversationMemberParams{
		ConversationID: pgUUID,
		UserID:         applicantID,
		Role:           "MEMBER",
	})

	_ = s.queries.UpsertConversationByUser(ctx, db.UpsertConversationByUserParams{
		UserID:           applicantID,
		LastMessageAt:    pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		ConversationID:   pgUUID,
		ConversationType: "GROUP",
		Title:            conv.Title,
	})

	return nil
}

func (s *Service) IsBlocked(ctx context.Context, userA, userB int64) bool {
	if s.pool == nil || userA == userB {
		return false
	}
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM blocked_users
			WHERE (blocker_id = $1 AND blocked_id = $2)
			   OR (blocker_id = $2 AND blocked_id = $1)
		)
	`, userA, userB).Scan(&exists)
	if err != nil {
		return false
	}
	return exists
}

func (s *Service) BlockUser(ctx context.Context, blockerID, blockedID int64, reason string) error {
	if blockerID == blockedID {
		return common.NewAppError(http.StatusBadRequest, common.ErrBadRequest, "You cannot block yourself")
	}
	if s.pool == nil {
		return nil
	}
	var reasonText pgtype.Text
	if reason != "" {
		reasonText = pgtype.Text{String: reason, Valid: true}
	}
	err := s.queries.BlockUser(ctx, db.BlockUserParams{
		BlockerID: blockerID,
		BlockedID: blockedID,
		Reason:    reasonText,
	})
	if err == nil && s.broadcaster != nil {
		s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", blockerID), "user.blocked", map[string]interface{}{
			"userId":    blockedID,
			"blockedBy": blockerID,
		})
		s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", blockedID), "user.blocked", map[string]interface{}{
			"userId":    blockedID,
			"blockedBy": blockerID,
		})
	}
	return err
}

func (s *Service) UnblockUser(ctx context.Context, blockerID, blockedID int64) error {
	if blockerID == blockedID {
		return common.NewAppError(http.StatusBadRequest, common.ErrBadRequest, "Invalid operation")
	}
	if s.pool == nil {
		return nil
	}
	err := s.queries.UnblockUser(ctx, db.UnblockUserParams{
		BlockerID: blockerID,
		BlockedID: blockedID,
	})
	if err == nil && s.broadcaster != nil {
		s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", blockerID), "user.unblocked", map[string]interface{}{
			"userId":      blockedID,
			"unblockedBy": blockerID,
		})
		s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", blockedID), "user.unblocked", map[string]interface{}{
			"userId":      blockedID,
			"unblockedBy": blockerID,
		})
	}
	return err
}

func (s *Service) MarkConversationAsRead(ctx context.Context, conversationID string, userID int64, messageID *string) error {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return common.NewAppError(http.StatusBadRequest, common.ErrBadRequest, "Invalid conversation UUID")
	}
	if s.pool == nil {
		return nil
	}
	pgConvUUID := pgtype.UUID{Bytes: convUUID, Valid: true}

	var pgMsgUUID pgtype.UUID
	if messageID != nil && *messageID != "" {
		if mUUID, err := uuid.Parse(*messageID); err == nil {
			pgMsgUUID = pgtype.UUID{Bytes: mUUID, Valid: true}
		}
	}

	err = s.queries.MarkConversationRead(ctx, db.MarkConversationReadParams{
		ConversationID:    pgConvUUID,
		UserID:            userID,
		LastReadMessageID: pgMsgUUID,
	})
	if err == nil && s.broadcaster != nil {
		s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", userID), "conversation.read", map[string]interface{}{
			"conversationId": conversationID,
			"unreadCount":    0,
		})
	}
	return err
}

func (s *Service) GetUnreadCount(ctx context.Context, conversationID string, userID int64) int {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil || s.pool == nil {
		return 0
	}
	count, err := s.queries.GetConversationUnreadCount(ctx, db.GetConversationUnreadCountParams{
		ConversationID: pgtype.UUID{Bytes: convUUID, Valid: true},
		UserID:         userID,
	})
	if err != nil {
		return 0
	}
	return int(count)
}

func (s *Service) DeleteMessage(ctx context.Context, conversationID, messageID string, userID int64, forEveryone bool) error {
	convUUID, err := uuid.Parse(conversationID)
	if err != nil {
		return common.NewAppError(http.StatusBadRequest, common.ErrBadRequest, "Invalid conversation UUID")
	}
	msgUUID, err := uuid.Parse(messageID)
	if err != nil {
		return common.NewAppError(http.StatusBadRequest, common.ErrBadRequest, "Invalid message UUID")
	}
	if s.pool == nil {
		return nil
	}
	pgConvUUID := pgtype.UUID{Bytes: convUUID, Valid: true}
	pgMsgUUID := pgtype.UUID{Bytes: msgUUID, Valid: true}

	// 1. Authorize member
	member, err := s.queries.GetConversationMember(ctx, db.GetConversationMemberParams{
		ConversationID: pgConvUUID,
		UserID:         userID,
	})
	if err != nil {
		return common.NewAppError(http.StatusForbidden, common.ErrForbidden, "You are not a member of this conversation")
	}

	if forEveryone {
		// Verify requesting user is the sender of the message OR OWNER/ADMIN of group
		var senderID int64
		err := s.pool.QueryRow(ctx, `
			SELECT sender_id FROM messages_by_conversation
			WHERE conversation_id = $1 AND message_id = $2
		`, pgConvUUID, pgMsgUUID).Scan(&senderID)
		if err != nil {
			return common.NewAppError(http.StatusNotFound, common.ErrNotFound, "Message not found")
		}

		isSender := (senderID == userID)
		isAdmin := (member.Role == "OWNER" || member.Role == "ADMIN")
		if !isSender && !isAdmin {
			return common.NewAppError(http.StatusForbidden, common.ErrForbidden, "Only the message sender or group admin can delete for everyone")
		}

		// Delete for everyone
		err = s.queries.DeleteMessageForEveryone(ctx, db.DeleteMessageForEveryoneParams{
			ConversationID: pgConvUUID,
			MessageID:      pgMsgUUID,
			DeletedBy:      pgtype.Int8{Int64: userID, Valid: true},
		})
		if err != nil {
			return err
		}

		s.recalculateConversationLastMessage(ctx, pgConvUUID)
		if s.broadcaster != nil {
			s.broadcaster.BroadcastToRoom("conversation:"+conversationID, "message.deleted", map[string]interface{}{
				"conversationId": conversationID,
				"messageId":      messageID,
				"forEveryone":    true,
			})
			latest, errL := s.queries.GetLatestMessageInConversation(ctx, pgConvUUID)
			var lastMsg map[string]interface{}
			if errL == nil {
				lastMsg = map[string]interface{}{
					"messageId": uuid.UUID(latest.MessageID.Bytes).String(),
					"content":   latest.Content.String,
					"type":      latest.MessageType,
				}
			}
			s.broadcaster.BroadcastToRoom("conversation:"+conversationID, "conversation.updated", map[string]interface{}{
				"conversationId": conversationID,
				"lastMessage":    lastMsg,
			})
		}
		return nil
	}

	// Delete for me
	err = s.queries.DeleteMessageForUser(ctx, db.DeleteMessageForUserParams{
		ConversationID: pgConvUUID,
		MessageID:      pgMsgUUID,
		UserID:         userID,
	})
	if err == nil && s.broadcaster != nil {
		s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", userID), "message.deleted", map[string]interface{}{
			"conversationId": conversationID,
			"messageId":      messageID,
			"forEveryone":    false,
		})
	}
	return err
}

func (s *Service) recalculateConversationLastMessage(ctx context.Context, convUUID pgtype.UUID) {
	latest, err := s.queries.GetLatestMessageInConversation(ctx, convUUID)
	if err != nil {
		_, _ = s.pool.Exec(ctx, `
			UPDATE conversations
			SET last_message_preview = NULL, last_message_id = NULL, last_message_sender_id = NULL
			WHERE conversation_id = $1
		`, convUUID)
		_, _ = s.pool.Exec(ctx, `
			UPDATE conversations_by_user
			SET last_message_preview = NULL, last_message_sender_id = NULL
			WHERE conversation_id = $1
		`, convUUID)
		return
	}

	preview := latest.Content.String
	if preview == "" && latest.MediaUrl.Valid && latest.MediaUrl.String != "" {
		preview = formatMediaPreview(latest.MessageType, latest.AttachmentName.String)
	}

	_, _ = s.pool.Exec(ctx, `
		UPDATE conversations
		SET last_message_at = $2, last_message_preview = $3, last_message_id = $4, last_message_sender_id = $5
		WHERE conversation_id = $1
	`, convUUID, latest.CreatedAt, preview, latest.MessageID, latest.SenderID)

	_, _ = s.pool.Exec(ctx, `
		UPDATE conversations_by_user
		SET last_message_at = $2, last_message_preview = $3, last_message_sender_id = $4
		WHERE conversation_id = $1
	`, convUUID, latest.CreatedAt, preview, latest.SenderID)
}

func formatMediaPreview(msgType, fileName string) string {
	switch msgType {
	case "voice":
		return "[Voice message]"
	case "image", "photo":
		return "[Photo]"
	case "video":
		return "[Video]"
	default:
		if fileName != "" {
			return "[" + fileName + "]"
		}
		return "[Attachment]"
	}
}
