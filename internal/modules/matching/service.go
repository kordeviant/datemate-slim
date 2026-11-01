package matching

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/platform/database/db"
	"datemate/internal/platform/fcm"
	"datemate/internal/platform/geo"
	platformRedis "datemate/internal/platform/redis"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	cfg        *config.Config
	pool       *pgxpool.Pool
	queries    *db.Queries
	rdb        *platformRedis.Client
	geoService *geo.Service
	dispatcher *fcm.Dispatcher
}

func NewService(
	cfg *config.Config,
	pool *pgxpool.Pool,
	rdb *platformRedis.Client,
	geoService *geo.Service,
	dispatcher *fcm.Dispatcher,
) *Service {
	return &Service{
		cfg:        cfg,
		pool:       pool,
		queries:    db.New(pool),
		rdb:        rdb,
		geoService: geoService,
		dispatcher: dispatcher,
	}
}

func calculateAge(birthDate time.Time) int {
	now := time.Now().UTC()
	years := now.Year() - birthDate.Year()
	if now.YearDay() < birthDate.YearDay() {
		years--
	}
	return years
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

func (s *Service) GetFeed(ctx context.Context, currentUserID int64, limit int) ([]FeedCandidateDto, error) {
	if limit <= 0 {
		limit = s.cfg.PaginationDefaultLimit
	}
	if limit > s.cfg.PaginationMaxLimit {
		limit = s.cfg.PaginationMaxLimit
	}

	// 1. Determine user's target gender
	userDemographic, _ := s.queries.GetDemographicByUserID(ctx, int32(currentUserID))
	targetGender := db.GenderFEMALE
	if userDemographic.Gender == db.GenderFEMALE {
		targetGender = db.GenderMALE
	}

	// 2. Query candidates using SQL NOT EXISTS anti-join
	rows, err := s.queries.FindFeedCandidatesWithNotExists(ctx, db.FindFeedCandidatesWithNotExistsParams{
		ID:     int32(currentUserID),
		Gender: targetGender,
		Limit:  int32(limit * 2),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query feed candidates: %w", err)
	}

	var results []FeedCandidateDto

	processRow := func(
		id int32,
		firstName string,
		username pgtype.Text,
		avatarUrl string,
		profilePictureUrl pgtype.Text,
		birthDate pgtype.Date,
		cityID pgtype.Int4,
		cityName pgtype.Text,
	) *FeedCandidateDto {
		galleries, _ := s.queries.ListUserGalleries(ctx, id)

		// Rule 4: Active photo resolution
		var primaryPhoto string
		for _, g := range galleries {
			if g.IsProfilePicture {
				primaryPhoto = g.ImageUrl
				break
			}
		}
		if primaryPhoto == "" && len(galleries) > 0 {
			primaryPhoto = galleries[0].ImageUrl
		}
		if primaryPhoto == "" && profilePictureUrl.Valid && profilePictureUrl.String != "" {
			primaryPhoto = profilePictureUrl.String
		}
		if primaryPhoto == "" && avatarUrl != "" {
			primaryPhoto = avatarUrl
		}

		if primaryPhoto == "" {
			return nil
		}

		resolvedPhoto := s.resolveAssetURL(primaryPhoto)

		var ageVal *int
		if birthDate.Valid {
			a := calculateAge(birthDate.Time)
			ageVal = &a
		}

		// Resolve City name as flat string: city: string | null (STRICT INVARIANT)
		var resolvedCity *string
		if cityID.Valid && cityID.Int32 > 0 {
			c, ok := s.geoService.GetCity(int(cityID.Int32))
			if ok {
				resolvedCity = &c.Name
			} else if cityName.Valid && cityName.String != "" {
				resolvedCity = &cityName.String
			}
		} else if cityName.Valid && cityName.String != "" {
			resolvedCity = &cityName.String
		}

		var galleryDtos []FeedGalleryItemDto
		for _, g := range galleries {
			galleryDtos = append(galleryDtos, FeedGalleryItemDto{
				ID:               int(g.ID),
				ImageUrl:         s.resolveAssetURL(g.ImageUrl),
				IsProfilePicture: g.IsProfilePicture,
			})
		}

		var fn *string
		if firstName != "" {
			fn = &firstName
		}
		var un *string
		if username.Valid {
			un = &username.String
		}

		return &FeedCandidateDto{
			ID:        int(id),
			FullName:  fn,
			City:      resolvedCity,
			Age:       ageVal,
			AvatarUrl: &resolvedPhoto,
			Username:  un,
			Gallery:   galleryDtos,
		}
	}

	for _, r := range rows {
		if len(results) >= limit {
			break
		}
		item := processRow(r.ID, r.FirstName, r.Username, r.AvatarUrl, r.ProfilePictureUrl, r.BirthDate, r.CityID, r.CityName)
		if item != nil {
			results = append(results, *item)
		}
	}

	// 3. Deck-Exhaustion Fallback: if unswiped count is 0, loop back excluding self
	if len(results) == 0 {
		fallbackRows, err := s.queries.FindFeedCandidatesFallback(ctx, db.FindFeedCandidatesFallbackParams{
			ID:     int32(currentUserID),
			Gender: targetGender,
			Limit:  int32(limit * 2),
		})
		if err == nil {
			for _, r := range fallbackRows {
				if len(results) >= limit {
					break
				}
				item := processRow(r.ID, r.FirstName, r.Username, r.AvatarUrl, r.ProfilePictureUrl, r.BirthDate, r.CityID, r.CityName)
				if item != nil {
					results = append(results, *item)
				}
			}
		}
	}

	return results, nil
}

func (s *Service) RecordSwipe(ctx context.Context, currentUserID, targetUserID int64, direction string) error {
	if currentUserID == targetUserID {
		return errors.New("You cannot swipe on yourself")
	}

	dir := strings.ToUpper(strings.TrimSpace(direction))
	if dir != "RIGHT" && dir != "LEFT" {
		return errors.New("Invalid swipe direction")
	}

	// Verify target user exists and not banned
	target, err := s.queries.GetUserByID(ctx, int32(targetUserID))
	if err != nil {
		return errors.New("Target user not found")
	}
	if target.BannedUntil.Valid && target.BannedUntil.Time.After(time.Now()) {
		return errors.New("Cannot swipe on a suspended or banned user")
	}

	// 1. Atomic Swipe & Match using Redis Lua script
	isMutualMatch, err := s.rdb.RecordSwipeAtomic(ctx, currentUserID, targetUserID, dir)
	if err != nil {
		log.Printf("Redis swipe warning: %v", err)
	}

	// 2. Persist Swipe to PostgreSQL
	pairKey, _ := common.CreatePairKey(currentUserID, targetUserID)
	_, _ = s.queries.UpsertSwipe(ctx, db.UpsertSwipeParams{
		UserPairKey: pairKey,
		FromUserID:  int32(currentUserID),
		ToUserID:    int32(targetUserID),
		Direction:   db.SwipeDirection(dir),
	})

	// 3. Mutual match handling
	if isMutualMatch {
		u1 := int32(currentUserID)
		u2 := int32(targetUserID)
		if u1 > u2 {
			u1, u2 = u2, u1
		}
		_, _ = s.queries.CreateMatch(ctx, db.CreateMatchParams{
			UserOneID: u1,
			UserTwoID: u2,
		})

		// Dispatch push notifications to both users
		currentProfile, _ := s.queries.GetProfileByUserID(ctx, int32(currentUserID))
		targetProfile, _ := s.queries.GetProfileByUserID(ctx, int32(targetUserID))

		go func() {
			s.dispatcher.Enqueue(fcm.NotificationJob{
				UserID: &targetUserID,
				Title:  "New Match!",
				Body:   fmt.Sprintf("You matched with %s!", currentProfile.FirstName),
				Data: map[string]interface{}{
					"type":         "NEW_MATCH",
					"partnerId":    currentUserID,
					"partnerName":  currentProfile.FirstName,
					"partnerPhoto": s.resolveAssetURL(currentProfile.AvatarUrl),
				},
			})
			s.dispatcher.Enqueue(fcm.NotificationJob{
				UserID: &currentUserID,
				Title:  "New Match!",
				Body:   fmt.Sprintf("You matched with %s!", targetProfile.FirstName),
				Data: map[string]interface{}{
					"type":         "NEW_MATCH",
					"partnerId":    targetUserID,
					"partnerName":  targetProfile.FirstName,
					"partnerPhoto": s.resolveAssetURL(targetProfile.AvatarUrl),
				},
			})
		}()
	} else if dir == "RIGHT" {
		// Single like push notification
		currentProfile, _ := s.queries.GetProfileByUserID(ctx, int32(currentUserID))
		go func() {
			s.dispatcher.Enqueue(fcm.NotificationJob{
				UserID: &targetUserID,
				Title:  "New Like",
				Body:   fmt.Sprintf("%s liked your profile!", currentProfile.FirstName),
				Data: map[string]interface{}{
					"type":    "LIKE_USER",
					"likerId": currentUserID,
				},
			})
		}()
	}

	return nil
}

func (s *Service) GetLikesReceived(ctx context.Context, currentUserID int64) ([]LikedUserDto, error) {
	rows, err := s.queries.ListLikesReceivedByUserID(ctx, int32(currentUserID))
	if err != nil {
		return nil, err
	}

	var results []LikedUserDto
	for _, r := range rows {
		var fn *string
		if r.LikerName.Valid {
			fn = &r.LikerName.String
		}
		var un *string
		if r.LikerUsername.Valid {
			un = &r.LikerUsername.String
		}

		// Strictly flat city: string | null
		var resolvedCity *string
		if r.LikerCityID.Valid && r.LikerCityID.Int32 > 0 {
			c, ok := s.geoService.GetCity(int(r.LikerCityID.Int32))
			if ok {
				resolvedCity = &c.Name
			} else if r.LikerCity.Valid && r.LikerCity.String != "" {
				resolvedCity = &r.LikerCity.String
			}
		} else if r.LikerCity.Valid && r.LikerCity.String != "" {
			resolvedCity = &r.LikerCity.String
		}

		var avatarUrl *string
		if r.LikerProfilePictureUrl.Valid && r.LikerProfilePictureUrl.String != "" {
			u := s.resolveAssetURL(r.LikerProfilePictureUrl.String)
			avatarUrl = &u
		} else if r.LikerAvatarUrl.Valid && r.LikerAvatarUrl.String != "" {
			u := s.resolveAssetURL(r.LikerAvatarUrl.String)
			avatarUrl = &u
		}

		isOnline := false
		if r.LikerIsOnline.Valid {
			isOnline = r.LikerIsOnline.Bool
		}

		results = append(results, LikedUserDto{
			ID:        int(r.LikerID),
			FullName:  fn,
			Username:  un,
			City:      resolvedCity,
			IsOnline:  isOnline,
			AvatarUrl: avatarUrl,
		})
	}

	return results, nil
}
