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
  enName: string;
  faName: string;
  nameEn?: string;
  nameFa?: string;
  icon?: string | null;
  iconAlt?: string | null;
  answers: QuestionAnswerEntity[];
}
