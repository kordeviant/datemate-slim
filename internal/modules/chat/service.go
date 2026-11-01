package chat

import (
	"context"
	"fmt"
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

type Service struct {
	cfg        *config.Config
	pool       *pgxpool.Pool
	queries    *db.Queries
	rdb        *platformRedis.Client
	dispatcher *fcm.Dispatcher
	storage    storage.Engine
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
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw
	}
	clean := strings.TrimPrefix(raw, "/")
	return fmt.Sprintf("%s/%s", strings.TrimRight(s.cfg.AssetBaseURL, "/"), clean)
}

func (s *Service) CreateDirectConversation(ctx context.Context, currentUserID, targetUserID int64) (*ConversationDto, error) {
	if currentUserID == targetUserID {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Self-conversation is not allowed")
	}

	pairKey, err := common.CreatePairKey(currentUserID, targetUserID)
	if err != nil {
		return nil, common.NewAppError(400, common.ErrBadRequest, err.Error())
	}

	// 1. Check existing direct conversation pair
	existingPair, err := s.queries.GetDirectConversationPair(ctx, pairKey)
	if err == nil {
		convIDStr := uuid.UUID(existingPair.ConversationID.Bytes).String()
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
	return &ConversationDto{
		ConversationID:   convIDStr,
		ConversationType: conv.ConversationType,
		CreatedBy:        conv.CreatedBy,
		CreatedAt:        conv.CreatedAt.Time,
		MemberIDs:        []int64{currentUserID, targetUserID},
	}, nil
}

func (s *Service) CreateGroupConversation(ctx context.Context, currentUserID int64, dto CreateGroupDto) (*ConversationDto, error) {
	groupUUID := uuid.New()
	pgUUID := pgtype.UUID{Bytes: groupUUID, Valid: true}

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

	return &ConversationDto{
		ConversationID:   groupUUID.String(),
		ConversationType: conv.ConversationType,
		CreatedBy:        conv.CreatedBy,
		CreatedAt:        conv.CreatedAt.Time,
		Title:            titlePtr,
		MemberIDs:        memberIDs,
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

	return &ConversationDto{
		ConversationID:      conversationID,
		ConversationType:    conv.ConversationType,
		CreatedBy:           conv.CreatedBy,
		CreatedAt:           conv.CreatedAt.Time,
		Title:               titlePtr,
		LastMessageAt:       lastMsgAt,
		LastMessagePreview:  lastMsgPrev,
		LastMessageSenderID: lastSender,
		MemberIDs:           memberIDs,
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

	var res []ConversationDto
	for _, r := range rows {
		if convType != "" && r.ConversationType != convType {
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

		res = append(res, ConversationDto{
			ConversationID:      convUUIDStr,
			ConversationType:    r.ConversationType,
			CreatedBy:           0,
			CreatedAt:           r.LastMessageAt.Time,
			Title:               titlePtr,
			LastMessageAt:       lastMsgAt,
			LastMessagePreview:  lastMsgPrev,
			LastMessageSenderID: lastSender,
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

	var items []MessageItemDto
	currentBucket := bucket
	lookbackDays := 0

	for len(items) < limit && lookbackDays < 30 {
		rows, err := s.queries.ListMessagesByConversationBucket(ctx, db.ListMessagesByConversationBucketParams{
			ConversationID: pgUUID,
			Bucket:         currentBucket,
			Limit:          int32(limit - len(items) + 1),
		})
		if err != nil {
			break
		}

		if offset > 0 && len(rows) > 0 {
			if offset >= len(rows) {
				rows = nil
			} else {
				rows = rows[offset:]
			}
			offset = 0
		}

		for _, r := range rows {
			msgUUIDStr := uuid.UUID(r.MessageID.Bytes).String()
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
					Type:     r.MessageType,
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
				Type:            r.MessageType,
				Url:             urlPtr,
				Duration:        durPtr,
				Attachment:      attachment,
			})

			if len(items) >= limit {
				break
			}
		}

		currentBucket = common.GetPreviousBucket(currentBucket)
		lookbackDays++
	}

	var nextCursor *string
	hasMore := false
	if len(items) >= limit {
		hasMore = true
		cStr, err := common.EncodeCursor(common.PageCursorData{
			Bucket: currentBucket,
			Offset: len(items),
			T:      time.Now().UnixMilli(),
		})
		if err == nil {
			nextCursor = &cStr
		}
	}

	return &PaginatedResult[MessageItemDto]{
		Items:      items,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
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

	// 3. Resolve media & type
	mediaUrl := dto.Url
	if mediaUrl == "" && dto.Attachment != nil {
		mediaUrl = dto.Attachment.Url
	}
	hasAttachment := mediaUrl != ""

	if strings.TrimSpace(dto.Content) == "" && !hasAttachment {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Message content cannot be empty without attachment")
	}

	msgType := "TEXT"
	if dto.Type != "" {
		msgType = strings.ToUpper(dto.Type)
	} else if hasAttachment {
		msgType = "FILE"
	}
	if dto.Duration != nil && *dto.Duration > 0 {
		msgType = "VOICE"
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
			return &SendMessageResult{
				Message: MessageItemDto{
					MessageID:       exMsgUUID,
					ConversationID:  dto.ConversationID,
					SenderID:        senderID,
					Content:         dto.Content,
					CreatedAt:       existing.CreatedAt.Time.Format(time.RFC3339Nano),
					ClientMessageID: &dto.ClientMessageID,
					Type:            msgType,
					Url:             &mediaUrl,
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
		preview = fmt.Sprintf("[%s]", msgType)
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

	// 7. Update conversations_by_user for all members
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
	}

	// 8. Dispatch Push Notification to other members
	if s.dispatcher != nil {
		for _, rID := range recipients {
			if rID != senderID {
				recID := rID
				s.dispatcher.Enqueue(fcm.NotificationJob{
					UserID: &recID,
					Title:  dto.SenderName,
					Body:   preview,
					Data: map[string]interface{}{
						"conversationId": dto.ConversationID,
						"messageId":      generatedMsgUUID.String(),
						"type":           "NEW_MESSAGE",
					},
				})
			}
		}
	}

	var urlPtr *string
	if mediaUrl != "" {
		u := s.resolveAssetURL(mediaUrl)
		urlPtr = &u
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
