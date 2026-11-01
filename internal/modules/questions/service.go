package questions

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

func (s *Service) GetQuestions(ctx context.Context, typeFilter, language string, idFilter *int) ([]QuestionResponseDto, error) {
	var qRows []db.Questions

	if idFilter != nil {
		q, err := s.queries.GetQuestionByID(ctx, int32(*idFilter))
		if err != nil {
			return nil, common.NewAppError(404, common.ErrNotFound, fmt.Sprintf("Question with ID %d not found", *idFilter))
		}
		qRows = []db.Questions{q}
	} else if typeFilter != "" {
		rows, err := s.queries.ListQuestionsByType(ctx, typeFilter)
		if err != nil {
			return nil, err
		}
		qRows = rows
	} else {
		rows, err := s.queries.ListQuestions(ctx)
		if err != nil {
			return nil, err
		}
		qRows = rows
	}

	res := make([]QuestionResponseDto, 0, len(qRows))

	for _, q := range qRows {
		ansRows, err := s.queries.ListQuestionAnswersByQuestionID(ctx, q.ID)
		if err != nil {
			continue
		}

		answers := make([]QuestionAnswerDto, 0, len(ansRows))
		for _, a := range ansRows {
			var ansText *string
			if language == "fa" {
				ansText = &a.AnswerFa
			} else if language == "en" {
				ansText = &a.AnswerEn
			}

			answers = append(answers, QuestionAnswerDto{
				ID:       int(a.ID),
				AnswerEn: a.AnswerEn,
				AnswerFa: a.AnswerFa,
				Text:     ansText,
			})
		}

		var qText *string
		if language == "fa" {
			qText = &q.NameFa
		} else if language == "en" {
			qText = &q.NameEn
		}

		var iconPtr *string
		if q.Icon.Valid && q.Icon.String != "" {
			u := s.resolveAssetURL(q.Icon.String)
			iconPtr = &u
		}
		var altPtr *string
		if q.IconAlt.Valid && q.IconAlt.String != "" {
			altPtr = &q.IconAlt.String
		}

		res = append(res, QuestionResponseDto{
			ID:         int(q.ID),
			NameEn:     q.NameEn,
			NameFa:     q.NameFa,
			Type:       q.Type,
			AnswerType: string(q.AnswerType),
			Icon:       iconPtr,
			IconAlt:    altPtr,
			Text:       qText,
			Answers:    answers,
		})
	}

	return res, nil
}

func (s *Service) CreateQuestion(ctx context.Context, payload CreateQuestionPayload) (*QuestionResponseDto, error) {
	created, err := s.queries.CreateQuestion(ctx, db.CreateQuestionParams{
		NameEn:     payload.NameEn,
		NameFa:     payload.NameFa,
		Type:       payload.Type,
		AnswerType: db.AnswerType(payload.AnswerType),
		Icon:       pgtype.Text{String: payload.Icon, Valid: payload.Icon != ""},
		IconAlt:    pgtype.Text{String: payload.IconAlt, Valid: payload.IconAlt != ""},
	})
	if err != nil {
		return nil, err
	}

	answers := make([]QuestionAnswerDto, 0, len(payload.Answers))
	for _, a := range payload.Answers {
		ans, err := s.queries.CreateQuestionAnswer(ctx, db.CreateQuestionAnswerParams{
			QuestionID: created.ID,
			AnswerEn:   a.AnswerEn,
			AnswerFa:   a.AnswerFa,
		})
		if err == nil {
			answers = append(answers, QuestionAnswerDto{
				ID:       int(ans.ID),
				AnswerEn: ans.AnswerEn,
				AnswerFa: ans.AnswerFa,
			})
		}
	}

	var iconPtr *string
	if created.Icon.Valid && created.Icon.String != "" {
		u := s.resolveAssetURL(created.Icon.String)
		iconPtr = &u
	}
	var altPtr *string
	if created.IconAlt.Valid && created.IconAlt.String != "" {
		altPtr = &created.IconAlt.String
	}

	return &QuestionResponseDto{
		ID:         int(created.ID),
		NameEn:     created.NameEn,
		NameFa:     created.NameFa,
		Type:       created.Type,
		AnswerType: string(created.AnswerType),
		Icon:       iconPtr,
		IconAlt:    altPtr,
		Answers:    answers,
	}, nil
}

func (s *Service) UpdateQuestion(ctx context.Context, id int, payload UpdateQuestionPayload) (*QuestionResponseDto, error) {
	q, err := s.queries.GetQuestionByID(ctx, int32(id))
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, fmt.Sprintf("Question with ID %d not found", id))
	}

	nameEn := q.NameEn
	if payload.NameEn != nil {
		nameEn = *payload.NameEn
	}
	nameFa := q.NameFa
	if payload.NameFa != nil {
		nameFa = *payload.NameFa
	}
	qType := q.Type
	if payload.Type != nil {
		qType = *payload.Type
	}
	icon := q.Icon.String
	if payload.Icon != nil {
		icon = *payload.Icon
	}
	iconAlt := q.IconAlt.String
	if payload.IconAlt != nil {
		iconAlt = *payload.IconAlt
	}

	updated, err := s.queries.UpdateQuestion(ctx, db.UpdateQuestionParams{
		ID:      int32(id),
		NameEn:  nameEn,
		NameFa:  nameFa,
		Type:    qType,
		Icon:    pgtype.Text{String: icon, Valid: icon != ""},
		IconAlt: pgtype.Text{String: iconAlt, Valid: iconAlt != ""},
	})
	if err != nil {
		return nil, err
	}

	if payload.Answers != nil {
		_ = s.queries.DeleteQuestionAnswersByQuestionID(ctx, int32(id))
		for _, a := range *payload.Answers {
			_, _ = s.queries.CreateQuestionAnswer(ctx, db.CreateQuestionAnswerParams{
				QuestionID: int32(id),
				AnswerEn:   a.AnswerEn,
				AnswerFa:   a.AnswerFa,
			})
		}
	}

	list, err := s.GetQuestions(ctx, "", "", &id)
	if err != nil || len(list) == 0 {
		var iconPtr *string
		if updated.Icon.Valid {
			u := s.resolveAssetURL(updated.Icon.String)
			iconPtr = &u
		}
		return &QuestionResponseDto{
			ID:         int(updated.ID),
			NameEn:     updated.NameEn,
			NameFa:     updated.NameFa,
			Type:       updated.Type,
			AnswerType: string(updated.AnswerType),
			Icon:       iconPtr,
		}, nil
	}

	return &list[0], nil
}

func (s *Service) DeleteQuestion(ctx context.Context, id int) error {
	_, err := s.queries.GetQuestionByID(ctx, int32(id))
	if err != nil {
		return common.NewAppError(404, common.ErrNotFound, fmt.Sprintf("Question with ID %d not found", id))
	}

	_ = s.queries.DeleteQuestionAnswersByQuestionID(ctx, int32(id))
	return s.queries.DeleteQuestion(ctx, int32(id))
}
