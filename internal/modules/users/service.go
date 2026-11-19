package users

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/platform/database/db"
	"datemate/internal/platform/geo"
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
	geoService  *geo.Service
	storage     storage.Engine
	broadcaster Broadcaster
}

func (s *Service) SetBroadcaster(b Broadcaster) {
	s.broadcaster = b
}

func NewService(cfg *config.Config, pool *pgxpool.Pool, geoService *geo.Service, storage storage.Engine) *Service {
	return &Service{
		cfg:        cfg,
		pool:       pool,
		queries:    db.New(pool),
		geoService: geoService,
		storage:    storage,
	}
}

func (s *Service) resolveAssetURL(raw string) string {
	return common.ResolveAssetURL(s.cfg.AssetBaseURL, raw)
}

func toInt32(val interface{}) (int32, bool) {
	switch n := val.(type) {
	case float64:
		return int32(n), true
	case int:
		return int32(n), true
	case int64:
		return int32(n), true
	case string:
		if parsed, err := strconv.Atoi(n); err == nil {
			return int32(parsed), true
		}
	}
	return 0, false
}

func (s *Service) GetProfile(ctx context.Context, userID int64) (*ProfileResponseDto, error) {
	u, err := s.queries.GetUserByID(ctx, int32(userID))
	if err != nil {
		return nil, errors.New("User account not found")
	}

	p, err := s.queries.GetProfileByUserID(ctx, int32(userID))
	if err != nil {
		// Return empty default profile
		p = db.Profiles{
			UserID:    int32(userID),
			FirstName: "",
			AvatarUrl: "",
		}
	}

	d, _ := s.queries.GetDemographicByUserID(ctx, int32(userID))
	galleries, _ := s.queries.ListUserGalleries(ctx, int32(userID))
	interests, _ := s.queries.ListUserInterests(ctx, int32(userID))
	answers, _ := s.queries.ListUserQuestionAnswers(ctx, int32(userID))

	// Assemble Gallery
	var galleryDtos []GalleryItemResponseDto
	var activeProfilePicID *int
	var activeProfilePicURL *string

	for _, g := range galleries {
		gID := int(g.ID)
		url := s.resolveAssetURL(g.ImageUrl)
		isPic := g.IsProfilePicture
		if isPic {
			activeProfilePicID = &gID
			activeProfilePicURL = &url
		}
		var desc *string
		if g.Description.Valid {
			desc = &g.Description.String
		}
		var createdStr *string
		if g.CreatedAt.Valid {
			str := g.CreatedAt.Time.UTC().Format(time.RFC3339)
			createdStr = &str
		}
		galleryDtos = append(galleryDtos, GalleryItemResponseDto{
			ID:               gID,
			URL:              url,
			Description:      desc,
			IsProfilePicture: isPic,
			CreatedAt:        createdStr,
		})
	}

	// Fallback for profile picture if not in gallery
	if activeProfilePicURL == nil {
		if p.ProfilePictureUrl.Valid && common.HasValidPhoto(p.ProfilePictureUrl.String) {
			resolved := s.resolveAssetURL(p.ProfilePictureUrl.String)
			activeProfilePicURL = &resolved
		} else if common.HasValidPhoto(p.AvatarUrl) {
			resolved := s.resolveAssetURL(p.AvatarUrl)
			activeProfilePicURL = &resolved
		}
	}

	// Assemble City -> State -> Country strictly at Profile.Demographic.City
	var cityDto *CityResponseDto
	if d.CityID.Valid && d.CityID.Int32 > 0 {
		cID := int(d.CityID.Int32)
		city, state, country, ok := s.geoService.ResolveCityHierarchy(cID)
		if ok && city != nil {
			var stateName *string
			if state != nil {
				stateName = &state.Name
			}
			var countryName *string
			if country != nil {
				countryName = &country.Name
			}
			cityDto = &CityResponseDto{
				ID:      &city.ID,
				Name:    &city.Name,
				State:   stateName,
				Country: countryName,
			}
		} else if d.CityName.Valid && d.CityName.String != "" {
			cName := d.CityName.String
			cityDto = &CityResponseDto{
				ID:   &cID,
				Name: &cName,
			}
		}
	} else if d.CityName.Valid && d.CityName.String != "" {
		cName := d.CityName.String
		cityDto = &CityResponseDto{
			Name: &cName,
		}
	}

	var birthDateStr *string
	if d.BirthDate.Valid {
		b := d.BirthDate.Time.Format("2006-01-02")
		birthDateStr = &b
	}
	var genderStr *string
	if d.Gender != "" {
		g := string(d.Gender)
		genderStr = &g
	}
	var heightVal *int
	if d.Height.Valid {
		h := int(d.Height.Int16)
		heightVal = &h
	}
	var degreeStr *string
	if d.Degree.Valid {
		deg := string(d.Degree.EducationStatus)
		degreeStr = &deg
	}
	var profStr *string
	if d.Profession.Valid {
		profStr = &d.Profession.String
	}
	var relStatusStr *string
	if d.RelationStatus.Valid {
		rs := string(d.RelationStatus.RelationshipStatus)
		relStatusStr = &rs
	}

	demographicDto := &DemographicResponseDto{
		BirthDate:      birthDateStr,
		Gender:         genderStr,
		Height:         heightVal,
		Degree:         degreeStr,
		Profession:     profStr,
		RelationStatus: relStatusStr,
		City:           cityDto,
	}

	// Answers map: map[string]interface{} where value is 0-based index or []int for MULTI
	answersMap := make(map[string]interface{})
	if len(answers) > 0 {
		allQAns, err := s.queries.ListQuestionAnswers(ctx)
		if err == nil {
			type ansInfo struct {
				QuestionID int32
				Index      int
			}
			dbIDToInfo := make(map[int32]ansInfo)
			qIdxCounter := make(map[int32]int)
			for _, qa := range allQAns {
				idx := qIdxCounter[qa.QuestionID]
				dbIDToInfo[qa.ID] = ansInfo{
					QuestionID: qa.QuestionID,
					Index:      idx,
				}
				qIdxCounter[qa.QuestionID] = idx + 1
			}

			qAnswerType := make(map[int32]string)
			if allQ, qErr := s.queries.ListQuestions(ctx); qErr == nil {
				for _, q := range allQ {
					qAnswerType[q.ID] = string(q.AnswerType)
				}
			}

			answersByQID := make(map[int32][]int)
			for _, a := range answers {
				if info, ok := dbIDToInfo[a.QuestionAnswerID]; ok {
					answersByQID[info.QuestionID] = append(answersByQID[info.QuestionID], info.Index)
				} else {
					answersByQID[a.QuestionID] = append(answersByQID[a.QuestionID], 0)
				}
			}

			for qID, indices := range answersByQID {
				sort.Ints(indices)
				if qAnswerType[qID] == "MULTI" || len(indices) > 1 {
					answersMap[strconv.Itoa(int(qID))] = indices
				} else if len(indices) > 0 {
					answersMap[strconv.Itoa(int(qID))] = indices[0]
				}
			}
		}
	}

	// LikedActivities map: { [categoryId]: interestId | interestId[] }
	catInterests := make(map[string][]int)
	for _, in := range interests {
		catStr := strconv.Itoa(int(in.CategoryID))
		catInterests[catStr] = append(catInterests[catStr], int(in.InterestID))
	}
	likedActivities := make(map[string]interface{})
	for catStr, ids := range catInterests {
		sort.Ints(ids)
		if len(ids) > 1 {
			likedActivities[catStr] = ids
		} else if len(ids) == 1 {
			likedActivities[catStr] = ids[0]
		}
	}

	// Languages
	var langs []string
	if len(p.Languages) > 0 {
		_ = json.Unmarshal(p.Languages, &langs)
	}

	// Coordinates
	var latVal *float64
	if p.Latitude.Valid {
		f, _ := p.Latitude.Float64Value()
		if f.Valid {
			latVal = &f.Float64
		}
	}
	var lonVal *float64
	if p.Longitude.Valid {
		f, _ := p.Longitude.Float64Value()
		if f.Valid {
			lonVal = &f.Float64
		}
	}

	var fullName *string
	if p.FirstName != "" && p.FirstName != "User" {
		fullName = &p.FirstName
	}
	var username *string
	if p.Username.Valid {
		username = &p.Username.String
	}
	var phoneNumber *string
	if p.PhoneNumber.Valid {
		phoneNumber = &p.PhoneNumber.String
	}
	var bio *string
	if p.Bio.Valid {
		bio = &p.Bio.String
	}

	var relationTypeStr *string
	if p.RelationType.Valid {
		rt := string(p.RelationType.RelationType)
		relationTypeStr = &rt
	}

	hasPrivacy := u.PrivacyAcceptedAt.Valid && !u.PrivacyAcceptedAt.Time.IsZero()
	hasPhoto := common.HasValidPhoto(p.AvatarUrl) || len(galleryDtos) > 0 || (p.ProfilePictureUrl.Valid && common.HasValidPhoto(p.ProfilePictureUrl.String))
	profileCompleted := p.FirstName != "" && hasPhoto && d.Gender != "" && hasPrivacy

	nested := ProfileNestedResponseDto{
		FullName:         fullName,
		Username:         username,
		PhoneNumber:      phoneNumber,
		Bio:              bio,
		Languages:        langs,
		Avatar:           s.resolveAssetURL(p.AvatarUrl),
		ProfilePicture:   activeProfilePicURL,
		ProfilePictureID: activeProfilePicID,
		ProfileCompleted: profileCompleted,
		IsPremium:        u.IsPremium,
		Demographic:      demographicDto,
		RelationType:     relationTypeStr,
		Preferences:      &PreferencesResponseDto{Relation: relationTypeStr},
		Answers:          answersMap,
		LikedActivities:  likedActivities,
	}

	var privacyAcceptedAtStr *string
	if hasPrivacy {
		s := u.PrivacyAcceptedAt.Time.Format(time.RFC3339Nano)
		privacyAcceptedAtStr = &s
	}

	emailStr := u.Email
	return &ProfileResponseDto{
		ID:                int(u.ID),
		Email:             &emailStr,
		Language:          string(u.Language),
		Lat:               latVal,
		Lon:               lonVal,
		ProfileValidated:  u.ProfileValidated,
		IsPremium:         u.IsPremium,
		PrivacyAcceptedAt: privacyAcceptedAtStr,
		Profile:           nested,
		Gallery:           galleryDtos,
		ProfilePictureID:  activeProfilePicID,
	}, nil
}

