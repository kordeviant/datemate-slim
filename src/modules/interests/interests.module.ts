import { Module } from '@nestjs/common';
import { InterestsController } from './presentation/interests.controller';
import { GetInterestsUseCase } from './application/use-cases/get-interests.use-case';
import { CreateInterestUseCase } from './application/use-cases/create-interest.use-case';
import { INTEREST_REPOSITORY } from './domain/repositories/interest.repository.interface';
import { PrismaInterestRepository } from './infrastructure/repositories/prisma-interest.repository';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [InterestsController],
  providers: [
    // Repository (DIP)
    {
      provide: INTEREST_REPOSITORY,
      useClass: PrismaInterestRepository,
    },
    // Use Cases
    GetInterestsUseCase,
    CreateInterestUseCase,
  ],
  exports: [INTEREST_REPOSITORY],
})
export class InterestsModule {}
