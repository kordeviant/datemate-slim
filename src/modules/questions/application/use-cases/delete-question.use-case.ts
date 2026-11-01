import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  QUESTION_REPOSITORY,
  IQuestionRepository,
} from '../../domain/repositories/question.repository.interface';

@Injectable()
export class DeleteQuestionUseCase {
  private readonly logger = new Logger(DeleteQuestionUseCase.name);

  constructor(
    @Inject(QUESTION_REPOSITORY)
    private readonly questionRepo: IQuestionRepository,
  ) {}

  async execute(id: number): Promise<{ success: boolean; message: string }> {
    const existing = await this.questionRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Question #${id} not found`);
    }

    await this.questionRepo.delete(id);

    this.logger.log(`[Delete Question] Deleted question #${id}`);

    return {
      success: true,
      message: `Question #${id} deleted successfully`,
    };
  }
}