func (s *Service) UpdateProfile(
	ctx context.Context,
	userID int64,
	payload *UpdateProfilePayload,
	avatarData, selfieData, galleryData []byte,
) (*ProfileResponseDto, error) {
	if payload != nil {
		if payload.Profile == nil && payload.ProfileLower != nil {
			payload.Profile = payload.ProfileLower
		}
		if payload.Profile != nil {
			if payload.Profile.Demographic == nil && payload.Profile.DemographicLower != nil {
				payload.Profile.Demographic = payload.Profile.DemographicLower
			}
			if payload.Profile.Preferences == nil && payload.Profile.PreferencesLower != nil {
				payload.Profile.Preferences = payload.Profile.PreferencesLower
			}
		}
	}

	existingProf, _ := s.queries.GetProfileByUserID(ctx, int32(userID))
	var zeroNumeric pgtype.Numeric
	_ = zeroNumeric.Scan("0")
	currentLat := zeroNumeric
	currentLon := zeroNumeric
	if existingProf.Latitude.Valid {
		currentLat = existingProf.Latitude
	}
	if existingProf.Longitude.Valid {
		currentLon = existingProf.Longitude
	}

	// 1. Process Avatar upload if provided
	var uploadedAvatarPath string
	if len(avatarData) > 0 {
		processed, mimeType, err := storage.ProcessImage(avatarData, storage.ProcessOptions{IsAvatarOrSelfie: true, Quality: 85})
		if err == nil {
			filename := fmt.Sprintf("avatar_%d_%s.webp", userID, uuid.NewString()[:8])
			path, err := s.storage.Save(ctx, "avatars", filename, bytes.NewReader(processed), int64(len(processed)), mimeType)
			if err == nil {
				uploadedAvatarPath = path
				_, _ = s.queries.UpdateProfileAvatar(ctx, db.UpdateProfileAvatarParams{
					UserID:    int32(userID),
					AvatarUrl: path,
				})
			}
		}
	} else {
		var candidateAvatar string
		if payload != nil {
			if payload.Avatar != nil && strings.TrimSpace(*payload.Avatar) != "" {
				candidateAvatar = strings.TrimSpace(*payload.Avatar)
			} else if payload.Profile != nil && payload.Profile.Avatar != nil && strings.TrimSpace(*payload.Profile.Avatar) != "" {
				candidateAvatar = strings.TrimSpace(*payload.Profile.Avatar)
			}
		}
		if candidateAvatar != "" {
			_, _ = s.queries.UpdateProfileAvatar(ctx, db.UpdateProfileAvatarParams{
				UserID:    int32(userID),
				AvatarUrl: candidateAvatar,
			})
		}
	}

	// 2. Process Selfie upload if provided
	if len(selfieData) > 0 {
		processed, mimeType, err := storage.ProcessImage(selfieData, storage.ProcessOptions{IsAvatarOrSelfie: true, Quality: 85})
		if err == nil {
			filename := fmt.Sprintf("selfie_%d_%s.webp", userID, uuid.NewString()[:8])
			path, err := s.storage.Save(ctx, "selfies", filename, bytes.NewReader(processed), int64(len(processed)), mimeType)
			if err == nil {
				_, _ = s.queries.UpdateProfileSelfie(ctx, db.UpdateProfileSelfieParams{
					UserID:    int32(userID),
					SelfieUrl: pgtype.Text{String: path, Valid: true},
				})
			}
		}
	}

	// 3. Process Gallery photo upload if provided (Rule: max 1 per request)
	if len(galleryData) > 0 {
		processed, mimeType, err := storage.ProcessImage(galleryData, storage.ProcessOptions{IsAvatarOrSelfie: false, Quality: 85})
		if err == nil {
			filename := fmt.Sprintf("gallery_%d_%s.webp", userID, uuid.NewString()[:8])
			savedPath, err := s.storage.Save(ctx, "images", filename, bytes.NewReader(processed), int64(len(processed)), mimeType)
			if err == nil {
				isProfilePic := false
				var desc string
				if payload != nil && payload.Gallery != nil {
					if payload.Gallery.IsProfilePicture != nil {
						isProfilePic = *payload.Gallery.IsProfilePicture
					}
					if payload.Gallery.Description != nil {
						desc = *payload.Gallery.Description
					}
				}

				// Default isProfilePicture: true for first gallery image if omitted
				existingGalleries, _ := s.queries.ListUserGalleries(ctx, int32(userID))
				if len(existingGalleries) == 0 && (payload == nil || payload.Gallery == nil || payload.Gallery.IsProfilePicture == nil) {
					isProfilePic = true
				}

				if isProfilePic {
					_ = s.queries.ClearUserProfilePictures(ctx, int32(userID))
				}

				// If updating existing gallery image by ID
				if payload != nil && payload.Gallery != nil && payload.Gallery.ID != nil && *payload.Gallery.ID > 0 {
					gID := int32(*payload.Gallery.ID)
					_, _ = s.queries.UpdateUserGallery(ctx, db.UpdateUserGalleryParams{
						ID:               gID,
						UserID:           int32(userID),
						ImageUrl:         savedPath,
						Description:      pgtype.Text{String: desc, Valid: desc != ""},
						IsProfilePicture: isProfilePic,
					})
				} else {
					_, _ = s.queries.CreateUserGallery(ctx, db.CreateUserGalleryParams{
						UserID:           int32(userID),
						ImageUrl:         savedPath,
						Description:      pgtype.Text{String: desc, Valid: desc != ""},
						IsProfilePicture: isProfilePic,
					})
				}

				if isProfilePic {
					_ = s.queries.UpdateProfilePictureURL(ctx, db.UpdateProfilePictureURLParams{
						UserID:            int32(userID),
						ProfilePictureUrl: pgtype.Text{String: savedPath, Valid: true},
					})
				}
			}
		}
	}

	// 4. Update Profile Picture Selection via profilePictureId if provided
	if payload != nil && payload.ProfilePictureID != nil && *payload.ProfilePictureID > 0 {
		gID := int32(*payload.ProfilePictureID)
		g, err := s.queries.GetUserGalleryByID(ctx, gID)
		if err == nil && g.UserID == int32(userID) {
			_ = s.queries.ClearUserProfilePictures(ctx, int32(userID))
			_ = s.queries.SetUserProfilePicture(ctx, db.SetUserProfilePictureParams{
				ID:     gID,
				UserID: int32(userID),
			})
			_ = s.queries.UpdateProfilePictureURL(ctx, db.UpdateProfilePictureURLParams{
				UserID:            int32(userID),
				ProfilePictureUrl: pgtype.Text{String: g.ImageUrl, Valid: true},
			})
		}
	}

	// 5. Update Profile details
	if payload != nil {
		if payload.Language != nil {
			lang := db.LanguageEN
			if strings.EqualFold(*payload.Language, "FA") {
				lang = db.LanguageFA
			}
			_ = s.queries.UpdateUserLanguage(ctx, db.UpdateUserLanguageParams{
				ID:       int32(userID),
				Language: lang,
			})
		}

		var firstName string
		var username pgtype.Text
		var phone pgtype.Text
		var bio pgtype.Text
		var languagesBytes []byte
		var relationType db.NullRelationType

		if payload.Profile != nil {
			if payload.Profile.FullName != nil {
				firstName = *payload.Profile.FullName
			}
			if payload.Profile.Username != nil {
				username = pgtype.Text{String: *payload.Profile.Username, Valid: true}
			}
			if payload.Profile.PhoneNumber != nil {
				phone = pgtype.Text{String: *payload.Profile.PhoneNumber, Valid: true}
			}
			if payload.Profile.Bio != nil {
				bio = pgtype.Text{String: *payload.Profile.Bio, Valid: true}
			}
			if payload.Profile.Languages != nil {
				languagesBytes, _ = json.Marshal(*payload.Profile.Languages)
			}
			if payload.Profile.RelationType != nil {
				relationType = normalizeRelationType(*payload.Profile.RelationType)
			} else if payload.Profile.Preferences != nil && payload.Profile.Preferences.Relation != nil {
				relationType = normalizeRelationType(*payload.Profile.Preferences.Relation)
			} else if payload.Profile.Preferences != nil && payload.Profile.Preferences.Relation != nil {
				relationType = db.NullRelationType{RelationType: db.RelationType(*payload.Profile.Preferences.Relation), Valid: true}
			}
		}

		latNumeric := currentLat
		if payload.Lat != nil {
			_ = latNumeric.Scan(strconv.FormatFloat(*payload.Lat, 'f', 8, 64))
		}
		lonNumeric := currentLon
		if payload.Lon != nil {
			_ = lonNumeric.Scan(strconv.FormatFloat(*payload.Lon, 'f', 8, 64))
		}

		if firstName == "" && existingProf.FirstName != "" {
			firstName = existingProf.FirstName
		}

		avatarToSave := uploadedAvatarPath
		if avatarToSave == "" && payload != nil {
			if payload.Profile != nil && payload.Profile.Avatar != nil && *payload.Profile.Avatar != "" {
				avatarToSave = *payload.Profile.Avatar
			} else if payload.Profile != nil && payload.Profile.AvatarUrl != nil && *payload.Profile.AvatarUrl != "" {
				avatarToSave = *payload.Profile.AvatarUrl
			} else if payload.Avatar != nil && *payload.Avatar != "" {
				avatarToSave = *payload.Avatar
			} else if payload.AvatarUrl != nil && *payload.AvatarUrl != "" {
				avatarToSave = *payload.AvatarUrl
			}
		}
		if avatarToSave == "" && existingProf.AvatarUrl != "" {
			avatarToSave = existingProf.AvatarUrl
		}

		_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
			UserID:       int32(userID),
			FirstName:    firstName,
			Username:     username,
			PhoneNumber:  phone,
			Bio:          bio,
			Languages:    languagesBytes,
			RelationType: relationType,
			AvatarUrl:    avatarToSave,
			Latitude:     latNumeric,
			Longitude:    lonNumeric,
		})

		// Demographic updates
		if payload.Profile != nil && payload.Profile.Demographic != nil {
			dem := payload.Profile.Demographic
			existingDem, _ := s.queries.GetDemographicByUserID(ctx, int32(userID))

			var birthDate pgtype.Date
			if dem.BirthDate != nil {
				if t, err := time.Parse("2006-01-02", *dem.BirthDate); err == nil {
					birthDate = pgtype.Date{Time: t, Valid: true}
				}
			} else if existingDem.BirthDate.Valid {
				birthDate = existingDem.BirthDate
			}

			var gender db.Gender
			if dem.Gender != nil {
				if strings.EqualFold(*dem.Gender, "FEMALE") {
					gender = db.GenderFEMALE
				} else if strings.EqualFold(*dem.Gender, "MALE") {
					gender = db.GenderMALE
				}
			} else if existingDem.Gender != "" {
				gender = existingDem.Gender
			}

			// Upsert only if we have valid birthDate and gender (or an existing demographic row to satisfy NOT NULL)
			if birthDate.Valid && gender != "" {
				var height pgtype.Int2
				if dem.Height != nil {
					height = pgtype.Int2{Int16: int16(*dem.Height), Valid: true}
				} else if existingDem.Height.Valid {
					height = existingDem.Height
				}
				var degree db.NullEducationStatus
				if dem.Degree != nil {
					degree = normalizeEducationStatus(*dem.Degree)
				} else if existingDem.Degree.Valid {
					degree = existingDem.Degree
				}
				var prof pgtype.Text
				if dem.Profession != nil {
					prof = pgtype.Text{String: *dem.Profession, Valid: true}
				} else if existingDem.Profession.Valid {
					prof = existingDem.Profession
				}
				var relStatus db.NullRelationshipStatus
				if dem.RelationStatus != nil {
					relStatus = normalizeRelationshipStatus(*dem.RelationStatus)
				} else if existingDem.RelationStatus.Valid {
					relStatus = existingDem.RelationStatus
				}
				var cityID pgtype.Int4
				targetCityID := dem.CityID
				if targetCityID == nil && dem.City != nil && dem.City.ID != nil {
					targetCityID = dem.City.ID
				}
				if targetCityID != nil {
					cityID = pgtype.Int4{Int32: int32(*targetCityID), Valid: true}
				} else if existingDem.CityID.Valid {
					cityID = existingDem.CityID
				}
				var cityName pgtype.Text
				if dem.CityName != nil {
					cityName = pgtype.Text{String: *dem.CityName, Valid: true}
				} else if targetCityID != nil {
					if city, ok := s.geoService.GetCity(*targetCityID); ok && city != nil {
						cityName = pgtype.Text{String: city.Name, Valid: true}
					}
				} else if existingDem.CityName.Valid {
					cityName = existingDem.CityName
				}

				if _, err := s.queries.UpsertDemographic(ctx, db.UpsertDemographicParams{
					UserID:         int32(userID),
					BirthDate:      birthDate,
					Gender:         gender,
					Height:         height,
					Degree:         degree,
					Profession:     prof,
					RelationStatus: relStatus,
					CityID:         cityID,
					CityName:       cityName,
				}); err != nil {
					log.Printf("[UpdateProfile] UpsertDemographic error for user %d: %v", userID, err)
				}
			}
		}

		// Privacy acceptance persistence if requested
		if payload.PrivacyAccepted != nil && *payload.PrivacyAccepted {
			_, _ = s.queries.AcceptUserPrivacy(ctx, int32(userID))
		}

		// User Question Answers persistence
		if err := s.updateQuestionAnswers(ctx, userID, payload); err != nil {
			log.Printf("[UpdateProfile] updateQuestionAnswers error for user %d: %v", userID, err)
		}

		// Liked Activities / Interests persistence
		if err := s.updateInterests(ctx, userID, payload); err != nil {
			log.Printf("[UpdateProfile] updateInterests error for user %d: %v", userID, err)
		}
	}

	return s.GetProfile(ctx, userID)
}

