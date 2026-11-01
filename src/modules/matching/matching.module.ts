import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { SwipesController } from './presentation/swipes.controller';
import { FeedController } from './presentation/feed.controller';
import { LikesController } from './presentation/likes.controller';
import { MatchesController } from './presentation/matches.controller';
import { MATCHING_REPOSITORY } from './domain/repositories/matching.repository.interface';
import { PrismaMatchingRepository } from './infrastructure/repositories/prisma-matching.repository';
import { RecordSwipeUseCase } from './application/use-cases/record-swipe.use-case';
import { GetFeedUseCase } from './application/use-cases/get-feed.use-case';
import { GetLikesReceivedUseCase } from './application/use-cases/get-likes-received.use-case';
import { UserAuthGuard } from './application/guards/user-auth.guard';

@Module({
  imports: [AuthModule, PrismaModule, RedisModule, MediaModule],
  controllers: [
    SwipesController,
    FeedController,
    LikesController,
    MatchesController,
  ],
  providers: [
    UserAuthGuard,
    {
      provide: MATCHING_REPOSITORY,
      useClass: PrismaMatchingRepository,
    },
    RecordSwipeUseCase,
    GetFeedUseCase,
    GetLikesReceivedUseCase,
  ],
  exports: [
    MATCHING_REPOSITORY,
    RecordSwipeUseCase,
    GetFeedUseCase,
    GetLikesReceivedUseCase,
  ],
})
export class MatchingModule {}
