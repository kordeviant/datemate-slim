import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { RecommendedController } from './presentation/recommended.controller';
import { RECOMMENDED_REPOSITORY } from './domain/repositories/recommended.repository.interface';
import { PrismaRecommendedRepository } from './infrastructure/repositories/prisma-recommended.repository';
import { GetRecommendedUseCase } from './application/use-cases/get-recommended.use-case';
import { UserAuthGuard } from './application/guards/user-auth.guard';

@Module({
  imports: [AuthModule, PrismaModule, RedisModule],
  controllers: [RecommendedController],
  providers: [
    UserAuthGuard,
    {
      provide: RECOMMENDED_REPOSITORY,
      useClass: PrismaRecommendedRepository,
    },
    GetRecommendedUseCase,
  ],
  exports: [RECOMMENDED_REPOSITORY, GetRecommendedUseCase],
})
export class RecommendedModule {}
