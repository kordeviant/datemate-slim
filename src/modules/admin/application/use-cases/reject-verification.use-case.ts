import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { RejectVerificationResult } from '../../domain/entities/admin-verification-item.entity';
import {
  IPushNotificationService,
  PUSH_NOTIFICATION_SERVICE,
} from '../../../../infrastructure/notification/push-notification.service.interface';

@Injectable()
export class RejectVerificationUseCase {
  private readonly logger = new Logger(RejectVerificationUseCase.name);

  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
    @Optional()
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushNotificationService?: IPushNotificationService,
  ) {}

  async execute(
    targetId: number,
    reason?: string,
  ): Promise<RejectVerificationResult> {
    const result = await this.adminRepository.rejectVerification(
      targetId,
      reason || '',
    );

    const recipientUserId = result.userId ?? targetId;
    if (this.pushNotificationService) {
      try {
        await this.pushNotificationService.sendSelfieRejectedNotification({
          recipientUserId,
          rejectionReason: result.reason,
        });
      } catch (err: any) {
        this.logger.warn(
          `Failed to dispatch selfie rejected push notification to user ${recipientUserId}: ${err?.message || err}`,
        );
      }
    }

    return result;
  }
}
