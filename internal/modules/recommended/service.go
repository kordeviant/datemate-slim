package recommended

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/modules/users"
	"datemate/internal/platform/database/db"
	"datemate/internal/platform/geo"
	platformRedis "datemate/internal/platform/redis"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	cfg        *config.Config
	pool       *pgxpool.Pool
	queries    *db.Queries
	rdb        *platformRedis.Client
	geoService *geo.Service
	userSvc    *users.Service
}

func NewService(
	cfg *config.Config,
	pool *pgxpool.Pool,
	rdb *platformRedis.Client,
	geoService *geo.Service,
	userSvc *users.Service,
) *Service {
	return &Service{
		cfg:        cfg,
		pool:       pool,
		queries:    db.New(pool),
		rdb:        rdb,
		geoService: geoService,
		userSvc:    userSvc,
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

func calculateQuestionScore(currentUserAns, candAns []int32, maxWeight int) int {
	if len(currentUserAns) == 0 {
		return 15
	}
	ansSet := make(map[int32]struct{}, len(currentUserAns))
	for _, a := range currentUserAns {
		ansSet[a] = struct{}{}
	}

	shared := 0
	for _, a := range candAns {
		if _, ok := ansSet[a]; ok {
			shared++
		}
	}

	ratio := float64(shared) / float64(len(currentUserAns))
	score := int(math.Round(ratio * float64(maxWeight)))
	if score > maxWeight {
		score = maxWeight
	}
	return score
}

func calculateInterestScore(currentUserInt, candInt []int32, maxWeight int) int {
	if len(currentUserInt) == 0 {
		return 10
	}
	intSet := make(map[int32]struct{}, len(currentUserInt))
	for _, i := range currentUserInt {
		intSet[i] = struct{}{}
	}

	shared := 0
	for _, i := range candInt {
		if _, ok := intSet[i]; ok {
			shared++
		}
	}

	ratio := float64(shared) / float64(len(currentUserInt))
	score := int(math.Round(ratio * float64(maxWeight)))
	if score > maxWeight {
		score = maxWeight
	}
	return score
}

func calculateCityScore(currentCityID, candCityID *int32, maxWeight int) int {
	if currentCityID != nil && candCityID != nil && *currentCityID == *candCityID {
		return maxWeight
	}
	return 0
}

func calculateRelationScore(currentRel, candRel *string, maxWeight int) int {
	if currentRel != nil && candRel != nil && *currentRel != "" && *currentRel == *candRel {
		return maxWeight
	}
	return 0
}

func calculateAgeScore(currentAge, candAge *int, maxWeight int) int {
	if currentAge == nil || candAge == nil {
		return 5
	}
	diff := int(math.Abs(float64(*currentAge - *candAge)))
	if diff <= 3 {
		return maxWeight
	}
	if diff <= 6 {
		return 6
	}
	if diff <= 10 {
		return 3
	}
	return 0
}

func (s *Service) GetRankedCandidatePool(ctx context.Context, currentUserID int64) ([]RankedCandidateItem, error) {
	// 1. Try Redis Cache
	cached, err := s.rdb.GetRecommendedCache(ctx, currentUserID)
	if err == nil && cached != "" {
		var list []RankedCandidateItem
		if json.Unmarshal([]byte(cached), &list) == nil && len(list) > 0 {
			return list, nil
		}
	}

	// 2. Fetch current user
	currentUser, err := s.queries.GetUserByID(ctx, int32(currentUserID))
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, "User profile not found")
	}

	// Rule 3: Account Status
	if currentUser.BannedUntil.Valid && currentUser.BannedUntil.Time.After(time.Now().UTC()) {
		return nil, common.NewAppError(403, common.ErrForbidden, "Account is suspended")
	}

	// Rule 6: Current user gender demographic
	userDemographic, err := s.queries.GetDemographicByUserID(ctx, int32(currentUserID))
	if err != nil || (userDemographic.Gender != db.GenderMALE && userDemographic.Gender != db.GenderFEMALE) {
		return nil, common.NewAppError(400, common.ErrBadRequest, "Gender demographic must be completed to retrieve recommendations")
	}

	currentUserProfile, _ := s.queries.GetCandidateRecommendationProfile(ctx, int32(currentUserID))

	targetGender := db.GenderFEMALE
	if userDemographic.Gender == db.GenderFEMALE {
		targetGender = db.GenderMALE
	}

	var userAge *int
	if currentUserProfile.BirthDate.Valid {
		a := calculateAge(currentUserProfile.BirthDate.Time)
		userAge = &a
	}
	var userCityID *int32
	if currentUserProfile.CityID.Valid {
		userCityID = &currentUserProfile.CityID.Int32
	}
	var userRel *string
	if currentUserProfile.RelationPreference.Valid {
		r := string(currentUserProfile.RelationPreference.RelationType)
		userRel = &r
	}

	// Query candidate pool
	candidates, err := s.queries.FindFeedCandidatesWithNotExists(ctx, db.FindFeedCandidatesWithNotExistsParams{
		ID:     int32(currentUserID),
		Gender: targetGender,
		Limit:  100,
	})
	if err != nil {
		return nil, err
	}

	// Fallback if unswiped count is 0
	if len(candidates) == 0 {
		fallbackRows, _ := s.queries.FindFeedCandidatesFallback(ctx, db.FindFeedCandidatesFallbackParams{
			ID:     int32(currentUserID),
			Gender: targetGender,
			Limit:  100,
		})
		for _, fb := range fallbackRows {
			candidates = append(candidates, db.FindFeedCandidatesWithNotExistsRow{
				ID:                fb.ID,
				Email:             fb.Email,
				ProfileValidated:  fb.ProfileValidated,
				IsPremium:         fb.IsPremium,
				FirstName:         fb.FirstName,
				Username:          fb.Username,
				AvatarUrl:         fb.AvatarUrl,
				ProfilePictureUrl: fb.ProfilePictureUrl,
				IsOnline:          fb.IsOnline,
				LastSeenAt:        fb.LastSeenAt,
				BirthDate:         fb.BirthDate,
				Gender:            fb.Gender,
				CityID:            fb.CityID,
				CityName:          fb.CityName,
			})
		}
	}

	swipedIDs, _ := s.rdb.GetSwipedUserIDs(ctx, currentUserID)
	swipedMap := make(map[int64]bool, len(swipedIDs))
	for _, id := range swipedIDs {
		swipedMap[id] = true
	}

	var scoredList []RankedCandidateItem

	for _, c := range candidates {
		candProfile, err := s.queries.GetCandidateRecommendationProfile(ctx, c.ID)
		if err != nil {
			continue
		}

		var candAge *int
		if candProfile.BirthDate.Valid {
			a := calculateAge(candProfile.BirthDate.Time)
			candAge = &a
		}
		var candCityID *int32
		if candProfile.CityID.Valid {
			candCityID = &candProfile.CityID.Int32
		}
		var candRel *string
		if candProfile.RelationPreference.Valid {
			r := string(candProfile.RelationPreference.RelationType)
			candRel = &r
		}

		// Exact scoring weights:
		// Question overlap: 35, Interests overlap: 25, City match: 20, Relation match: 10, Age proximity: 10
		qScore := calculateQuestionScore(currentUserProfile.AnswerIds, candProfile.AnswerIds, 35)
		iScore := calculateInterestScore(currentUserProfile.InterestIds, candProfile.InterestIds, 25)
		cScore := calculateCityScore(userCityID, candCityID, 20)
		rScore := calculateRelationScore(userRel, candRel, 10)
		aScore := calculateAgeScore(userAge, candAge, 10)

		totalScore := qScore + iScore + cScore + rScore + aScore
		if totalScore > 100 {
			totalScore = 100
		}
		if totalScore < 0 {
			totalScore = 0
		}

		photo := c.AvatarUrl
		if c.ProfilePictureUrl.Valid && c.ProfilePictureUrl.String != "" {
			photo = c.ProfilePictureUrl.String
		}
		resolvedPhoto := s.resolveAssetURL(photo)

		var resolvedCity *string
		if c.CityID.Valid && c.CityID.Int32 > 0 {
			ct, ok := s.geoService.GetCity(int(c.CityID.Int32))
			if ok {
				resolvedCity = &ct.Name
			} else if c.CityName.Valid && c.CityName.String != "" {
				resolvedCity = &c.CityName.String
			}
		} else if c.CityName.Valid && c.CityName.String != "" {
			resolvedCity = &c.CityName.String
		}

		var fn *string
		if c.FirstName != "" {
			fn = &c.FirstName
		}
		var un *string
		if c.Username.Valid {
			un = &c.Username.String
		}

		isSwiped := swipedMap[int64(c.ID)]

		item := RankedCandidateItem{
			ID:                 int(c.ID),
			AvatarUrl:          &resolvedPhoto,
			Age:                candAge,
			City:               resolvedCity,
			Username:           un,
			FullName:           fn,
			CompatibilityScore: totalScore,
			IsSwiped:           isSwiped,
		}

		scoredList = append(scoredList, item)
	}

	// Sort descending by compatibility score
	sort.Slice(scoredList, func(i, j int) bool {
		return scoredList[i].CompatibilityScore > scoredList[j].CompatibilityScore
	})

	// Cache in Redis for 1 day
	if len(scoredList) > 0 {
		if bytes, err := json.Marshal(scoredList); err == nil {
			ttl := time.Duration(s.cfg.RecommendedCacheTTL) * time.Second
			_ = s.rdb.SetRecommendedCache(ctx, currentUserID, string(bytes), ttl)
		}
	}

	return scoredList, nil
}

