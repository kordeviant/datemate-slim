package admin

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"datemate/internal/config"
	"datemate/internal/platform/database/db"
	platformRedis "datemate/internal/platform/redis"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	cfg     *config.Config
	pool    *pgxpool.Pool
	queries *db.Queries
	rdb     *platformRedis.Client
}

func NewService(cfg *config.Config, pool *pgxpool.Pool, rdb *platformRedis.Client) *Service {
	return &Service{
		cfg:     cfg,
		pool:    pool,
		queries: db.New(pool),
		rdb:     rdb,
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

func (s *Service) GetStats(ctx context.Context) (*AdminDashboardStatsDto, error) {
	totalUsers, err := s.queries.CountUsersAdmin(ctx)
	if err != nil {
		return nil, err
	}

	pendingSelfies, err := s.queries.CountPendingSelfiesAdmin(ctx)
	if err != nil {
		return nil, err
	}

	return &AdminDashboardStatsDto{
		TotalUsers:     totalUsers,
		OnlineUsers:    0,
		PendingSelfies: pendingSelfies,
		PendingTickets: 0,
	}, nil
}

func (s *Service) GetOverview(ctx context.Context) (*AdminDashboardOverviewDto, error) {
	stats, err := s.GetStats(ctx)
	if err != nil {
		return nil, err
	}

	persianDays := []string{"شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"}
	weeklyActivity := make([]map[string]interface{}, 7)
	for i := 0; i < 7; i++ {
		weeklyActivity[i] = map[string]interface{}{
			"day":    persianDays[i],
			"active": 0,
			"date":   time.Now().AddDate(0, 0, -6+i).Format("2006-01-02"),
		}
	}

	genderStats := map[string]int64{
		"MALE":   0,
		"FEMALE": 0,
	}

	return &AdminDashboardOverviewDto{
		Stats:          *stats,
		WeeklyActivity: weeklyActivity,
		GenderStats:    genderStats,
		RecentSelfies:  []interface{}{},
	}, nil
}

func (s *Service) GetUsers(ctx context.Context, page, limit int) (*AdminUsersListResponseDto, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	total, err := s.queries.CountUsersAdmin(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.queries.ListUsersAdmin(ctx, db.ListUsersAdminParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, err
	}

	items := make([]AdminUserItemDto, 0, len(rows))
	for _, r := range rows {
		var fn, un, av, sf, gen, bd *string
		if r.FirstName.Valid && r.FirstName.String != "" {
			fn = &r.FirstName.String
		}
		if r.Username.Valid && r.Username.String != "" {
			un = &r.Username.String
		}
		if r.AvatarUrl.Valid && r.AvatarUrl.String != "" {
			u := s.resolveAssetURL(r.AvatarUrl.String)
			av = &u
		}
		if r.SelfieUrl.Valid && r.SelfieUrl.String != "" {
			u := s.resolveAssetURL(r.SelfieUrl.String)
			sf = &u
		}
		if r.Gender.Valid {
			g := string(r.Gender.Gender)
			gen = &g
		}
		if r.BirthDate.Valid {
			b := r.BirthDate.Time.Format("2006-01-02")
			bd = &b
		}

		isBanned := r.BannedUntil.Valid && r.BannedUntil.Time.After(time.Now().UTC())
		var bannedUntil *time.Time
		if r.BannedUntil.Valid {
			bannedUntil = &r.BannedUntil.Time
		}

		items = append(items, AdminUserItemDto{
			ID:               r.ID,
			Email:            r.Email,
			FirstName:        fn,
			Username:         un,
			AvatarUrl:        av,
			SelfieUrl:        sf,
			Gender:           gen,
			BirthDate:        bd,
			ProfileValidated: r.ProfileValidated,
			IsPremium:        r.IsPremium,
			IsBanned:         isBanned,
			BannedUntil:      bannedUntil,
			CreatedAt:        r.CreatedAt.Time,
		})
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	return &AdminUsersListResponseDto{
		Items:      items,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) GetUsersCount(ctx context.Context) (int64, error) {
	return s.queries.CountUsersAdmin(ctx)
}

func (s *Service) GetPendingSelfiesCount(ctx context.Context) (int64, error) {
	return s.queries.CountPendingVerificationsAdmin(ctx)
}

func (s *Service) BanUser(ctx context.Context, userID int, durationHours, durationDays *int, reason *string) error {
	var until time.Time
	if durationHours != nil && *durationHours > 0 {
		until = time.Now().UTC().Add(time.Duration(*durationHours) * time.Hour)
	} else if durationDays != nil && *durationDays > 0 {
		until = time.Now().UTC().AddDate(0, 0, *durationDays)
	} else {
		// Permanent ban
		until = time.Date(9999, 12, 31, 23, 59, 59, 0, time.UTC)
	}

	_ = s.queries.DeleteUserSessionsByUserID(ctx, int32(userID))
	return s.queries.BanUser(ctx, db.BanUserParams{
		ID:          int32(userID),
		BannedUntil: pgtype.Timestamp{Time: until, Valid: true},
	})
}

func (s *Service) GetUserDetails(ctx context.Context, userID int) (*AdminUserDetailsDto, error) {
	u, err := s.queries.GetUserByID(ctx, int32(userID))
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	p, _ := s.queries.GetProfileByUserID(ctx, int32(userID))
	d, _ := s.queries.GetDemographicByUserID(ctx, int32(userID))
	galleries, _ := s.queries.ListUserGalleries(ctx, int32(userID))
	interests, _ := s.queries.ListUserInterests(ctx, int32(userID))
	sessions, _ := s.queries.ListUserSessions(ctx, int32(userID))

	now := time.Now().UTC()
	var age *int
	if d.BirthDate.Valid {
		birth := d.BirthDate.Time
		a := now.Year() - birth.Year()
		if now.YearDay() < birth.YearDay() {
			a--
		}
		age = &a
	}

	hasPendingSelfie := !u.ProfileValidated && p.SelfieUrl.Valid && strings.TrimSpace(p.SelfieUrl.String) != ""

	galleryDtos := make([]AdminUserGalleryItemDto, 0, len(galleries))
	for _, g := range galleries {
		cStr := ""
		if g.CreatedAt.Valid {
			cStr = g.CreatedAt.Time.UTC().Format(time.RFC3339)
		}
		galleryDtos = append(galleryDtos, AdminUserGalleryItemDto{
			ID:         g.ID,
			URL:        s.resolveAssetURL(g.ImageUrl),
			LikesCount: g.LikesCount,
			CreatedAt:  cStr,
		})
	}

	var demoDto *AdminUserDemographicDto
	var cityName *string
	if d.CityName.Valid && d.CityName.String != "" {
		cityName = &d.CityName.String
	}
	var bDateStr *string
	if d.BirthDate.Valid {
		str := d.BirthDate.Time.Format("2006-01-02")
		bDateStr = &str
	}
	var gStr *string
	if d.Gender != "" {
		str := string(d.Gender)
		gStr = &str
	}
	var jobStr *string
	if d.Profession.Valid {
		jobStr = &d.Profession.String
	}
	var degStr *string
	if d.Degree.Valid {
		str := string(d.Degree.EducationStatus)
		degStr = &str
	}
	var relStr *string
	if d.RelationStatus.Valid {
		str := string(d.RelationStatus.RelationshipStatus)
		relStr = &str
	}
	var heightVal *int
	if d.Height.Valid {
		h := int(d.Height.Int16)
		heightVal = &h
	}
	demoDto = &AdminUserDemographicDto{
		BirthDate:      bDateStr,
		Gender:         gStr,
		Age:            age,
		CityName:       cityName,
		Job:            jobStr,
		Degree:         degStr,
		Height:         heightVal,
		RelationStatus: relStr,
	}

	interestNames := make([]string, 0, len(interests))
	for _, in := range interests {
		if in.NameEn != "" {
			interestNames = append(interestNames, in.NameEn)
		} else if in.NameFa != "" {
			interestNames = append(interestNames, in.NameFa)
		}
	}

	deviceDtos := make([]AdminUserDeviceDto, 0, len(sessions))
	for _, sess := range sessions {
		devInfo := "Unknown Device"
		if sess.DeviceInfo.Valid && sess.DeviceInfo.String != "" {
			devInfo = sess.DeviceInfo.String
		}
		var fcm *string
		if sess.FcmToken.Valid && sess.FcmToken.String != "" {
			fcm = &sess.FcmToken.String
		}
		expStr := sess.ExpiresAt.Time.UTC().Format(time.RFC3339)
		createStr := sess.CreatedAt.Time.UTC().Format(time.RFC3339)
		isActive := sess.ExpiresAt.Time.After(now)
		deviceDtos = append(deviceDtos, AdminUserDeviceDto{
			ID:         sess.ID,
			DeviceInfo: devInfo,
			FcmToken:   fcm,
			IsActive:   isActive,
			ExpiresAt:  expStr,
			CreatedAt:  createStr,
		})
	}

	var bannedUntilStr *string
	isBanned := false
	if u.BannedUntil.Valid && u.BannedUntil.Time.After(now) {
		isBanned = true
		str := u.BannedUntil.Time.UTC().Format(time.RFC3339)
		bannedUntilStr = &str
	}

	var avUrl *string
	if p.AvatarUrl != "" {
		resolved := s.resolveAssetURL(p.AvatarUrl)
		avUrl = &resolved
	}
	var sfUrl *string
	if p.SelfieUrl.Valid && p.SelfieUrl.String != "" {
		resolved := s.resolveAssetURL(p.SelfieUrl.String)
		sfUrl = &resolved
	}
	var un *string
	if p.Username.Valid && p.Username.String != "" {
		un = &p.Username.String
	}
	var phone *string
	if p.PhoneNumber.Valid && p.PhoneNumber.String != "" {
		phone = &p.PhoneNumber.String
	}
	var bio *string
	if p.Bio.Valid && p.Bio.String != "" {
		bio = &p.Bio.String
	}

	return &AdminUserDetailsDto{
		ID:               u.ID,
		Email:            u.Email,
		Role:             string(u.Role),
		Language:         string(u.Language),
		FullName:         p.FirstName,
		Username:         un,
		City:             cityName,
		PhoneNumber:      phone,
		Bio:              bio,
		Gender:           gStr,
		Age:              age,
		AvatarUrl:        avUrl,
		SelfieUrl:        sfUrl,
		ProfileValidated: u.ProfileValidated,
		HasPendingSelfie: hasPendingSelfie,
		BannedUntil:      bannedUntilStr,
		IsBanned:         isBanned,
		IsPremium:        u.IsPremium,
		CreatedAt:        u.CreatedAt.Time.UTC().Format(time.RFC3339),
		Gallery:          galleryDtos,
		Demographic:      demoDto,
		Interests:        interestNames,
		Devices:          deviceDtos,
		Likes:            []AdminUserLikeDto{},
	}, nil
}

func (s *Service) UpdateUser(ctx context.Context, userID int, payload *AdminUpdateUserPayload) (*AdminUserItemDto, error) {
	if payload == nil {
		return nil, fmt.Errorf("empty payload")
	}

	_, err := s.queries.GetUserByID(ctx, int32(userID))
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	if payload.ConfirmSelfie != nil {
		_ = s.queries.UpdateUserProfileValidated(ctx, db.UpdateUserProfileValidatedParams{
			ID:               int32(userID),
			ProfileValidated: *payload.ConfirmSelfie,
		})
	} else if payload.SelfieVerified != nil {
		_ = s.queries.UpdateUserProfileValidated(ctx, db.UpdateUserProfileValidatedParams{
			ID:               int32(userID),
			ProfileValidated: *payload.SelfieVerified,
		})
	} else if payload.ProfileValidated != nil {
		_ = s.queries.UpdateUserProfileValidated(ctx, db.UpdateUserProfileValidatedParams{
			ID:               int32(userID),
			ProfileValidated: *payload.ProfileValidated,
		})
	}

	if payload.IsPremium != nil {
		_ = s.queries.UpdateUserIsPremium(ctx, db.UpdateUserIsPremiumParams{
			ID:        int32(userID),
			IsPremium: *payload.IsPremium,
		})
	}

	if payload.Role != nil && *payload.Role != "" {
		_ = s.queries.UpdateUserRole(ctx, db.UpdateUserRoleParams{
			ID:   int32(userID),
			Role: db.Role(*payload.Role),
		})
	}

	var firstName string
	var username pgtype.Text
	var phone pgtype.Text
	var bio pgtype.Text
	if payload.FullName != nil {
		firstName = *payload.FullName
	}
	if payload.Username != nil {
		username = pgtype.Text{String: *payload.Username, Valid: true}
	}
	if payload.PhoneNumber != nil {
		phone = pgtype.Text{String: *payload.PhoneNumber, Valid: true}
	}
	if payload.Bio != nil {
		bio = pgtype.Text{String: *payload.Bio, Valid: true}
	}

	if firstName != "" || username.Valid || phone.Valid || bio.Valid {
		_, _ = s.queries.UpsertProfile(ctx, db.UpsertProfileParams{
			UserID:      int32(userID),
			FirstName:   firstName,
			Username:    username,
			PhoneNumber: phone,
			Bio:         bio,
		})
	}

	uUpdated, _ := s.queries.GetUserByID(ctx, int32(userID))
	pUpdated, _ := s.queries.GetProfileByUserID(ctx, int32(userID))
	dUpdated, _ := s.queries.GetDemographicByUserID(ctx, int32(userID))

	var fn *string
	if pUpdated.FirstName != "" {
		fn = &pUpdated.FirstName
	}
	var unUpdated *string
	if pUpdated.Username.Valid && pUpdated.Username.String != "" {
		unUpdated = &pUpdated.Username.String
	}
	var avUpdated *string
	if pUpdated.AvatarUrl != "" {
		resolved := s.resolveAssetURL(pUpdated.AvatarUrl)
		avUpdated = &resolved
	}
	var sfUpdated *string
	if pUpdated.SelfieUrl.Valid && pUpdated.SelfieUrl.String != "" {
		resolved := s.resolveAssetURL(pUpdated.SelfieUrl.String)
		sfUpdated = &resolved
	}
	var gen *string
	if dUpdated.Gender != "" {
		g := string(dUpdated.Gender)
		gen = &g
	}
	var bd *string
	if dUpdated.BirthDate.Valid {
		b := dUpdated.BirthDate.Time.Format("2006-01-02")
		bd = &b
	}

	isBanned := false
	var bannedUntil *time.Time
	if uUpdated.BannedUntil.Valid && uUpdated.BannedUntil.Time.After(time.Now().UTC()) {
		isBanned = true
		bannedUntil = &uUpdated.BannedUntil.Time
	}

	return &AdminUserItemDto{
		ID:               uUpdated.ID,
		Email:            uUpdated.Email,
		FirstName:        fn,
		Username:         unUpdated,
		AvatarUrl:        avUpdated,
		SelfieUrl:        sfUpdated,
		Gender:           gen,
		BirthDate:        bd,
		ProfileValidated: uUpdated.ProfileValidated,
		IsPremium:        uUpdated.IsPremium,
		IsBanned:         isBanned,
		BannedUntil:      bannedUntil,
		CreatedAt:        uUpdated.CreatedAt.Time,
	}, nil
}

func (s *Service) DeleteUserGallery(ctx context.Context, userID, galleryID int) error {
	return s.queries.DeleteUserGallery(ctx, db.DeleteUserGalleryParams{
		ID:     int32(galleryID),
		UserID: int32(userID),
	})
}

func (s *Service) GetUserDevices(ctx context.Context, userID int) ([]AdminUserDeviceDto, error) {
	sessions, err := s.queries.ListUserSessions(ctx, int32(userID))
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	deviceDtos := make([]AdminUserDeviceDto, 0, len(sessions))
	for _, sess := range sessions {
		devInfo := "Unknown Device"
		if sess.DeviceInfo.Valid && sess.DeviceInfo.String != "" {
			devInfo = sess.DeviceInfo.String
		}
		var fcm *string
		if sess.FcmToken.Valid && sess.FcmToken.String != "" {
			fcm = &sess.FcmToken.String
		}
		expStr := sess.ExpiresAt.Time.UTC().Format(time.RFC3339)
		createStr := sess.CreatedAt.Time.UTC().Format(time.RFC3339)
		isActive := sess.ExpiresAt.Time.After(now)
		deviceDtos = append(deviceDtos, AdminUserDeviceDto{
			ID:         sess.ID,
			DeviceInfo: devInfo,
			FcmToken:   fcm,
			IsActive:   isActive,
			ExpiresAt:  expStr,
			CreatedAt:  createStr,
		})
	}
	return deviceDtos, nil
}

func (s *Service) TerminateDevice(ctx context.Context, userID, deviceID int) error {
	return s.queries.DeleteUserSessionByDeviceID(ctx, db.DeleteUserSessionByDeviceIDParams{
		UserID: int32(userID),
		ID:     int32(deviceID),
	})
}

func (s *Service) TerminateAllDevices(ctx context.Context, userID int) error {
	return s.queries.DeleteUserSessionsByUserID(ctx, int32(userID))
}

func (s *Service) UnbanUser(ctx context.Context, userID int) error {
	return s.queries.UnbanUser(ctx, int32(userID))
}

func (s *Service) DeleteUser(ctx context.Context, userID int) error {
	return s.queries.DeleteUser(ctx, int32(userID))
}

func (s *Service) GetPendingVerifications(ctx context.Context, page, limit int) (*AdminVerificationsListResponseDto, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	total, err := s.queries.CountPendingVerificationsAdmin(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.queries.ListPendingVerificationsAdmin(ctx, db.ListPendingVerificationsAdminParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, err
	}

	items := make([]AdminVerificationItemDto, 0, len(rows))
	for _, r := range rows {
		var fn, un, av *string
		if r.FirstName != "" {
			fn = &r.FirstName
		}
		if r.Username.Valid && r.Username.String != "" {
			un = &r.Username.String
		}
		if r.AvatarUrl != "" {
			u := s.resolveAssetURL(r.AvatarUrl)
			av = &u
		}

		sf := ""
		if r.SelfieUrl.Valid {
			sf = s.resolveAssetURL(r.SelfieUrl.String)
		}

		items = append(items, AdminVerificationItemDto{
			ID:        r.ID,
			UserID:    r.ID,
			Email:     r.Email,
			FullName:  fn,
			Username:  un,
			AvatarUrl: av,
			SelfieUrl: sf,
			CreatedAt: r.CreatedAt.Time,
		})
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	return &AdminVerificationsListResponseDto{
		Items:      items,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) ApproveVerification(ctx context.Context, userID int) error {
	return s.queries.ApproveUserVerificationAdmin(ctx, int32(userID))
}

func (s *Service) RejectVerification(ctx context.Context, userID int) error {
	return s.queries.RejectUserVerificationAdmin(ctx, int32(userID))
}
