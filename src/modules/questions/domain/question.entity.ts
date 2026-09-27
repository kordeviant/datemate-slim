export interface QuestionAnswerEntity {
  id: number;
  questionId: number;
  answerEn: string;
  answerFa: string;
  enAnswer?: string;
  faAnswer?: string;
}

export interface QuestionEntity {
  id: number;
  type: string;
  answerType: string;
  nameEn: string;
  nameFa: string;
  enName?: string;
  faName?: string;
  answers: QuestionAnswerEntity[];
}
