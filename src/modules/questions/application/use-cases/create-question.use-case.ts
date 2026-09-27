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
      if (!answer.answerEn?.trim() || !answer.answerFa?.trim()) {
        throw new BadRequestException(
          'Each answer must have both English (answerEn) and Farsi (answerFa) text',
        );
      }
    }

    if (!dto.nameEn?.trim() || !dto.nameFa?.trim()) {
      throw new BadRequestException(
        'Question must have both English (nameEn) and Farsi (nameFa) text',
      );
    }

    const question = await this.questionRepo.create({
      type: dto.type,
      answerType: dto.answerType || 'SINGLE',
      nameEn: dto.nameEn.trim(),
      nameFa: dto.nameFa.trim(),
      answers: dto.answers.map((a) => ({
        answerEn: a.answerEn.trim(),
        answerFa: a.answerFa.trim(),
      })),
    });

    this.logger.log(
      `[Create Question] Created question #${question.id} (type=${question.type}, en="${question.nameEn}")`,
    );

    return question;
  }
}
