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

export interface AddFriendResult {
  request: FriendRequestEntity;
  message: string;
  autoAccepted: boolean;
}

@Injectable()
export class AddFriendUseCase {
  constructor(
    @Inject(FRIEND_REPOSITORY)
    private readonly friendRepository: IFriendRepository,
    @Optional()
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushNotificationService?: IPushNotificationService,
  ) {}

  async execute(
    currentUserId: number,
    targetUserId: number,
  ): Promise<AddFriendResult> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot add yourself as a friend');
    }

    const targetUser = await this.friendRepository.findUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }
    if (targetUser.isBanned) {
      throw new ForbiddenException('Target user is currently unavailable');
    }

    const currentUser = await this.friendRepository.findUserById(currentUserId);
    if (currentUser?.isBanned) {
      throw new ForbiddenException('Your account is currently suspended');
    }

    const existing = await this.friendRepository.findRequestBetweenUsers(
      currentUserId,
      targetUserId,
    );

    if (existing) {
      if (existing.status === FriendRequestStatus.ACCEPTED) {
        throw new BadRequestException('Users are already friends');
      }

      if (
        existing.senderId === currentUserId &&
        existing.status === FriendRequestStatus.PENDING
      ) {
        throw new BadRequestException('Friend request is already pending');
      }

      // If reciprocal pending request exists from target user to current user, auto-accept it
      if (
        existing.senderId === targetUserId &&
        existing.receiverId === currentUserId &&
        existing.status === FriendRequestStatus.PENDING
      ) {
        const accepted = await this.friendRepository.updateRequestStatus(
          existing.id,
          FriendRequestStatus.ACCEPTED,
        );

        // Fire push notification for both users when accepted
        try {
          const currentName = currentUser?.fullName || 'User';
          const targetName = targetUser.fullName || 'User';

          await this.pushNotificationService?.sendFriendRequestAcceptedNotification({
            recipientUserId: currentUserId,
            otherUserFullName: targetName,
          });

          await this.pushNotificationService?.sendFriendRequestAcceptedNotification({
            recipientUserId: targetUserId,
            otherUserFullName: currentName,
          });
        } catch {
          // Non-blocking notification failure
        }

        return {
          request: accepted,
          message: 'Friend request accepted and friendship established',
          autoAccepted: true,
        };
      }
    }

    const created = await this.friendRepository.createRequest(
      currentUserId,
      targetUserId,
    );

    // Fire in-app notification for receiver
    try {
      await this.friendRepository.createFriendRequestNotification(
        targetUserId,
        currentUserId,
      );
    } catch {
      // Non-blocking notification failure
    }

    // Fire push notification for receiver
    try {
      const senderName = currentUser?.fullName || 'User';
      await this.pushNotificationService?.sendFriendRequestNotification({
        recipientUserId: targetUserId,
        senderFullName: senderName,
      });
    } catch {
      // Non-blocking notification failure
    }

    return {
      request: created,
      message: 'Friend request sent successfully',
      autoAccepted: false,
    };
  }
}