func (s *Service) updateInterests(ctx context.Context, userID int64, payload *UpdateProfilePayload) error {
	if payload == nil {
		return nil
	}

	var interestCandidates []interface{}
	for _, c := range []interface{}{
		payload.LikedActivities,
		payload.LikedActivitiesCapital,
		payload.Interests,
		payload.InterestsCapital,
		payload.Interest,
		payload.Favorites,
		payload.FavoritesCapital,
	} {
		if c != nil {
			interestCandidates = append(interestCandidates, c)
		}
	}

	if payload.Profile != nil {
		for _, c := range []interface{}{
			payload.Profile.LikedActivities,
			payload.Profile.LikedActivitiesCapital,
			payload.Profile.Interests,
			payload.Profile.InterestsCapital,
			payload.Profile.Interest,
			payload.Profile.Favorites,
			payload.Profile.FavoritesCapital,
		} {
			if c != nil {
				interestCandidates = append(interestCandidates, c)
			}
		}
	}

	if len(interestCandidates) == 0 {
		return nil
	}

	allInterests, err := s.queries.ListInterests(ctx)
	isInterestID := make(map[int32]bool)
	if err == nil {
		for _, in := range allInterests {
			isInterestID[in.ID] = true
		}
	}

	var interestIDs []int32

	for _, raw := range interestCandidates {
		if str, ok := raw.(string); ok {
			trimmed := strings.TrimSpace(str)
			if strings.HasPrefix(trimmed, "[") || strings.HasPrefix(trimmed, "{") {
				var unmarshaled interface{}
				if err := json.Unmarshal([]byte(trimmed), &unmarshaled); err == nil {
					raw = unmarshaled
				}
			} else if strings.Contains(trimmed, ",") {
				parts := strings.Split(trimmed, ",")
				for _, p := range parts {
					if id, ok := toInt32(strings.TrimSpace(p)); ok && id > 0 {
						interestIDs = append(interestIDs, id)
					}
				}
				continue
			} else if id, ok := toInt32(trimmed); ok && id > 0 {
				interestIDs = append(interestIDs, id)
				continue
			}
		}

		switch v := raw.(type) {
		case []interface{}:
			for _, item := range v {
				if id, ok := toInt32(item); ok && id > 0 {
					interestIDs = append(interestIDs, id)
				} else if m, ok := item.(map[string]interface{}); ok {
					for _, k := range []string{"interestId", "interest_id", "id", "ID"} {
						if idVal, exists := m[k]; exists {
							if id, ok := toInt32(idVal); ok && id > 0 {
								interestIDs = append(interestIDs, id)
								break
							}
						}
					}
				}
			}
		case map[string]interface{}:
			for k, val := range v {
				kID, kOk := toInt32(k)

				// Boolean value: e.g. {"10": true} -> 10 is interest ID
				if b, ok := val.(bool); ok {
					if b && kOk && kID > 0 {
						interestIDs = append(interestIDs, kID)
					}
					continue
				}

				// String boolean: e.g. {"10": "true"}
				if s, ok := val.(string); ok && (strings.EqualFold(s, "true") || s == "1") {
					if kOk && kID > 0 {
						interestIDs = append(interestIDs, kID)
					}
					continue
				}

				// Array value: e.g. {"1": [10, 11]} -> category 1, interests 10, 11
				if arr, ok := val.([]interface{}); ok {
					for _, item := range arr {
						if id, ok := toInt32(item); ok && id > 0 {
							interestIDs = append(interestIDs, id)
						}
					}
					continue
				}

				// Map value: e.g. {"1": {"id": 10}}
				if m, ok := val.(map[string]interface{}); ok {
					for _, itemKey := range []string{"interestId", "interest_id", "id", "ID"} {
						if idVal, exists := m[itemKey]; exists {
							if id, ok := toInt32(idVal); ok && id > 0 {
								interestIDs = append(interestIDs, id)
								break
							}
						}
					}
					continue
				}

				// Number value: e.g. {"1": 10} or {"10": 1}
				if vID, ok := toInt32(val); ok && vID > 0 {
					if isInterestID[vID] {
						interestIDs = append(interestIDs, vID)
					} else if kOk && isInterestID[kID] && vID == 1 {
						interestIDs = append(interestIDs, kID)
					} else {
						interestIDs = append(interestIDs, vID)
					}
				}
			}
		}
	}

	seen := make(map[int32]bool)
	var uniqueInterestIDs []int32
	for _, id := range interestIDs {
		if !seen[id] && id > 0 && (len(isInterestID) == 0 || isInterestID[id]) {
			seen[id] = true
			uniqueInterestIDs = append(uniqueInterestIDs, id)
		}
	}

	_ = s.queries.DeleteUserInterests(ctx, int32(userID))
	for _, iID := range uniqueInterestIDs {
		_ = s.queries.InsertUserInterest(ctx, db.InsertUserInterestParams{
			UserID:     int32(userID),
			InterestID: iID,
			IsLiked:    true,
		})
	}

	return nil
}

