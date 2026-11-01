package questions

type QuestionIconResponseDto struct {
	Type string `json:"type"`
	Url  string `json:"url"`
	Alt  string `json:"alt"`
}

type QuestionAnswerDto struct {
	ID         int    `json:"id"`
	QuestionID int    `json:"questionId"`
	Answer     string `json:"answer"`
	EnAnswer   string `json:"enAnswer"`
	FaAnswer   string `json:"faAnswer"`
	AnswerEn   string `json:"answerEn"`
	AnswerFa   string `json:"answerFa"`
}

type QuestionResponseDto struct {
	ID         int                      `json:"id"`
	Type       string                   `json:"type"`
	AnswerType string                   `json:"answerType"`
	Name       string                   `json:"name"`
	EnName     string                   `json:"enName"`
	FaName     string                   `json:"faName"`
	NameEn     string                   `json:"nameEn,omitempty"`
	NameFa     string                   `json:"nameFa,omitempty"`
	Icon       *QuestionIconResponseDto `json:"icon"`
	Answers    []QuestionAnswerDto      `json:"answers"`
}

type QuestionListResponseDto struct {
	Total     int                   `json:"total"`
	Questions []QuestionResponseDto `json:"questions"`
	Question  *QuestionResponseDto  `json:"question,omitempty"`
	ID        *int                  `json:"id,omitempty"`
	Type      *string               `json:"type,omitempty"`
	Language  *string               `json:"language,omitempty"`
}

type CreateQuestionPayload struct {
	NameEn     string `json:"nameEn"`
	NameFa     string `json:"nameFa"`
	EnName     string `json:"enName,omitempty"`
	FaName     string `json:"faName,omitempty"`
	Type       string `json:"type"`
	AnswerType string `json:"answerType"`
	Icon       string `json:"icon,omitempty"`
	IconAlt    string `json:"iconAlt,omitempty"`
	Answers    []struct {
		EnAnswer string `json:"enAnswer,omitempty"`
		FaAnswer string `json:"faAnswer,omitempty"`
		AnswerEn string `json:"answerEn,omitempty"`
		AnswerFa string `json:"answerFa,omitempty"`
	} `json:"answers,omitempty"`
}

type UpdateQuestionPayload struct {
	NameEn     *string `json:"nameEn,omitempty"`
	NameFa     *string `json:"nameFa,omitempty"`
	EnName     *string `json:"enName,omitempty"`
	FaName     *string `json:"faName,omitempty"`
	Type       *string `json:"type,omitempty"`
	AnswerType *string `json:"answerType,omitempty"`
	Icon       *string `json:"icon,omitempty"`
	IconAlt    *string `json:"iconAlt,omitempty"`
	Answers    *[]struct {
		EnAnswer string `json:"enAnswer,omitempty"`
		FaAnswer string `json:"faAnswer,omitempty"`
		AnswerEn string `json:"answerEn,omitempty"`
		AnswerFa string `json:"answerFa,omitempty"`
	} `json:"answers,omitempty"`
}
