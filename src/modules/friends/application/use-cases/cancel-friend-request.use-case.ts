import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FRIEND_REPOSITORY,
  IFriendRepository,
} from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';
import { FriendRequestEntity } from '../../domain/entities/friend-request.entity';

@Injectable()
export class CancelFriendRequestUseCase {
  constructor(
    @Inject(FRIEND_REPOSITORY)
    private readonly friendRepository: IFriendRepository,
  ) {}

  async execute(
    currentUserId: number,
    requestIdOrTargetUserId: number,
  ): Promise<FriendRequestEntity> {
    let request = await this.friendRepository.findRequestById(requestIdOrTargetUserId);

    // Fallback: check if the param is the target receiver user ID
    if (!request) {
      const fallback = await this.friendRepository.findRequestBetweenUsers(
        currentUserId,
        requestIdOrTargetUserId,
      );
      if (fallback && fallback.senderId === currentUserId) {
        request = fallback;
      }
    }

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.senderId !== currentUserId) {
      throw new ForbiddenException(
        'You can only cancel friend requests that were sent by you',
      );
    }

    if (request.status === FriendRequestStatus.ACCEPTED) {
      throw new BadRequestException(
        'Cannot cancel a friend request that has already been accepted. Use remove friend instead.',
      );
    }

    if (request.status === FriendRequestStatus.CANCELLED) {
      return request;
    }

    return this.friendRepository.updateRequestStatus(
      request.id,
      FriendRequestStatus.CANCELLED,
    );
  }
}
