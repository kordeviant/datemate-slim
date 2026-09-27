import { Module } from '@nestjs/common';
import { QuestionsController } from './presentation/questions.controller';
import { GetQuestionsUseCase } from './application/use-cases/get-questions.use-case';
import { CreateQuestionUseCase } from './application/use-cases/create-question.use-case';
import { QUESTION_REPOSITORY } from './domain/repositories/question.repository.interface';
import { PrismaQuestionRepository } from './infrastructure/repositories/prisma-question.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
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
  ],
  exports: [QUESTION_REPOSITORY],
})
export class QuestionsModule {}
