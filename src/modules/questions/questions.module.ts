import { Module } from '@nestjs/common';
import { QuestionsController } from './presentation/questions.controller';
import { GetQuestionsUseCase } from './application/use-cases/get-questions.use-case';
import { CreateQuestionUseCase } from './application/use-cases/create-question.use-case';
import { UpdateQuestionUseCase } from './application/use-cases/update-question.use-case';
import { DeleteQuestionUseCase } from './application/use-cases/delete-question.use-case';
import { QUESTION_REPOSITORY } from './domain/repositories/question.repository.interface';
import { PrismaQuestionRepository } from './infrastructure/repositories/prisma-question.repository';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [QuestionsController],
  providers: [
    // Repository (DIP)
    {
      provide: QUESTION_REPOSITORY,
      useClass: PrismaQuestionRepository,
    },
    // Use Cases
    GetQuestionsUseCase,
    CreateQuestionUseCase,
    UpdateQuestionUseCase,
    DeleteQuestionUseCase,
  ],
  exports: [QUESTION_REPOSITORY],
})
export class QuestionsModule {}
