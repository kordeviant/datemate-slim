import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { ApproveVerificationResult } from '../../domain/entities/admin-verification-item.entity';
import {
  IPushNotificationService,
  PUSH_NOTIFICATION_SERVICE,
} from '../../../../infrastructure/notification/push-notification.service.interface';

@Injectable()
export class ApproveVerificationUseCase {
  private readonly logger = new Logger(ApproveVerificationUseCase.name);

  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
    @Optional()
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushNotificationService?: IPushNotificationService,
  ) {}

  async execute(targetId: number): Promise<ApproveVerificationResult> {
    const result = await this.adminRepository.approveVerification(targetId);

    const recipientUserId = result.userId ?? targetId;
    if (this.pushNotificationService) {
      try {
        await this.pushNotificationService.sendSelfieAcceptedNotification({
          recipientUserId,
        });
      } catch (err: any) {
        this.logger.warn(
          `Failed to dispatch selfie accepted push notification to user ${recipientUserId}: ${err?.message || err}`,
        );
      }
    }

    return result;
  }
}
