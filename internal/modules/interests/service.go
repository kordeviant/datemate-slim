package interests

import (
	"context"
	"fmt"
	"strings"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/platform/database/db"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	cfg     *config.Config
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewService(cfg *config.Config, pool *pgxpool.Pool) *Service {
	return &Service{
		cfg:     cfg,
		pool:    pool,
		queries: db.New(pool),
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

func (s *Service) GetInterests(ctx context.Context, language string, idFilter *int) ([]InterestCategoryResponseDto, error) {
	var catRows []db.InterestCategories

	if idFilter != nil {
		c, err := s.queries.GetInterestCategoryByID(ctx, int32(*idFilter))
		if err != nil {
			return nil, common.NewAppError(404, common.ErrNotFound, fmt.Sprintf("Interest category with ID %d not found", *idFilter))
		}
		catRows = []db.InterestCategories{c}
	} else {
		rows, err := s.queries.ListInterestCategories(ctx)
		if err != nil {
			return nil, err
		}
		catRows = rows
	}

	res := make([]InterestCategoryResponseDto, 0, len(catRows))

	for _, cat := range catRows {
		inRows, err := s.queries.ListInterestsByCategoryID(ctx, cat.ID)
		if err != nil {
			continue
		}

		interests := make([]InterestItemResponseDto, 0, len(inRows))
		for _, in := range inRows {
			cID := int(cat.ID)
			var locName *string
			if language == "fa" {
				locName = &in.NameFa
			} else if language == "en" {
				locName = &in.NameEn
			}

			interests = append(interests, InterestItemResponseDto{
				ID:         int(in.ID),
				En:         in.NameEn,
				Fa:         in.NameFa,
				CategoryID: &cID,
				Name:       locName,
				EnName:     &in.NameEn,
				FaName:     &in.NameFa,
			})
		}

		var catName *string
		if language == "fa" {
			catName = &cat.NameFa
		} else if language == "en" {
			catName = &cat.NameEn
		}

		var iconDto *InterestIconResponseDto
		if cat.Media.Valid && cat.Media.String != "" {
			iconDto = &InterestIconResponseDto{
				Type: "IMAGE",
				Url:  s.resolveAssetURL(cat.Media.String),
				Alt:  "",
			}
		}

		res = append(res, InterestCategoryResponseDto{
			ID:       int(cat.ID),
			En:       cat.NameEn,
			Fa:       cat.NameFa,
			Icon:     iconDto,
			Interest: interests,
			Name:     catName,
			EnName:   &cat.NameEn,
			FaName:   &cat.NameFa,
		})
	}

	return res, nil
}

func (s *Service) CreateInterestCategory(ctx context.Context, dto CreateInterestCategoryDto) (*InterestCategoryResponseDto, error) {
	cat, err := s.queries.CreateInterestCategory(ctx, db.CreateInterestCategoryParams{
		NameEn: dto.NameEn,
		NameFa: dto.NameFa,
		Media:  pgtype.Text{String: dto.Icon, Valid: dto.Icon != ""},
	})
	if err != nil {
		return nil, err
	}

	for _, in := range dto.Interests {
		_, _ = s.queries.CreateInterest(ctx, db.CreateInterestParams{
			CategoryID: cat.ID,
			NameEn:     in.NameEn,
			NameFa:     in.NameFa,
			Media:      pgtype.Text{Valid: false},
		})
	}

	cID := int(cat.ID)
	list, err := s.GetInterests(ctx, "", &cID)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}