func (s *Service) updateQuestionAnswers(ctx context.Context, userID int64, payload *UpdateProfilePayload) error {
	if payload == nil {
		return nil
	}

	var answerCandidates []interface{}
	for _, c := range []interface{}{
		payload.Answers,
		payload.AnswersCapital,
		payload.Questions,
		payload.QuestionsCapital,
		payload.QuestionAnswers,
	} {
		if c != nil {
			answerCandidates = append(answerCandidates, c)
		}
	}

	if payload.Profile != nil {
		for _, c := range []interface{}{
			payload.Profile.Answers,
			payload.Profile.AnswersCapital,
			payload.Profile.Questions,
			payload.Profile.QuestionsCapital,
			payload.Profile.QuestionAnswers,
		} {
			if c != nil {
				answerCandidates = append(answerCandidates, c)
			}
		}
	}

	if len(answerCandidates) == 0 {
		return nil
	}

	allQAns, err := s.queries.ListQuestionAnswers(ctx)
	if err != nil {
		return err
	}

	qAnswersMap := make(map[int32][]db.QuestionAnswers)
	dbIDExists := make(map[int32]bool)
	for _, qa := range allQAns {
		qAnswersMap[qa.QuestionID] = append(qAnswersMap[qa.QuestionID], qa)
		dbIDExists[qa.ID] = true
	}

	var targetAnswerDbIDs []int32

	for _, raw := range answerCandidates {
		if str, ok := raw.(string); ok {
			trimmed := strings.TrimSpace(str)
			if strings.HasPrefix(trimmed, "[") || strings.HasPrefix(trimmed, "{") {
				var unmarshaled interface{}
				if err := json.Unmarshal([]byte(trimmed), &unmarshaled); err == nil {
					raw = unmarshaled
				}
			}
		}

		switch v := raw.(type) {
		case map[string]interface{}:
			for qKey, aVal := range v {
				qID, err := strconv.Atoi(qKey)
				if err != nil {
					continue
				}
				qID32 := int32(qID)

				// Boolean value: e.g. {"6": true} where 6 is answer DB ID
				if b, ok := aVal.(bool); ok {
					if b && dbIDExists[qID32] {
						targetAnswerDbIDs = append(targetAnswerDbIDs, qID32)
					}
					continue
				}

				qAnswers := qAnswersMap[qID32]

				var items []interface{}
				if arr, ok := aVal.([]interface{}); ok {
					items = arr
				} else {
					items = []interface{}{aVal}
				}

				for _, it := range items {
					if itMap, ok := it.(map[string]interface{}); ok {
						for _, k := range []string{"answerId", "answerid", "answer_id", "id", "aId"} {
							if val, exists := itMap[k]; exists {
								if id, ok := toInt32(val); ok {
									if dbIDExists[id] {
										targetAnswerDbIDs = append(targetAnswerDbIDs, id)
										break
									} else if id >= 0 && int(id) < len(qAnswers) {
										targetAnswerDbIDs = append(targetAnswerDbIDs, qAnswers[id].ID)
										break
									}
								}
							}
						}
						if idxVal, exists := itMap["index"]; exists {
							if idx, ok := toInt32(idxVal); ok && idx >= 0 && int(idx) < len(qAnswers) {
								targetAnswerDbIDs = append(targetAnswerDbIDs, qAnswers[idx].ID)
							}
						}
						continue
					}

					if idx, ok := toInt32(it); ok {
						if idx >= 0 && int(idx) < len(qAnswers) {
							targetAnswerDbIDs = append(targetAnswerDbIDs, qAnswers[idx].ID)
						} else if dbIDExists[idx] {
							targetAnswerDbIDs = append(targetAnswerDbIDs, idx)
						}
					}
				}
			}
		case []interface{}:
			for _, item := range v {
				if m, ok := item.(map[string]interface{}); ok {
					var qIDVal, aIDVal int32
					var hasQ, hasA bool
					for _, k := range []string{"questionId", "questionid", "question_id", "qId"} {
						if val, exists := m[k]; exists {
							if id, ok := toInt32(val); ok {
								qIDVal = id
								hasQ = true
								break
							}
						}
					}
					for _, k := range []string{"answerId", "answerid", "answer_id", "aId", "id", "index"} {
						if val, exists := m[k]; exists {
							if id, ok := toInt32(val); ok {
								aIDVal = id
								hasA = true
								break
							}
						}
					}
					if hasQ && hasA {
						qAnswers := qAnswersMap[qIDVal]
						if aIDVal >= 0 && int(aIDVal) < len(qAnswers) {
							targetAnswerDbIDs = append(targetAnswerDbIDs, qAnswers[aIDVal].ID)
						} else if dbIDExists[aIDVal] {
							targetAnswerDbIDs = append(targetAnswerDbIDs, aIDVal)
						}
					} else if hasA && dbIDExists[aIDVal] {
						targetAnswerDbIDs = append(targetAnswerDbIDs, aIDVal)
					}
				} else if id, ok := toInt32(item); ok {
					if dbIDExists[id] {
						targetAnswerDbIDs = append(targetAnswerDbIDs, id)
					}
				}
			}
		}
	}

	seen := make(map[int32]bool)
	var uniqueAnswerIDs []int32
	for _, id := range targetAnswerDbIDs {
		if !seen[id] && id > 0 {
			seen[id] = true
			uniqueAnswerIDs = append(uniqueAnswerIDs, id)
		}
	}

	_ = s.queries.DeleteUserQuestionAnswers(ctx, int32(userID))
	for _, aID := range uniqueAnswerIDs {
		_ = s.queries.InsertUserQuestionAnswer(ctx, db.InsertUserQuestionAnswerParams{
			UserID:           int32(userID),
			QuestionAnswerID: aID,
		})
	}

	return nil
}

