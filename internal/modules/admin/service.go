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

func (s *Service) BanUser(ctx context.Context, userID int, durationDays int, reason *string) error {
	dur := durationDays
	if dur <= 0 {
		dur = 30 // default 30 days
	}
	until := time.Now().UTC().AddDate(0, 0, dur)

	return s.queries.BanUser(ctx, db.BanUserParams{
		ID:          int32(userID),
		BannedUntil: pgtype.Timestamp{Time: until, Valid: true},
	})
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
