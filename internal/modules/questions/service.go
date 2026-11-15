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
	return common.ResolveAssetURL(s.cfg.AssetBaseURL, raw)
}

func (s *Service) mapQuestion(q db.Questions, ansRows []db.QuestionAnswers, lang string) *QuestionResponseDto {
	isFa := lang == "fa"
	primaryName := q.NameEn
	if isFa {
		primaryName = q.NameFa
	}

	var iconObj *QuestionIconResponseDto
	if q.Icon.Valid && strings.TrimSpace(q.Icon.String) != "" {
		iconObj = &QuestionIconResponseDto{
			Type: "IMAGE",
			Url:  s.resolveAssetURL(q.Icon.String),
			Alt:  q.IconAlt.String,
		}
	}

	answerType := string(q.AnswerType)
	if answerType == "" {
		answerType = "SINGLE"
	}

	answers := make([]QuestionAnswerDto, 0, len(ansRows))
	for idx, a := range ansRows {
		primaryAns := a.AnswerEn
		if isFa {
			primaryAns = a.AnswerFa
		}
		answers = append(answers, QuestionAnswerDto{
			ID:         idx, // 0-based index per question
			QuestionID: int(q.ID),
			Answer:     primaryAns,
			EnAnswer:   a.AnswerEn,
			FaAnswer:   a.AnswerFa,
			AnswerEn:   a.AnswerEn,
			AnswerFa:   a.AnswerFa,
		})
	}

	return &QuestionResponseDto{
		ID:         int(q.ID),
		Type:       q.Type,
		AnswerType: answerType,
		Name:       primaryName,
		EnName:     q.NameEn,
		FaName:     q.NameFa,
		NameEn:     q.NameEn,
		NameFa:     q.NameFa,
		Icon:       iconObj,
		Answers:    answers,
	}
}

func (s *Service) GetQuestions(ctx context.Context, typeFilter, language string, idFilter *int) (*QuestionListResponseDto, error) {
	normalizedType := strings.ToUpper(strings.TrimSpace(typeFilter))
	normalizedLang := strings.ToLower(strings.TrimSpace(language))

	if idFilter != nil {
		q, err := s.queries.GetQuestionByID(ctx, int32(*idFilter))
		if err != nil {
			return nil, common.NewAppError(404, common.ErrNotFound, fmt.Sprintf("Question with ID %d not found", *idFilter))
		}
		ansRows, err := s.queries.ListQuestionAnswersByQuestionID(ctx, q.ID)
		if err != nil {
			return nil, err
		}

		mapped := s.mapQuestion(q, ansRows, normalizedLang)
		var langPtr *string
		if normalizedLang != "" {
			langPtr = &normalizedLang
		}

		return &QuestionListResponseDto{
			Total:     1,
			Questions: []QuestionResponseDto{*mapped},
			Question:  mapped,
			ID:        idFilter,
			Type:      &mapped.Type,
			Language:  langPtr,
		}, nil
	}

	var qRows []db.Questions
	var err error
	if normalizedType != "" {
		qRows, err = s.queries.ListQuestionsByType(ctx, normalizedType)
	} else {
		qRows, err = s.queries.ListQuestions(ctx)
	}
	if err != nil {
		return nil, err
	}

	allAns, err := s.queries.ListQuestionAnswers(ctx)
	if err != nil {
		return nil, err
	}

	ansByQID := make(map[int32][]db.QuestionAnswers)
	for _, a := range allAns {
		ansByQID[a.QuestionID] = append(ansByQID[a.QuestionID], a)
	}

	result := make([]QuestionResponseDto, 0, len(qRows))
	for _, q := range qRows {
		mapped := s.mapQuestion(q, ansByQID[q.ID], normalizedLang)
		result = append(result, *mapped)
	}

	var typePtr *string
	if normalizedType != "" {
		typePtr = &normalizedType
	}
	var langPtr *string
	if normalizedLang != "" {
		langPtr = &normalizedLang
	}

	return &QuestionListResponseDto{
		Total:     len(result),
		Questions: result,
		Type:      typePtr,
		Language:  langPtr,
	}, nil
}