func (s *Service) DeleteAccount(ctx context.Context, userID int64) error {
	return s.queries.DeleteUser(ctx, int32(userID))
}

func (s *Service) DeleteGalleryImage(ctx context.Context, userID, galleryID int64) error {
	g, err := s.queries.GetUserGalleryByID(ctx, int32(galleryID))
	if err != nil || g.UserID != int32(userID) {
		return errors.New("Gallery image not found or does not belong to user")
	}

	wasProfilePic := g.IsProfilePicture
	_ = s.queries.DeleteUserGallery(ctx, db.DeleteUserGalleryParams{
		ID:     int32(galleryID),
		UserID: int32(userID),
	})

	if wasProfilePic {
		// Fallback to another gallery photo
		galleries, _ := s.queries.ListUserGalleries(ctx, int32(userID))
		if len(galleries) > 0 {
			first := galleries[0]
			_ = s.queries.SetUserProfilePicture(ctx, db.SetUserProfilePictureParams{
				ID:     first.ID,
				UserID: int32(userID),
			})
			_ = s.queries.UpdateProfilePictureURL(ctx, db.UpdateProfilePictureURLParams{
				UserID:            int32(userID),
				ProfilePictureUrl: pgtype.Text{String: first.ImageUrl, Valid: true},
			})
		} else {
			_ = s.queries.UpdateProfilePictureURL(ctx, db.UpdateProfilePictureURLParams{
				UserID:            int32(userID),
				ProfilePictureUrl: pgtype.Text{Valid: false},
			})
		}
	}

	return nil
}

