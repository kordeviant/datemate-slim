import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { FriendsController } from './presentation/friends.controller';
import { FRIEND_REPOSITORY } from './domain/repositories/friend.repository.interface';
import { PrismaFriendRepository } from './infrastructure/repositories/prisma-friend.repository';
import { AddFriendUseCase } from './application/use-cases/add-friend.use-case';
import { GetFriendRequestsUseCase } from './application/use-cases/get-friend-requests.use-case';
import { AcceptFriendRequestUseCase } from './application/use-cases/accept-friend-request.use-case';
import { RejectFriendRequestUseCase } from './application/use-cases/reject-friend-request.use-case';
import { CancelFriendRequestUseCase } from './application/use-cases/cancel-friend-request.use-case';
import { GetFriendsUseCase } from './application/use-cases/get-friends.use-case';
import { RemoveFriendUseCase } from './application/use-cases/remove-friend.use-case';
import { UserAuthGuard } from './application/guards/user-auth.guard';

@Module({
  imports: [AuthModule, PrismaModule, MediaModule],
  controllers: [FriendsController],
  providers: [
    UserAuthGuard,
    {
      provide: FRIEND_REPOSITORY,
      useClass: PrismaFriendRepository,
    },
    AddFriendUseCase,
    GetFriendRequestsUseCase,
    AcceptFriendRequestUseCase,
    RejectFriendRequestUseCase,
    CancelFriendRequestUseCase,
    GetFriendsUseCase,
    RemoveFriendUseCase,
  ],
  exports: [
    FRIEND_REPOSITORY,
    AddFriendUseCase,
    GetFriendRequestsUseCase,
    AcceptFriendRequestUseCase,
    RejectFriendRequestUseCase,
    CancelFriendRequestUseCase,
    GetFriendsUseCase,
    RemoveFriendUseCase,
  ],
})
export class FriendsModule {}
