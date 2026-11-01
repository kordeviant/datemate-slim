package friends

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/platform/database/db"
	"datemate/internal/platform/fcm"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	cfg        *config.Config
	pool       *pgxpool.Pool
	queries    *db.Queries
	dispatcher *fcm.Dispatcher
}

func NewService(cfg *config.Config, pool *pgxpool.Pool, dispatcher *fcm.Dispatcher) *Service {
	return &Service{
		cfg:        cfg,
		pool:       pool,
		queries:    db.New(pool),
		dispatcher: dispatcher,
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

func (s *Service) AddFriend(ctx context.Context, currentUserID, targetUserID int64) (*FriendItemDto, string, error) {
	if currentUserID == targetUserID {
		return nil, "", common.NewAppError(400, common.ErrBadRequest, "You cannot add yourself as a friend")
	}

	// 1. Check current user status
	currentUser, err := s.queries.GetUserByID(ctx, int32(currentUserID))
	if err != nil {
		return nil, "", common.NewAppError(404, common.ErrNotFound, "User not found")
	}
	if currentUser.BannedUntil.Valid && currentUser.BannedUntil.Time.After(time.Now().UTC()) {
		return nil, "", common.NewAppError(403, common.ErrForbidden, "Your account is suspended")
	}

	// 2. Check target user status
	targetUser, err := s.queries.GetUserByID(ctx, int32(targetUserID))
	if err != nil {
		return nil, "", common.NewAppError(404, common.ErrNotFound, "Target user not found")
	}
	if targetUser.BannedUntil.Valid && targetUser.BannedUntil.Time.After(time.Now().UTC()) {
		return nil, "", common.NewAppError(403, common.ErrForbidden, "Target user is banned")
	}

	// 3. Check existing friend request between users
	existing, err := s.queries.GetFriendRequestBetween(ctx, db.GetFriendRequestBetweenParams{
		SenderID:   int32(currentUserID),
		ReceiverID: int32(targetUserID),
	})

	if err == nil {
		if existing.Status == db.FriendRequestStatusACCEPTED {
			return nil, "", common.NewAppError(400, common.ErrBadRequest, "You are already friends with this user")
		}

		// If current user already sent a pending request
		if int64(existing.SenderID) == currentUserID && existing.Status == db.FriendRequestStatusPENDING {
			return nil, "", common.NewAppError(400, common.ErrBadRequest, "Friend request already sent")
		}

		// If target user sent a pending request -> auto-accept
		if int64(existing.SenderID) == targetUserID && existing.Status == db.FriendRequestStatusPENDING {
			updated, err := s.queries.UpdateFriendRequestStatus(ctx, db.UpdateFriendRequestStatusParams{
				ID:     existing.ID,
				Status: db.FriendRequestStatusACCEPTED,
			})
			if err != nil {
				return nil, "", err
			}
			item := s.toFriendItem(ctx, updated, currentUserID)
			return item, "Friend request accepted successfully", nil
		}
	}

	// Create new friend request
	created, err := s.queries.CreateFriendRequest(ctx, db.CreateFriendRequestParams{
		SenderID:   int32(currentUserID),
		ReceiverID: int32(targetUserID),
	})
	if err != nil {
		return nil, "", err
	}

	// Dispatch notification
	if s.dispatcher != nil {
		s.dispatcher.Enqueue(fcm.NotificationJob{
			UserID: &targetUserID,
			Title:  "New Friend Request",
			Body:   "Someone sent you a friend request!",
			Data: map[string]interface{}{
				"senderId":  fmt.Sprintf("%d", currentUserID),
				"requestId": fmt.Sprintf("%d", created.ID),
				"type":      "FRIEND_REQUEST",
			},
		})
	}

	item := s.toFriendItem(ctx, created, currentUserID)
	return item, "Friend request sent successfully", nil
}

func (s *Service) AcceptFriendRequest(ctx context.Context, currentUserID, requestOrSenderID int64) (*FriendItemDto, error) {
	req, err := s.findRequest(ctx, currentUserID, requestOrSenderID)
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, "Friend request not found")
	}

	if int64(req.ReceiverID) != currentUserID {
		return nil, common.NewAppError(403, common.ErrForbidden, "Forbidden: Request was not sent to you")
	}

	updated, err := s.queries.UpdateFriendRequestStatus(ctx, db.UpdateFriendRequestStatusParams{
		ID:     req.ID,
		Status: db.FriendRequestStatusACCEPTED,
	})
	if err != nil {
		return nil, err
	}

	return s.toFriendItem(ctx, updated, currentUserID), nil
}

