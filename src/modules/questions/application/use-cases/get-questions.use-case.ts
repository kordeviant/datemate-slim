import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  QUESTION_REPOSITORY,
  IQuestionRepository,
} from '../../domain/repositories/question.repository.interface';
import {
  QuestionListResponseDto,
  QuestionResponseDto,
} from '../dtos/question-response.dto';

@Injectable()
export class GetQuestionsUseCase {
  private readonly logger = new Logger(GetQuestionsUseCase.name);

  constructor(
    @Inject(QUESTION_REPOSITORY)
    private readonly questionRepo: IQuestionRepository,
  ) {}

  /**
   * Returns questions filtered by optional type and language.
   * - If language is provided ('en' or 'fa'), returns localized name/answer fields.
   * - If language is not provided, returns both languages in separate entries.
   * - If type is provided, filters by QuestionType.
   */
  async execute(
    type?: string,
    language?: string,
  ): Promise<QuestionListResponseDto> {
    const normalizedType = type?.toUpperCase().trim();
    const normalizedLang = language?.toLowerCase().trim();

    const questions = normalizedType
      ? await this.questionRepo.findByType(normalizedType)
      : await this.questionRepo.findAll();

    let result: QuestionResponseDto[];

    if (normalizedLang === 'en' || normalizedLang === 'fa') {
      // Return single language
      result = questions.map((q) => ({
        id: q.id,
        type: q.type,
        name: normalizedLang === 'en' ? q.nameEn : q.nameFa,
        answers: q.answers.map((a) => ({
          id: a.id,
          answer: normalizedLang === 'en' ? a.answerEn : a.answerFa,
        })),
      }));
    } else {
      // Return both languages — each question appears twice
      result = questions.flatMap((q) => [
        {
          id: q.id,
          type: q.type,
          name: q.nameEn,
          answers: q.answers.map((a) => ({
            id: a.id,
            answer: a.answerEn,
          })),
        },
        {
          id: q.id,
          type: q.type,
          name: q.nameFa,
          answers: q.answers.map((a) => ({
            id: a.id,
            answer: a.answerFa,
          })),
        },
      ]);
    }

    this.logger.log(
      `[Get Questions] Found ${result.length} questions (type=${normalizedType ?? 'all'}, lang=${normalizedLang ?? 'both'})`,
    );

    return {
      questions: result,
      type: normalizedType,
      language: normalizedLang,
    };
  }
}
