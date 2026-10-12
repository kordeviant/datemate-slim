import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import {
  QUESTION_REPOSITORY,
  IQuestionRepository,
} from '../../domain/repositories/question.repository.interface';
import { QuestionEntity } from '../../domain/question.entity';
import {
  QuestionListResponseDto,
  QuestionResponseDto,
} from '../dtos/question-response.dto';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';

@Injectable()
export class GetQuestionsUseCase {
  private readonly logger = new Logger(GetQuestionsUseCase.name);

  constructor(
    @Inject(QUESTION_REPOSITORY)
    private readonly questionRepo: IQuestionRepository,
    @Optional() private readonly mediaUrlResolver?: MediaUrlResolverService,
  ) {}

  /**
   * Returns questions filtered by optional id, type, and language.
   * - If no query parameters are set: returns all questions with their IDs, type, names, and answers (both EN & FA).
   * - If id is provided: returns the single question matching the ID.
   * - If type is provided: filters by QuestionType.
   * - If language is provided ('en' or 'fa'): localizes the primary name and answer fields.
   */
  async execute(
    type?: string,
    language?: string,
    id?: number,
  ): Promise<QuestionListResponseDto> {
    const normalizedType = type?.toUpperCase().trim();
    const normalizedLang = language?.toLowerCase().trim();

    // 1. If ID is provided, query single question by ID
    if (id !== undefined && id !== null && !isNaN(Number(id))) {
      const numericId = Number(id);
      const question = await this.questionRepo.findById(numericId);
      if (!question) {
        throw new NotFoundException(`Question with ID ${numericId} not found`);
      }

      const mapped = this.mapQuestion(question, normalizedLang);
      this.logger.log(`[Get Questions] Found question by ID #${numericId}`);

      return {
        total: 1,
        questions: [mapped],
        question: mapped,
        id: numericId,
        type: mapped.type,
        language: normalizedLang,
      };
    }

    // 2. Otherwise query by type or fetch all questions
    const questions = normalizedType
      ? await this.questionRepo.findByType(normalizedType)
      : await this.questionRepo.findAll();

    const result: QuestionResponseDto[] = questions.map((q) =>
      this.mapQuestion(q, normalizedLang),
    );

    // this.logger.log(
    //   `[Get Questions] Found ${result.length} questions (type=${normalizedType ?? 'all'}, lang=${normalizedLang ?? 'all'})`,
    // );

    return {
      total: result.length,
      questions: result,
      type: normalizedType,
      language: normalizedLang,
    };
  }

  private mapQuestion(q: QuestionEntity, lang?: string): QuestionResponseDto {
    const isFa = lang === 'fa';
    const enName = q.enName || q.nameEn;
    const faName = q.faName || q.nameFa;
    const primaryName = isFa ? faName : enName;

    const rawIcon = q.icon || null;
    const resolvedIcon = rawIcon
      ? this.mediaUrlResolver
        ? this.mediaUrlResolver.resolveUrl(rawIcon)
        : rawIcon
      : null;

    const iconObj = resolvedIcon
      ? {
          type: 'IMAGE',
          url: resolvedIcon,
          alt: q.iconAlt ?? '',
        }
      : null;

    return {
      id: q.id,
      type: q.type,
      answerType: q.answerType || 'SINGLE',
      name: primaryName,
      enName,
      faName,
      icon: iconObj,
      answers: (q.answers || []).map((a, index) => {
        const enAnswer = a.enAnswer || a.answerEn;
        const faAnswer = a.faAnswer || a.answerFa;
        return {
          id: index,
          questionId: a.questionId,
          answer: isFa ? faAnswer : enAnswer,
          enAnswer,
          faAnswer,
          answerEn: enAnswer,
          answerFa: faAnswer,
        };
      }),
    };
  }
}