func (s *Service) RejectFriendRequest(ctx context.Context, currentUserID, requestOrSenderID int64) (*FriendItemDto, error) {
	req, err := s.findRequest(ctx, currentUserID, requestOrSenderID)
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, "Friend request not found")
	}

	if int64(req.ReceiverID) != currentUserID {
		return nil, common.NewAppError(403, common.ErrForbidden, "Forbidden: Request was not sent to you")
	}

	updated, err := s.queries.UpdateFriendRequestStatus(ctx, db.UpdateFriendRequestStatusParams{
		ID:     req.ID,
		Status: db.FriendRequestStatusREJECTED,
	})
	if err != nil {
		return nil, err
	}

	return s.toFriendItem(ctx, updated, currentUserID), nil
}

func (s *Service) CancelFriendRequest(ctx context.Context, currentUserID, requestOrTargetID int64) (*FriendItemDto, error) {
	req, err := s.findRequest(ctx, currentUserID, requestOrTargetID)
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, "Friend request not found")
	}

	if int64(req.SenderID) != currentUserID {
		return nil, common.NewAppError(403, common.ErrForbidden, "Forbidden: You can only cancel friend requests sent by you")
	}

	if req.Status == db.FriendRequestStatusACCEPTED {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Cannot cancel an already accepted friend request")
	}

	updated, err := s.queries.UpdateFriendRequestStatus(ctx, db.UpdateFriendRequestStatusParams{
		ID:     req.ID,
		Status: db.FriendRequestStatusCANCELLED,
	})
	if err != nil {
		return nil, err
	}

	return s.toFriendItem(ctx, updated, currentUserID), nil
}

func (s *Service) RemoveFriend(ctx context.Context, currentUserID, friendOrRequestID int64) error {
	// First try deleting by ID
	req, err := s.queries.GetFriendRequestByID(ctx, int32(friendOrRequestID))
	if err == nil && (int64(req.SenderID) == currentUserID || int64(req.ReceiverID) == currentUserID) {
		return s.queries.DeleteFriendRequestByID(ctx, req.ID)
	}

	// Try deleting between users
	err = s.queries.DeleteFriendRequestBetween(ctx, db.DeleteFriendRequestBetweenParams{
		SenderID:   int32(currentUserID),
		ReceiverID: int32(friendOrRequestID),
	})
	if err != nil {
		return common.NewAppError(404, common.ErrNotFound, "Friendship not found")
	}
	return nil
}

