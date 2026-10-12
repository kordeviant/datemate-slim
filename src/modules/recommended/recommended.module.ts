import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { RecommendedController } from './presentation/recommended.controller';
import { RECOMMENDED_REPOSITORY } from './domain/repositories/recommended.repository.interface';
import { PrismaRecommendedRepository } from './infrastructure/repositories/prisma-recommended.repository';
import { GetRecommendedUseCase } from './application/use-cases/get-recommended.use-case';
import { GetRecommendedDetailUseCase } from './application/use-cases/get-recommended-detail.use-case';
import { RecommendationAlgorithmService } from './domain/services/recommendation-algorithm.service';
import { RecommendedCacheService } from './application/services/recommended-cache.service';
import { UserAuthGuard } from './application/guards/user-auth.guard';

@Module({
  imports: [AuthModule, PrismaModule, RedisModule, MediaModule],
  controllers: [RecommendedController],
  providers: [
    UserAuthGuard,
    {
      provide: RECOMMENDED_REPOSITORY,
      useClass: PrismaRecommendedRepository,
    },
    RecommendationAlgorithmService,
    RecommendedCacheService,
    GetRecommendedUseCase,
    GetRecommendedDetailUseCase,
  ],
  exports: [
    RECOMMENDED_REPOSITORY,
    RecommendationAlgorithmService,
    RecommendedCacheService,
    GetRecommendedUseCase,
    GetRecommendedDetailUseCase,
  ],
})
export class RecommendedModule {}
