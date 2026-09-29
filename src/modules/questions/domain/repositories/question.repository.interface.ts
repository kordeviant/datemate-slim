import { QuestionEntity } from '../question.entity';

export interface CreateQuestionData {
  type: string;
  answerType?: string;
  enName?: string;
  faName?: string;
  nameEn?: string;
  nameFa?: string;
  icon?: string;
  iconAlt?: string;
  answers: Array<{
    answerEn: string;
    answerFa: string;
    enAnswer?: string;
    faAnswer?: string;
  }>;
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