func (s *Service) CreateQuestion(ctx context.Context, payload CreateQuestionPayload) (*QuestionResponseDto, error) {
	nameEn := strings.TrimSpace(payload.NameEn)
	if nameEn == "" {
		nameEn = strings.TrimSpace(payload.EnName)
	}
	nameFa := strings.TrimSpace(payload.NameFa)
	if nameFa == "" {
		nameFa = strings.TrimSpace(payload.FaName)
	}

	ansType := payload.AnswerType
	if ansType == "" {
		ansType = "SINGLE"
	}

	created, err := s.queries.CreateQuestion(ctx, db.CreateQuestionParams{
		NameEn:     nameEn,
		NameFa:     nameFa,
		Type:       payload.Type,
		AnswerType: db.AnswerType(ansType),
		Icon:       pgtype.Text{String: payload.Icon, Valid: payload.Icon != ""},
		IconAlt:    pgtype.Text{String: payload.IconAlt, Valid: payload.IconAlt != ""},
	})
	if err != nil {
		return nil, err
	}

	for _, a := range payload.Answers {
		en := strings.TrimSpace(a.AnswerEn)
		if en == "" {
			en = strings.TrimSpace(a.EnAnswer)
		}
		fa := strings.TrimSpace(a.AnswerFa)
		if fa == "" {
			fa = strings.TrimSpace(a.FaAnswer)
		}
		_, _ = s.queries.CreateQuestionAnswer(ctx, db.CreateQuestionAnswerParams{
			QuestionID: created.ID,
			AnswerEn:   en,
			AnswerFa:   fa,
		})
	}

	ansRows, _ := s.queries.ListQuestionAnswersByQuestionID(ctx, created.ID)
	return s.mapQuestion(created, ansRows, ""), nil
}

func (s *Service) UpdateQuestion(ctx context.Context, id int, payload UpdateQuestionPayload) (*QuestionResponseDto, error) {
	q, err := s.queries.GetQuestionByID(ctx, int32(id))
	if err != nil {
		return nil, common.NewAppError(404, common.ErrNotFound, fmt.Sprintf("Question with ID %d not found", id))
	}

	nameEn := q.NameEn
	if payload.NameEn != nil && strings.TrimSpace(*payload.NameEn) != "" {
		nameEn = strings.TrimSpace(*payload.NameEn)
	} else if payload.EnName != nil && strings.TrimSpace(*payload.EnName) != "" {
		nameEn = strings.TrimSpace(*payload.EnName)
	}

	nameFa := q.NameFa
	if payload.NameFa != nil && strings.TrimSpace(*payload.NameFa) != "" {
		nameFa = strings.TrimSpace(*payload.NameFa)
	} else if payload.FaName != nil && strings.TrimSpace(*payload.FaName) != "" {
		nameFa = strings.TrimSpace(*payload.FaName)
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
			en := strings.TrimSpace(a.AnswerEn)
			if en == "" {
				en = strings.TrimSpace(a.EnAnswer)
			}
			fa := strings.TrimSpace(a.AnswerFa)
			if fa == "" {
				fa = strings.TrimSpace(a.FaAnswer)
			}
			_, _ = s.queries.CreateQuestionAnswer(ctx, db.CreateQuestionAnswerParams{
				QuestionID: int32(id),
				AnswerEn:   en,
				AnswerFa:   fa,
			})
		}
	}

	ansRows, _ := s.queries.ListQuestionAnswersByQuestionID(ctx, updated.ID)
	return s.mapQuestion(updated, ansRows, ""), nil
}

func (s *Service) DeleteQuestion(ctx context.Context, id int) error {
	_, err := s.queries.GetQuestionByID(ctx, int32(id))
	if err != nil {
		return common.NewAppError(404, common.ErrNotFound, fmt.Sprintf("Question with ID %d not found", id))
	}

	_ = s.queries.DeleteQuestionAnswersByQuestionID(ctx, int32(id))
	return s.queries.DeleteQuestion(ctx, int32(id))
}
