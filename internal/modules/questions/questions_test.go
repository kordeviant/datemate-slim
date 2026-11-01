package questions

import (
	"encoding/json"
	"testing"

	"datemate/internal/config"
	"datemate/internal/platform/database/db"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestQuestionListResponseDto_JSONShape(t *testing.T) {
	icon := &QuestionIconResponseDto{
		Type: "IMAGE",
		Url:  "https://cdn.example.com/icons/self-care.png",
		Alt:  "Self care",
	}

	q1 := QuestionResponseDto{
		ID:         1,
		Type:       "PREFERENCES",
		AnswerType: "SINGLE",
		Name:       "How do you practice self-care?",
		EnName:     "How do you practice self-care?",
		FaName:     "چگونه از خود مراقبت می‌کنید؟",
		NameEn:     "How do you practice self-care?",
		NameFa:     "چگونه از خود مراقبت می‌کنید؟",
		Icon:       icon,
		Answers: []QuestionAnswerDto{
			{
				ID:         0,
				QuestionID: 1,
				Answer:     "Meditation and mindfulness practices.",
				EnAnswer:   "Meditation and mindfulness practices.",
				FaAnswer:   "مراقبه و تمرین‌های ذهن‌آگاهی.",
				AnswerEn:   "Meditation and mindfulness practices.",
				AnswerFa:   "مراقبه و تمرین‌های ذهن‌آگاهی.",
			},
			{
				ID:         1,
				QuestionID: 1,
				Answer:     "Exercise and gym workout.",
				EnAnswer:   "Exercise and gym workout.",
				FaAnswer:   "ورزش و تمرین در باشگاه.",
				AnswerEn:   "Exercise and gym workout.",
				AnswerFa:   "ورزش و تمرین در باشگاه.",
			},
		},
	}

	typeFilter := "PREFERENCES"
	langFilter := "en"

	listDto := QuestionListResponseDto{
		Total:     1,
		Questions: []QuestionResponseDto{q1},
		Type:      &typeFilter,
		Language:  &langFilter,
	}

	bytes, err := json.Marshal(listDto)
	if err != nil {
		t.Fatalf("failed to marshal QuestionListResponseDto: %v", err)
	}

	var rawMap map[string]interface{}
	if err := json.Unmarshal(bytes, &rawMap); err != nil {
		t.Fatalf("failed to unmarshal JSON into map: %v", err)
	}

	// 1. Verify root data object contract
	if total, ok := rawMap["total"].(float64); !ok || int(total) != 1 {
		t.Errorf("expected total=1, got %v", rawMap["total"])
	}

	questionsRaw, ok := rawMap["questions"].([]interface{})
	if !ok || len(questionsRaw) != 1 {
		t.Fatalf("expected questions to be an array of length 1, got %v", rawMap["questions"])
	}

	firstQ := questionsRaw[0].(map[string]interface{})
	if firstQ["id"] != float64(1) {
		t.Errorf("expected question id 1, got %v", firstQ["id"])
	}
	if firstQ["name"] != "How do you practice self-care?" {
		t.Errorf("expected name 'How do you practice self-care?', got %v", firstQ["name"])
	}
	if firstQ["enName"] != "How do you practice self-care?" {
		t.Errorf("expected enName 'How do you practice self-care?', got %v", firstQ["enName"])
	}
	if firstQ["faName"] != "چگونه از خود مراقبت می‌کنید؟" {
		t.Errorf("expected faName 'چگونه از خود مراقبت می‌کنید؟', got %v", firstQ["faName"])
	}

	// 2. Verify icon object shape
	iconRaw, ok := firstQ["icon"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected icon to be an object, got %v", firstQ["icon"])
	}
	if iconRaw["type"] != "IMAGE" {
		t.Errorf("expected icon.type 'IMAGE', got %v", iconRaw["type"])
	}
	if iconRaw["url"] != "https://cdn.example.com/icons/self-care.png" {
		t.Errorf("expected icon.url 'https://cdn.example.com/icons/self-care.png', got %v", iconRaw["url"])
	}
	if iconRaw["alt"] != "Self care" {
		t.Errorf("expected icon.alt 'Self care', got %v", iconRaw["alt"])
	}

	// 3. Verify answers array and 0-based IDs
	answersRaw, ok := firstQ["answers"].([]interface{})
	if !ok || len(answersRaw) != 2 {
		t.Fatalf("expected answers to be array of length 2, got %v", firstQ["answers"])
	}

	ans0 := answersRaw[0].(map[string]interface{})
	if ans0["id"] != float64(0) {
		t.Errorf("expected answer 0 to have id 0, got %v", ans0["id"])
	}
	if ans0["questionId"] != float64(1) {
		t.Errorf("expected answer 0 questionId 1, got %v", ans0["questionId"])
	}
	if ans0["answer"] != "Meditation and mindfulness practices." {
		t.Errorf("expected answer 0 'Meditation and mindfulness practices.', got %v", ans0["answer"])
	}

	ans1 := answersRaw[1].(map[string]interface{})
	if ans1["id"] != float64(1) {
		t.Errorf("expected answer 1 to have id 1, got %v", ans1["id"])
	}
}

func TestQuestionResponseDto_NullIconSerialization(t *testing.T) {
	q := QuestionResponseDto{
		ID:         2,
		Type:       "PERSONALITY",
		AnswerType: "SINGLE",
		Name:       "Extrovert or Introvert?",
		EnName:     "Extrovert or Introvert?",
		FaName:     "برونگرا یا درونگرا؟",
		Icon:       nil,
		Answers:    []QuestionAnswerDto{},
	}

	bytes, err := json.Marshal(q)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var rawMap map[string]interface{}
	if err := json.Unmarshal(bytes, &rawMap); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	// Icon should be present as explicit null
	val, exists := rawMap["icon"]
	if !exists {
		t.Errorf("expected 'icon' key to exist in JSON")
	}
	if val != nil {
		t.Errorf("expected 'icon' to be null, got %v", val)
	}
}

func TestMapQuestion_LanguageLocalization(t *testing.T) {
	cfg := &config.Config{
		AssetBaseURL: "https://api.datemate.ir",
	}
	s := NewService(cfg, nil)

	q := db.Questions{
		ID:         10,
		NameEn:     "What is your communication style?",
		NameFa:     "سبک ارتباطی شما چیست؟",
		Type:       "VALUES",
		AnswerType: db.AnswerTypeMULTI,
		Icon:       pgtype.Text{String: "icons/comm.png", Valid: true},
		IconAlt:    pgtype.Text{String: "Communication", Valid: true},
	}

	ansRows := []db.QuestionAnswers{
		{
			ID:         101,
			QuestionID: 10,
			AnswerEn:   "Direct and honest",
			AnswerFa:   "مستقیم و صادقانه",
		},
		{
			ID:         102,
			QuestionID: 10,
			AnswerEn:   "Thoughtful and gentle",
			AnswerFa:   "متفکرانه و ملایم",
		},
	}

	// Test English localization
	dtoEn := s.mapQuestion(q, ansRows, "en")
	if dtoEn.Name != "What is your communication style?" {
		t.Errorf("expected EN name, got %s", dtoEn.Name)
	}
	if dtoEn.Answers[0].Answer != "Direct and honest" {
		t.Errorf("expected EN answer, got %s", dtoEn.Answers[0].Answer)
	}
	if dtoEn.Answers[0].ID != 0 || dtoEn.Answers[1].ID != 1 {
		t.Errorf("expected 0-based answer IDs, got %d, %d", dtoEn.Answers[0].ID, dtoEn.Answers[1].ID)
	}
	if dtoEn.Icon == nil || dtoEn.Icon.Url != "https://api.datemate.ir/icons/comm.png" {
		t.Errorf("expected resolved icon URL, got %v", dtoEn.Icon)
	}
	if dtoEn.Icon.Alt != "Communication" {
		t.Errorf("expected icon alt 'Communication', got %s", dtoEn.Icon.Alt)
	}

	// Test Farsi localization
	dtoFa := s.mapQuestion(q, ansRows, "fa")
	if dtoFa.Name != "سبک ارتباطی شما چیست؟" {
		t.Errorf("expected FA name, got %s", dtoFa.Name)
	}
	if dtoFa.Answers[0].Answer != "مستقیم و صادقانه" {
		t.Errorf("expected FA answer, got %s", dtoFa.Answers[0].Answer)
	}
}
