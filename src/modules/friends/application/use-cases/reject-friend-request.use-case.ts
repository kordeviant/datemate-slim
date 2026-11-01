import {
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
export class RejectFriendRequestUseCase {
  constructor(
    @Inject(FRIEND_REPOSITORY)
    private readonly friendRepository: IFriendRepository,
  ) {}

  async execute(
    currentUserId: number,
    requestIdOrSenderId: number,
  ): Promise<FriendRequestEntity> {
    let request = await this.friendRepository.findRequestById(requestIdOrSenderId);

    // Fallback: check if the param is the sender's user ID
    if (!request) {
      const fallback = await this.friendRepository.findRequestBetweenUsers(
        requestIdOrSenderId,
        currentUserId,
      );
      if (fallback && fallback.receiverId === currentUserId) {
        request = fallback;
      }
    }

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.receiverId !== currentUserId) {
      throw new ForbiddenException(
        'You can only reject friend requests that were sent to you',
      );
    }

    return this.friendRepository.updateRequestStatus(
      request.id,
      FriendRequestStatus.REJECTED,
    );
  }
}
