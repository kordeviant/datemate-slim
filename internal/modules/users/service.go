package users

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"datemate/internal/config"
	"datemate/internal/platform/database/db"
	"datemate/internal/platform/geo"
	"datemate/internal/platform/storage"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	cfg        *config.Config
	pool       *pgxpool.Pool
	queries    *db.Queries
	geoService *geo.Service
	storage    storage.Engine
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
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw
	}
	clean := strings.TrimPrefix(raw, "/")
	return fmt.Sprintf("%s/%s", strings.TrimRight(s.cfg.AssetBaseURL, "/"), clean)
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
			FirstName: "User",
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
		if p.ProfilePictureUrl.Valid && p.ProfilePictureUrl.String != "" {
			resolved := s.resolveAssetURL(p.ProfilePictureUrl.String)
			activeProfilePicURL = &resolved
		} else if p.AvatarUrl != "" {
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
			var stateDto *StateResponseDto
			if state != nil {
				var countryDto *CountryResponseDto
				if country != nil {
					countryDto = &CountryResponseDto{
						ID:   &country.ID,
						Name: &country.Name,
						Code: &country.Code,
					}
				}
				stateDto = &StateResponseDto{
					ID:        &state.ID,
					Name:      &state.Name,
					CountryID: &state.CountryID,
					Country:   countryDto,
				}
			}
			cityDto = &CityResponseDto{
				ID:    &city.ID,
				Name:  &city.Name,
				State: stateDto,
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

	// Answers map
	answersMap := make(map[string]int)
	for _, a := range answers {
		answersMap[strconv.Itoa(int(a.QuestionID))] = int(a.QuestionAnswerID)
	}

	// LikedActivities map
	likedActivities := make(map[string]interface{})
	for _, in := range interests {
		likedActivities[strconv.Itoa(int(in.CategoryID))] = int(in.InterestID)
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
	if p.FirstName != "" {
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

	profileCompleted := p.FirstName != "" && (p.AvatarUrl != "" || len(galleryDtos) > 0) && d.Gender != ""

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

	emailStr := u.Email
	return &ProfileResponseDto{
		ID:               int(u.ID),
		Email:            &emailStr,
		Language:         string(u.Language),
		Lat:              latVal,
		Lon:              lonVal,
		ProfileValidated: u.ProfileValidated,
		IsPremium:        u.IsPremium,
		Profile:          nested,
		Gallery:          galleryDtos,
		ProfilePictureID: activeProfilePicID,
	}, nil
}

func (s *Service) UpdateProfile(
	ctx context.Context,
	userID int64,
	payload *UpdateProfilePayload,
	avatarData, selfieData, galleryData []byte,
) (*ProfileResponseDto, error) {
	// 1. Process Avatar upload if provided
	if len(avatarData) > 0 {
		processed, mimeType, err := storage.ProcessImage(avatarData, storage.ProcessOptions{IsAvatarOrSelfie: true, Quality: 85})
		if err == nil {
			filename := fmt.Sprintf("avatar_%d_%s.webp", userID, uuid.NewString()[:8])
			path, err := s.storage.Save(ctx, "avatars", filename, bytes.NewReader(processed), int64(len(processed)), mimeType)
			if err == nil {
				_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
					UserID:    int32(userID),
					AvatarUrl: path,
					Latitude:  pgtype.Numeric{Valid: true},
					Longitude: pgtype.Numeric{Valid: true},
				})
			}
		}
	}

	// 2. Process Selfie upload if provided
	if len(selfieData) > 0 {
		processed, mimeType, err := storage.ProcessImage(selfieData, storage.ProcessOptions{IsAvatarOrSelfie: true, Quality: 85})
		if err == nil {
			filename := fmt.Sprintf("selfie_%d_%s.webp", userID, uuid.NewString()[:8])
			path, err := s.storage.Save(ctx, "selfies", filename, bytes.NewReader(processed), int64(len(processed)), mimeType)
			if err == nil {
				_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
					UserID:    int32(userID),
					SelfieUrl: pgtype.Text{String: path, Valid: true},
					Latitude:  pgtype.Numeric{Valid: true},
					Longitude: pgtype.Numeric{Valid: true},
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
				relationType = db.NullRelationType{RelationType: db.RelationType(*payload.Profile.RelationType), Valid: true}
			}
		}

		var latNumeric pgtype.Numeric
		if payload.Lat != nil {
			_ = latNumeric.Scan(strconv.FormatFloat(*payload.Lat, 'f', 8, 64))
		}
		var lonNumeric pgtype.Numeric
		if payload.Lon != nil {
			_ = lonNumeric.Scan(strconv.FormatFloat(*payload.Lon, 'f', 8, 64))
		}

		_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
			UserID:       int32(userID),
			FirstName:    firstName,
			Username:     username,
			PhoneNumber:  phone,
			Bio:          bio,
			Languages:    languagesBytes,
			RelationType: relationType,
			Latitude:     latNumeric,
			Longitude:    lonNumeric,
		})

		// Demographic updates
		if payload.Profile != nil && payload.Profile.Demographic != nil {
			dem := payload.Profile.Demographic
			var birthDate pgtype.Date
			if dem.BirthDate != nil {
				if t, err := time.Parse("2006-01-02", *dem.BirthDate); err == nil {
					birthDate = pgtype.Date{Time: t, Valid: true}
				}
			}
			gender := db.GenderMALE
			if dem.Gender != nil && strings.EqualFold(*dem.Gender, "FEMALE") {
				gender = db.GenderFEMALE
			}
			var height pgtype.Int2
			if dem.Height != nil {
				height = pgtype.Int2{Int16: int16(*dem.Height), Valid: true}
			}
			var degree db.NullEducationStatus
			if dem.Degree != nil {
				degree = db.NullEducationStatus{EducationStatus: db.EducationStatus(*dem.Degree), Valid: true}
			}
			var prof pgtype.Text
			if dem.Profession != nil {
				prof = pgtype.Text{String: *dem.Profession, Valid: true}
			}
			var relStatus db.NullRelationshipStatus
			if dem.RelationStatus != nil {
				relStatus = db.NullRelationshipStatus{RelationshipStatus: db.RelationshipStatus(*dem.RelationStatus), Valid: true}
			}
			var cityID pgtype.Int4
			if dem.CityID != nil {
				cityID = pgtype.Int4{Int32: int32(*dem.CityID), Valid: true}
			}
			var cityName pgtype.Text
			if dem.CityName != nil {
				cityName = pgtype.Text{String: *dem.CityName, Valid: true}
			}

			_, _ = s.queries.UpsertDemographic(ctx, db.UpsertDemographicParams{
				UserID:         int32(userID),
				BirthDate:      birthDate,
				Gender:         gender,
				Height:         height,
				Degree:         degree,
				Profession:     prof,
				RelationStatus: relStatus,
				CityID:         cityID,
				CityName:       cityName,
			})
		}

		// User Question Answers persistence
		var rawAnswers interface{}
		if payload.Answers != nil {
			rawAnswers = payload.Answers
		} else if payload.Profile != nil && payload.Profile.Answers != nil {
			rawAnswers = payload.Profile.Answers
		}

		if rawAnswers != nil {
			var answerIDs []int32
			switch v := rawAnswers.(type) {
			case []interface{}:
				for _, item := range v {
					if id, ok := toInt32(item); ok && id > 0 {
						answerIDs = append(answerIDs, id)
					} else if m, ok := item.(map[string]interface{}); ok {
						for _, k := range []string{"questionAnswerId", "answerId", "id"} {
							if idVal, exists := m[k]; exists {
								if id, ok := toInt32(idVal); ok && id > 0 {
									answerIDs = append(answerIDs, id)
									break
								}
							}
						}
					}
				}
			case map[string]interface{}:
				for _, val := range v {
					if id, ok := toInt32(val); ok && id > 0 {
						answerIDs = append(answerIDs, id)
					} else if arr, ok := val.([]interface{}); ok {
						for _, item := range arr {
							if id, ok := toInt32(item); ok && id > 0 {
								answerIDs = append(answerIDs, id)
							}
						}
					}
				}
			}

			if len(answerIDs) > 0 {
				_ = s.queries.DeleteUserQuestionAnswers(ctx, int32(userID))
				for _, aID := range answerIDs {
					_ = s.queries.InsertUserQuestionAnswer(ctx, db.InsertUserQuestionAnswerParams{
						UserID:           int32(userID),
						QuestionAnswerID: aID,
					})
				}
			}
		}

		// Liked Activities / Interests persistence
		var rawInterests interface{}
		if payload.LikedActivities != nil {
			rawInterests = payload.LikedActivities
		} else if payload.Profile != nil && payload.Profile.LikedActivities != nil {
			rawInterests = payload.Profile.LikedActivities
		}

		if rawInterests != nil {
			var interestIDs []int32
			switch v := rawInterests.(type) {
			case []interface{}:
				for _, item := range v {
					if id, ok := toInt32(item); ok && id > 0 {
						interestIDs = append(interestIDs, id)
					} else if m, ok := item.(map[string]interface{}); ok {
						for _, k := range []string{"interestId", "id"} {
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
				for _, val := range v {
					if id, ok := toInt32(val); ok && id > 0 {
						interestIDs = append(interestIDs, id)
					} else if arr, ok := val.([]interface{}); ok {
						for _, item := range arr {
							if id, ok := toInt32(item); ok && id > 0 {
								interestIDs = append(interestIDs, id)
							}
						}
					}
				}
			}

			_ = s.queries.DeleteUserInterests(ctx, int32(userID))
			for _, iID := range interestIDs {
				_ = s.queries.InsertUserInterest(ctx, db.InsertUserInterestParams{
					UserID:     int32(userID),
					InterestID: iID,
					IsLiked:    true,
				})
			}
		}
	}

	return s.GetProfile(ctx, userID)
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

	var devices []UserDeviceItemDto
	for _, sess := range sessions {
		devInfo := "Unknown Device"
		if sess.DeviceInfo.Valid && sess.DeviceInfo.String != "" {
			devInfo = sess.DeviceInfo.String
		}
		devices = append(devices, UserDeviceItemDto{
			ID:         int(sess.ID),
			DeviceInfo: devInfo,
			IsCurrent:  int64(sess.ID) == currentSessionID,
			CreatedAt:  sess.CreatedAt.Time.UTC().Format(time.RFC3339),
		})
	}

	return &UserDevicesResponseDto{Devices: devices}, nil
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
	return s.queries.UpdateUserSessionDeviceToken(ctx, db.UpdateUserSessionDeviceTokenParams{
		UserID:     int32(userID),
		FcmToken:   pgtype.Text{String: token, Valid: true},
		DeviceInfo: pgtype.Text{String: deviceInfo, Valid: deviceInfo != ""},
	})
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
	var list []BulkUserItemDto
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
