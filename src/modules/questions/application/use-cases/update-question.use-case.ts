import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  QUESTION_REPOSITORY,
  IQuestionRepository,
} from '../../domain/repositories/question.repository.interface';
import { UpdateQuestionDto } from '../dtos/update-question.dto';
import { QuestionEntity } from '../../domain/question.entity';

@Injectable()
export class UpdateQuestionUseCase {
  private readonly logger = new Logger(UpdateQuestionUseCase.name);

  constructor(
    @Inject(QUESTION_REPOSITORY)
    private readonly questionRepo: IQuestionRepository,
  ) {}

  async execute(id: number, dto: UpdateQuestionDto): Promise<QuestionEntity> {
    const existing = await this.questionRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Question #${id} not found`);
    }

    if (dto.answers !== undefined) {
      if (dto.answers.length === 0) {
        throw new BadRequestException('At least one answer option is required');
      }

      for (const answer of dto.answers) {
        const enA = (answer.enAnswer || answer.answerEn)?.trim();
        const faA = (answer.faAnswer || answer.answerFa)?.trim();
        if (!enA || !faA) {
          throw new BadRequestException(
            'Each answer must have both English (enAnswer) and Farsi (faAnswer) text',
          );
        }
      }
    }

    if (dto.enName !== undefined && !dto.enName.trim()) {
      throw new BadRequestException('English question text cannot be empty');
    }

    if (dto.faName !== undefined && !dto.faName.trim()) {
      throw new BadRequestException('Farsi question text cannot be empty');
    }

    const updated = await this.questionRepo.update(id, {
      type: dto.type,
      answerType: dto.answerType,
      enName: dto.enName?.trim(),
      faName: dto.faName?.trim(),
      icon: dto.icon,
      iconAlt: dto.iconAlt,
      answers: dto.answers?.map((a) => ({
        answerEn: (a.enAnswer || a.answerEn)!.trim(),
        answerFa: (a.faAnswer || a.answerFa)!.trim(),
      })),
    });

    this.logger.log(
      `[Update Question] Updated question #${id} (type=${updated.type})`,
    );

    return updated;
  }
}
