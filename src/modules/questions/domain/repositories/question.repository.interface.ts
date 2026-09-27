import { QuestionEntity } from '../question.entity';

export interface CreateQuestionData {
  type: string;
  nameEn: string;
  nameFa: string;
  answers: Array<{ answerEn: string; answerFa: string }>;
}

export interface IQuestionRepository {
  findAll(): Promise<QuestionEntity[]>;
  findByType(type: string): Promise<QuestionEntity[]>;
  findById(id: number): Promise<QuestionEntity | null>;
  create(data: CreateQuestionData): Promise<QuestionEntity>;
  count(): Promise<number>;
  countUserAnswers(userId: number): Promise<number>;
}

export const QUESTION_REPOSITORY = Symbol('IQuestionRepository');