func sliceCandidates(candidates []RankedCandidateItem, query RecommendedQuery, defaultLimit int) []RankedCandidateItem {
	limit := defaultLimit
	if query.Limit != nil && *query.Limit > 0 {
		limit = *query.Limit
		if limit > 50 {
			limit = 50
		}
	}

	if query.AnchorUserID != nil {
		anchorIndex := -1
		for i, c := range candidates {
			if c.ID == *query.AnchorUserID {
				anchorIndex = i
				break
			}
		}
		if anchorIndex == -1 {
			return []RankedCandidateItem{}
		}

		if query.Before != nil || query.After != nil {
			beforeCount := 0
			if query.Before != nil && *query.Before > 0 {
				beforeCount = *query.Before
			}
			afterCount := 0
			if query.After != nil && *query.After > 0 {
				afterCount = *query.After
			}
			startIndex := anchorIndex - beforeCount
			if startIndex < 0 {
				startIndex = 0
			}
			endIndex := anchorIndex + 1 + afterCount
			if endIndex > len(candidates) {
				endIndex = len(candidates)
			}
			return candidates[startIndex:endIndex]
		}

		startIndex := anchorIndex
		endIndex := startIndex + limit
		if query.End != nil && *query.End > startIndex {
			endIndex = *query.End
		}
		if endIndex > len(candidates) {
			endIndex = len(candidates)
		}
		return candidates[startIndex:endIndex]
	}

	startIndex := 0
	if query.CandidateID != nil {
		for i, c := range candidates {
			if c.ID == *query.CandidateID {
				startIndex = i
				break
			}
		}
	} else if query.Start != nil {
		rawStart := *query.Start
		if rawStart >= len(candidates) {
			found := false
			for i, c := range candidates {
				if c.ID == rawStart {
					startIndex = i
					found = true
					break
				}
			}
			if !found {
				startIndex = rawStart
			}
		} else {
			startIndex = rawStart
		}
	} else if query.Offset != nil {
		startIndex = *query.Offset
	}

	if startIndex < 0 {
		startIndex = 0
	}
	if startIndex > len(candidates) {
		return []RankedCandidateItem{}
	}

	endIndex := startIndex + limit
	if query.End != nil && *query.End > startIndex {
		endIndex = *query.End
	}
	if endIndex > len(candidates) {
		endIndex = len(candidates)
	}

	return candidates[startIndex:endIndex]
}

