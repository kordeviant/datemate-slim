export interface QuestionAnswerEntity {
  id: number;
  questionId: number;
  answerEn: string;
  answerFa: string;
}

export interface QuestionEntity {
  id: number;
  type: string;
  answerType: string;
  nameEn: string;
  nameFa: string;
  answers: QuestionAnswerEntity[];
}