func (s *Service) GetFriendRequests(ctx context.Context, currentUserID int64, q FriendRequestsQuery) (*PaginatedFriendsDataDto, error) {
	page := q.Page
	if page < 1 {
		page = 1
	}
	limit := q.Limit
	if limit < 1 || limit > 50 {
		limit = 10
	}

	isSent := strings.ToLower(q.Type) == "sent"
	var items []FriendItemDto

	if isSent {
		rows, err := s.queries.ListFriendRequestsSent(ctx, int32(currentUserID))
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			if q.Status != "" && string(r.Status) != q.Status {
				continue
			}
			photo := ""
			if r.ReceiverProfilePictureUrl.Valid && r.ReceiverProfilePictureUrl.String != "" {
				photo = r.ReceiverProfilePictureUrl.String
			} else if r.ReceiverAvatarUrl.Valid {
				photo = r.ReceiverAvatarUrl.String
			}
			var pUrl *string
			if photo != "" {
				u := s.resolveAssetURL(photo)
				pUrl = &u
			}
			var fn *string
			if r.ReceiverName.Valid && r.ReceiverName.String != "" {
				fn = &r.ReceiverName.String
			}
			var un *string
			if r.ReceiverUsername.Valid && r.ReceiverUsername.String != "" {
				un = &r.ReceiverUsername.String
			}

			items = append(items, FriendItemDto{
				ID:        int(r.ID),
				Status:    string(r.Status),
				CreatedAt: r.CreatedAt.Time,
				UpdatedAt: r.UpdatedAt.Time,
				FullName:  fn,
				Username:  un,
				AvatarUrl: pUrl,
			})
		}
	} else {
		rows, err := s.queries.ListFriendRequestsReceived(ctx, int32(currentUserID))
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			if q.Status != "" && string(r.Status) != q.Status {
				continue
			}
			photo := ""
			if r.SenderProfilePictureUrl.Valid && r.SenderProfilePictureUrl.String != "" {
				photo = r.SenderProfilePictureUrl.String
			} else if r.SenderAvatarUrl.Valid {
				photo = r.SenderAvatarUrl.String
			}
			var pUrl *string
			if photo != "" {
				u := s.resolveAssetURL(photo)
				pUrl = &u
			}
			var fn *string
			if r.SenderName.Valid && r.SenderName.String != "" {
				fn = &r.SenderName.String
			}
			var un *string
			if r.SenderUsername.Valid && r.SenderUsername.String != "" {
				un = &r.SenderUsername.String
			}

			items = append(items, FriendItemDto{
				ID:        int(r.ID),
				Status:    string(r.Status),
				CreatedAt: r.CreatedAt.Time,
				UpdatedAt: r.UpdatedAt.Time,
				FullName:  fn,
				Username:  un,
				AvatarUrl: pUrl,
			})
		}
	}

	total := len(items)
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	start := (page - 1) * limit
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}

	return &PaginatedFriendsDataDto{
		Items:      items[start:end],
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) GetFriends(ctx context.Context, currentUserID int64, q FriendsQuery) (*PaginatedFriendsDataDto, error) {
	page := q.Page
	if page < 1 {
		page = 1
	}
	limit := q.Limit
	if limit < 1 || limit > 50 {
		limit = 10
	}

	rows, err := s.queries.ListFriendsByUserID(ctx, int32(currentUserID))
	if err != nil {
		return nil, err
	}

	var items []FriendItemDto
	search := strings.ToLower(strings.TrimSpace(q.Search))

	for _, r := range rows {
		fnStr := ""
		if r.FriendName.Valid {
			fnStr = r.FriendName.String
		}
		unStr := ""
		if r.FriendUsername.Valid {
			unStr = r.FriendUsername.String
		}

		if search != "" {
			if !strings.Contains(strings.ToLower(fnStr), search) && !strings.Contains(strings.ToLower(unStr), search) {
				continue
			}
		}

		photo := ""
		if r.FriendProfilePictureUrl.Valid && r.FriendProfilePictureUrl.String != "" {
			photo = r.FriendProfilePictureUrl.String
		} else if r.FriendAvatarUrl.Valid {
			photo = r.FriendAvatarUrl.String
		}
		var pUrl *string
		if photo != "" {
			u := s.resolveAssetURL(photo)
			pUrl = &u
		}

		var fn *string
		if fnStr != "" {
			fn = &fnStr
		}
		var un *string
		if unStr != "" {
			un = &unStr
		}

		items = append(items, FriendItemDto{
			ID:        int(r.ID),
			Status:    string(r.Status),
			CreatedAt: r.CreatedAt.Time,
			UpdatedAt: r.UpdatedAt.Time,
			FullName:  fn,
			Username:  un,
			AvatarUrl: pUrl,
		})
	}

	total := len(items)
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	start := (page - 1) * limit
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}

	return &PaginatedFriendsDataDto{
		Items:      items[start:end],
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) findRequest(ctx context.Context, currentUserID, idOrUserID int64) (*db.FriendRequests, error) {
	// Try by request ID
	req, err := s.queries.GetFriendRequestByID(ctx, int32(idOrUserID))
	if err == nil {
		return &req, nil
	}

	// Try by user ID between
	reqBetween, err := s.queries.GetFriendRequestBetween(ctx, db.GetFriendRequestBetweenParams{
		SenderID:   int32(currentUserID),
		ReceiverID: int32(idOrUserID),
	})
	if err == nil {
		return &reqBetween, nil
	}

	return nil, err
}

func (s *Service) toFriendItem(ctx context.Context, req db.FriendRequests, currentUserID int64) *FriendItemDto {
	otherID := req.SenderID
	if int64(req.SenderID) == currentUserID {
		otherID = req.ReceiverID
	}

	p, err := s.queries.GetProfileByUserID(ctx, otherID)
	var fn, un, pUrl *string
	if err == nil {
		if p.FirstName != "" {
			fn = &p.FirstName
		}
		if p.Username.Valid && p.Username.String != "" {
			un = &p.Username.String
		}
		photo := p.AvatarUrl
		if p.ProfilePictureUrl.Valid && p.ProfilePictureUrl.String != "" {
			photo = p.ProfilePictureUrl.String
		}
		if photo != "" {
			u := s.resolveAssetURL(photo)
			pUrl = &u
		}
	}

	return &FriendItemDto{
		ID:        int(req.ID),
		Status:    string(req.Status),
		CreatedAt: req.CreatedAt.Time,
		UpdatedAt: req.UpdatedAt.Time,
		FullName:  fn,
		Username:  un,
		AvatarUrl: pUrl,
	}
}