func (s *Service) GetRecommended(ctx context.Context, currentUserID int64, query RecommendedQuery) ([]RecommendedCandidateDto, error) {
	candidates, err := s.GetRankedCandidatePool(ctx, currentUserID)
	if err != nil {
		return nil, err
	}

	sliced := sliceCandidates(candidates, query, s.cfg.PaginationDefaultLimit)

	dtos := make([]RecommendedCandidateDto, 0, len(sliced))
	for _, c := range sliced {
		dtos = append(dtos, RecommendedCandidateDto{
			ID:        c.ID,
			AvatarUrl: c.AvatarUrl,
			Age:       c.Age,
			City:      c.City,
			Username:  c.Username,
			FullName:  c.FullName,
		})
	}
	return dtos, nil
}

func (s *Service) GetRecommendedDetail(ctx context.Context, currentUserID int64, query RecommendedQuery) ([]*users.ProfileResponseDto, error) {
	candidates, err := s.GetRankedCandidatePool(ctx, currentUserID)
	if err != nil {
		return nil, err
	}

	sliced := sliceCandidates(candidates, query, s.cfg.PaginationDefaultLimit)

	res := make([]*users.ProfileResponseDto, 0, len(sliced))
	for _, c := range sliced {
		prof, err := s.userSvc.GetProfile(ctx, int64(c.ID))
		if err == nil && prof != nil {
			res = append(res, prof)
		}
	}
	return res, nil
}