func (s *Service) GetUserDevices(ctx context.Context, userID, currentSessionID int64) (*UserDevicesResponseDto, error) {
	sessions, err := s.queries.ListUserSessions(ctx, int32(userID))
	if err != nil {
		return nil, err
	}

	devices := make([]UserDeviceItemDto, 0, len(sessions))
	activeDevices := make([]UserDeviceItemDto, 0, len(sessions))
	inactiveDevices := make([]UserDeviceItemDto, 0, len(sessions))

	now := time.Now().UTC()

	for _, sess := range sessions {
		var devInfo *string
		if sess.DeviceInfo.Valid && sess.DeviceInfo.String != "" {
			devInfo = &sess.DeviceInfo.String
		}

		var fcmToken *string
		if sess.FcmToken.Valid && sess.FcmToken.String != "" {
			fcmToken = &sess.FcmToken.String
		}

		var expiresAt *string
		isActive := false
		if sess.ExpiresAt.Valid {
			exp := sess.ExpiresAt.Time.UTC().Format(time.RFC3339)
			expiresAt = &exp
			if sess.ExpiresAt.Time.After(now) {
				isActive = true
			}
		}

		createdAt := ""
		if sess.CreatedAt.Valid {
			createdAt = sess.CreatedAt.Time.UTC().Format(time.RFC3339)
		}

		item := UserDeviceItemDto{
			ID:         int(sess.ID),
			DeviceInfo: devInfo,
			FcmToken:   fcmToken,
			IsActive:   isActive,
			IsCurrent:  int64(sess.ID) == currentSessionID,
			CreatedAt:  createdAt,
			ExpiresAt:  expiresAt,
		}

		devices = append(devices, item)
		if isActive {
			activeDevices = append(activeDevices, item)
		} else {
			inactiveDevices = append(inactiveDevices, item)
		}
	}

	return &UserDevicesResponseDto{
		Devices:         devices,
		ActiveDevices:   activeDevices,
		InactiveDevices: inactiveDevices,
		Total:           len(devices),
		ActiveCount:     len(activeDevices),
		InactiveCount:   len(inactiveDevices),
	}, nil
}

