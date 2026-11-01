import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  FRIEND_REPOSITORY,
  IFriendRepository,
} from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';
import { FriendRequestEntity } from '../../domain/entities/friend-request.entity';
import {
  IPushNotificationService,
  PUSH_NOTIFICATION_SERVICE,
} from '../../../../infrastructure/notification/push-notification.service.interface';

@Injectable()
export class AcceptFriendRequestUseCase {
  constructor(
    @Inject(FRIEND_REPOSITORY)
    private readonly friendRepository: IFriendRepository,
    @Optional()
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushNotificationService?: IPushNotificationService,
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
        'You can only accept friend requests that were sent to you',
      );
    }

    if (request.status === FriendRequestStatus.ACCEPTED) {
      return request;
    }

    if (request.status === FriendRequestStatus.CANCELLED) {
      throw new BadRequestException('Friend request has been cancelled');
    }

    const updated = await this.friendRepository.updateRequestStatus(
      request.id,
      FriendRequestStatus.ACCEPTED,
    );

    // Fire push notification for both users when accepted
    try {
      const senderUser = await this.friendRepository.findUserById(
        request.senderId,
      );
      const receiverUser = await this.friendRepository.findUserById(
        request.receiverId,
      );

      const senderName = senderUser?.fullName || 'User';
      const receiverName = receiverUser?.fullName || 'User';

      await this.pushNotificationService?.sendFriendRequestAcceptedNotification({
        recipientUserId: request.senderId,
        otherUserFullName: receiverName,
      });

      await this.pushNotificationService?.sendFriendRequestAcceptedNotification({
        recipientUserId: request.receiverId,
        otherUserFullName: senderName,
      });
    } catch {
      // Non-blocking notification failure
    }

    return updated;
  }
}
