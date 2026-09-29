import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  QUESTION_REPOSITORY,
  IQuestionRepository,
} from '../../domain/repositories/question.repository.interface';
import { CreateQuestionDto } from '../dtos/create-question.dto';
import { QuestionEntity } from '../../domain/question.entity';

@Injectable()
export class CreateQuestionUseCase {
  private readonly logger = new Logger(CreateQuestionUseCase.name);

  constructor(
    @Inject(QUESTION_REPOSITORY)
    private readonly questionRepo: IQuestionRepository,
  ) {}

  /**
   * Creates a new question with bilingual name and bilingual answer options.
   * Each question is stored with both en/fa from creation — it is created once for all languages.
   */
  async execute(dto: CreateQuestionDto): Promise<QuestionEntity> {
    if (!dto.answers || dto.answers.length === 0) {
      throw new BadRequestException('At least one answer option is required');
    }

    // Validate all answers have both languages
    for (const answer of dto.answers) {
      const enA = (answer.enAnswer || answer.answerEn)?.trim();
      const faA = (answer.faAnswer || answer.answerFa)?.trim();
      if (!enA || !faA) {
        throw new BadRequestException(
          'Each answer must have both English (enAnswer) and Farsi (faAnswer) text',
        );
      }
    }

    const enName = dto.enName?.trim();
    const faName = dto.faName?.trim();
    if (!enName || !faName) {
      throw new BadRequestException(
        'Question must have both English (enName) and Farsi (faName) text',
      );
    }

    const question = await this.questionRepo.create({
      type: dto.type,
      answerType: dto.answerType || 'SINGLE',
      enName,
      faName,
      icon: dto.icon,
      iconAlt: dto.iconAlt || dto.alt || undefined,
      answers: dto.answers.map((a) => ({
        answerEn: (a.enAnswer || a.answerEn)!.trim(),
        answerFa: (a.faAnswer || a.answerFa)!.trim(),
      })),
    });

    this.logger.log(
      `[Create Question] Created question #${question.id} (type=${question.type}, en="${question.enName}")`,
    );

    return question;
  }
}
