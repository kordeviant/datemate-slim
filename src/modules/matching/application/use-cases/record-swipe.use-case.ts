import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  IMatchingRepository,
  MATCHING_REPOSITORY,
} from '../../domain/repositories/matching.repository.interface';
import { SwipeRequestDto } from '../dtos/swipe.dto';
import {
  IPushNotificationService,
  PUSH_NOTIFICATION_SERVICE,
} from '../../../../infrastructure/notification/push-notification.service.interface';

@Injectable()
export class RecordSwipeUseCase {
  constructor(
    @Inject(MATCHING_REPOSITORY)
    private readonly matchingRepository: IMatchingRepository,
    @Optional()
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushNotificationService?: IPushNotificationService,
  ) {}

  async execute(
    currentUserId: number,
    dto: SwipeRequestDto,
  ): Promise<void> {
    const { targetUserId, direction } = dto;

    // Rule 1: Exclude Self
    if (targetUserId === currentUserId) {
      throw new BadRequestException('You cannot swipe on yourself');
    }

    // Verify target user exists and is not banned
    const status = await this.matchingRepository.findTargetUserStatus(
      targetUserId,
    );
    if (!status.exists) {
      throw new NotFoundException('Target user not found');
    }
    if (status.isBanned) {
      throw new BadRequestException('Cannot swipe on a suspended or banned user');
    }

    // Record swipe atomically (Redis deduplication + DB persistence)
    await this.matchingRepository.recordSwipe(
      currentUserId,
      targetUserId,
      direction,
    );

    // If swipe direction is RIGHT (Like), trigger like push notification to target user
    if (direction === 'RIGHT') {
      try {
        const swiperFullName = await this.matchingRepository.getUserFullName(
          currentUserId,
        );
        await this.pushNotificationService?.sendLikeUserNotification({
          recipientUserId: targetUserId,
          likerFullName: swiperFullName || 'User',
        });
      } catch {
        // Non-blocking notification failure
      }
    }
  }
}
