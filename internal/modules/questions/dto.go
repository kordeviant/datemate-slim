package questions

type QuestionAnswerDto struct {
	ID       int     `json:"id"`
	AnswerEn string  `json:"answerEn"`
	AnswerFa string  `json:"answerFa"`
	Text     *string `json:"text,omitempty"`
}

type QuestionResponseDto struct {
	ID         int                 `json:"id"`
	NameEn     string              `json:"nameEn"`
	NameFa     string              `json:"nameFa"`
	Type       string              `json:"type"`
	AnswerType string              `json:"answerType"`
	Icon       *string             `json:"icon"`
	IconAlt    *string             `json:"iconAlt"`
	Text       *string             `json:"text,omitempty"`
	Answers    []QuestionAnswerDto `json:"answers"`
}

type CreateQuestionPayload struct {
	NameEn     string `json:"nameEn"`
	NameFa     string `json:"nameFa"`
	Type       string `json:"type"`
	AnswerType string `json:"answerType"`
	Icon       string `json:"icon,omitempty"`
	IconAlt    string `json:"iconAlt,omitempty"`
	Answers    []struct {
		AnswerEn string `json:"answerEn"`
		AnswerFa string `json:"answerFa"`
	} `json:"answers,omitempty"`
}

type UpdateQuestionPayload struct {
	NameEn     *string `json:"nameEn,omitempty"`
	NameFa     *string `json:"nameFa,omitempty"`
	Type       *string `json:"type,omitempty"`
	AnswerType *string `json:"answerType,omitempty"`
	Icon       *string `json:"icon,omitempty"`
	IconAlt    *string `json:"iconAlt,omitempty"`
	Answers    *[]struct {
		AnswerEn string `json:"answerEn"`
		AnswerFa string `json:"answerFa"`
	} `json:"answers,omitempty"`
}