func (s *Service) TerminateDevice(ctx context.Context, userID, sessionID int64) error {
	return s.queries.DeleteUserSessionByDeviceID(ctx, db.DeleteUserSessionByDeviceIDParams{
		UserID: int32(userID),
		ID:     int32(sessionID),
	})
}

func (s *Service) TerminateAllDevices(ctx context.Context, userID, currentSessionID int64, excludeCurrent bool) error {
	if excludeCurrent && currentSessionID > 0 {
		sessions, err := s.queries.ListUserSessions(ctx, int32(userID))
		if err != nil {
			return err
		}
		for _, sess := range sessions {
			if int64(sess.ID) != currentSessionID {
				_ = s.queries.DeleteUserSession(ctx, sess.ID)
			}
		}
		return nil
	}
	return s.queries.DeleteUserSessionsByUserID(ctx, int32(userID))
}

func (s *Service) UpdateDeviceToken(ctx context.Context, userID int64, token, deviceInfo string) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE user_sessions
		SET fcm_token = $2, device_info = COALESCE(NULLIF($3, ''), device_info)
		WHERE user_id = $1
	`, userID, token, deviceInfo)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		// If no session exists for this user, insert an active record so device token is preserved
		_, err = s.pool.Exec(ctx, `
			INSERT INTO user_sessions (user_id, refresh_token_hash, device_info, fcm_token, expires_at, created_at)
			VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
		`, userID, uuid.NewString(), deviceInfo, token, time.Now().Add(30*24*time.Hour))
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) GetDeviceToken(ctx context.Context, userID int64) (*DeviceTokenDto, error) {
	row, err := s.queries.GetUserDeviceToken(ctx, int32(userID))
	if err != nil {
		return nil, errors.New("Device token not found")
	}
	var devInfo *string
	if row.DeviceInfo.Valid {
		devInfo = &row.DeviceInfo.String
	}
	return &DeviceTokenDto{
		Token:      row.FcmToken.String,
		DeviceInfo: devInfo,
	}, nil
}

func (s *Service) GetBulkUsers(ctx context.Context, userIDs []int64) ([]BulkUserItemDto, error) {
	list := make([]BulkUserItemDto, 0)
	for _, id := range userIDs {
		p, err := s.queries.GetProfileByUserID(ctx, int32(id))
		if err == nil {
			var fn *string
			if p.FirstName != "" {
				fn = &p.FirstName
			}
			var un *string
			if p.Username.Valid {
				un = &p.Username.String
			}
			list = append(list, BulkUserItemDto{
				ID:       int(id),
				Avatar:   s.resolveAssetURL(p.AvatarUrl),
				Username: un,
				FullName: fn,
			})
		}
	}
	return list, nil
}

func (s *Service) GetUserAvatar(ctx context.Context, userID int64) (*UserAvatarDto, error) {
	p, err := s.queries.GetProfileByUserID(ctx, int32(userID))
	if err != nil {
		return nil, errors.New("User not found")
	}
	return &UserAvatarDto{
		UserID: int(userID),
		Avatar: s.resolveAssetURL(p.AvatarUrl),
	}, nil
}

func (s *Service) GetBulkAvatars(ctx context.Context, userIDs []int64) ([]UserAvatarDto, error) {
	var list []UserAvatarDto
	for _, id := range userIDs {
		if av, err := s.GetUserAvatar(ctx, id); err == nil {
			list = append(list, *av)
		}
	}
	return list, nil
}

func normalizeRelationType(raw string) db.NullRelationType {
	s := strings.ToUpper(strings.TrimSpace(raw))
	switch s {
	case "FUN", "SHORT", "CASUAL":
		return db.NullRelationType{RelationType: db.RelationTypeFUN, Valid: true}
	case "OPEN", "FRIENDSHIP":
		return db.NullRelationType{RelationType: db.RelationTypeOPEN, Valid: true}
	case "LONG", "MARRIAGE":
		return db.NullRelationType{RelationType: db.RelationTypeLONG, Valid: true}
	default:
		return db.NullRelationType{RelationType: db.RelationType(s), Valid: s != ""}
	}
}

func normalizeEducationStatus(raw string) db.NullEducationStatus {
	s := strings.ToUpper(strings.TrimSpace(raw))
	switch s {
	case "HIGH_SCHOOL", "HIGH_SCHOOL_DIPLOMA":
		return db.NullEducationStatus{EducationStatus: db.EducationStatusHIGHSCHOOLDIPLOMA, Valid: true}
	case "SOME_COLLEGE":
		return db.NullEducationStatus{EducationStatus: db.EducationStatusSOMECOLLEGE, Valid: true}
	case "ASSOCIATE", "ASSOCIATE_DEGREE":
		return db.NullEducationStatus{EducationStatus: db.EducationStatusASSOCIATEDEGREE, Valid: true}
	case "BACHELOR", "BACHELOR_DEGREE":
		return db.NullEducationStatus{EducationStatus: db.EducationStatusBACHELORDEGREE, Valid: true}
	case "MASTER", "MASTER_DEGREE":
		return db.NullEducationStatus{EducationStatus: db.EducationStatusMASTERDEGREE, Valid: true}
	case "DOCTORATE", "PHD":
		return db.NullEducationStatus{EducationStatus: db.EducationStatusDOCTORATE, Valid: true}
	case "RATHER_NOT_SAY", "OTHER":
		return db.NullEducationStatus{EducationStatus: db.EducationStatusRATHERNOTSAY, Valid: true}
	default:
		return db.NullEducationStatus{EducationStatus: db.EducationStatus(s), Valid: s != ""}
	}
}

func normalizeRelationshipStatus(raw string) db.NullRelationshipStatus {
	s := strings.ToUpper(strings.TrimSpace(raw))
	switch s {
	case "SINGLE", "NEVER_MARRIED":
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatusSINGLE, Valid: true}
	case "IN_RELATION", "IN_A_RELATIONSHIP":
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatusINARELATIONSHIP, Valid: true}
	case "MARRIED":
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatusMARRIED, Valid: true}
	case "COMPLICATED":
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatusCOMPLICATED, Valid: true}
	case "OPEN_RELATIONSHIP", "OPEN":
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatusOPENRELATIONSHIP, Valid: true}
	case "DIVORCED":
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatusDIVORCED, Valid: true}
	case "WIDOWED":
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatusWIDOWED, Valid: true}
	case "RATHER_NOT_SAY":
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatusRATHERNOTSAY, Valid: true}
	default:
		return db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatus(s), Valid: s != ""}
	}
}

func (s *Service) AcceptPrivacy(ctx context.Context, userID int64) (*AcceptPrivacyResponseDto, error) {
	row, err := s.queries.AcceptUserPrivacy(ctx, int32(userID))
	if err != nil {
		return nil, err
	}

	prof, err := s.GetProfile(ctx, userID)
	if err != nil {
		return nil, err
	}

	var acceptedAt string
	if row.PrivacyAcceptedAt.Valid {
		acceptedAt = row.PrivacyAcceptedAt.Time.Format(time.RFC3339Nano)
	} else {
		acceptedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}

	return &AcceptPrivacyResponseDto{
		PrivacyAcceptedAt: acceptedAt,
		ProfileCompleted:  prof.Profile.ProfileCompleted,
	}, nil
}

func (s *Service) BlockUser(ctx context.Context, blockerID, blockedID int64, reason string) error {
	if blockerID == blockedID {
		return common.NewAppError(http.StatusBadRequest, common.ErrBadRequest, "You cannot block yourself")
	}
	if s.pool == nil {
		if s.broadcaster != nil {
			s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", blockerID), "user.blocked", map[string]interface{}{
				"userId":    blockedID,
				"blockedBy": blockerID,
			})
			s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", blockedID), "user.blocked", map[string]interface{}{
				"userId":    blockedID,
				"blockedBy": blockerID,
			})
		}
		return nil
	}
	if _, err := s.queries.GetUserByID(ctx, int32(blockedID)); err != nil {
		return common.NewAppError(http.StatusNotFound, common.ErrNotFound, "User not found")
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
		if s.broadcaster != nil {
			s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", blockerID), "user.unblocked", map[string]interface{}{
				"userId":      blockedID,
				"unblockedBy": blockerID,
			})
			s.broadcaster.BroadcastToRoom(fmt.Sprintf("user:%d", blockedID), "user.unblocked", map[string]interface{}{
				"userId":      blockedID,
				"unblockedBy": blockerID,
			})
		}
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

func (s *Service) IsBlocked(ctx context.Context, userA, userB int64) (bool, error) {
	if userA == userB || s.pool == nil {
		return false, nil
	}
	return s.queries.IsBlockedBothWays(ctx, db.IsBlockedBothWaysParams{
		BlockerID: userA,
		BlockedID: userB,
	})
}

func (s *Service) ListBlockedUsers(ctx context.Context, blockerID int64) ([]BlockedUserDto, error) {
	if s.pool == nil {
		return []BlockedUserDto{}, nil
	}
	rows, err := s.queries.ListBlockedUsersByBlocker(ctx, blockerID)
	if err != nil {
		return nil, err
	}
	list := make([]BlockedUserDto, 0, len(rows))
	for _, r := range rows {
		un := ""
		if r.Username.Valid {
			un = r.Username.String
		}
		fn := ""
		if r.FirstName.Valid {
			fn = r.FirstName.String
		}
		var picUrl *string
		if r.ProfilePictureUrl.Valid && r.ProfilePictureUrl.String != "" {
			u := s.resolveAssetURL(r.ProfilePictureUrl.String)
			picUrl = &u
		}
		list = append(list, BlockedUserDto{
			ID:                int64(r.ID),
			Username:          un,
			FirstName:         fn,
			ProfilePictureUrl: picUrl,
			AvatarUrl:         picUrl,
			BlockedAt:         r.BlockedAt.Time,
		})
	}
	return list, nil
}
