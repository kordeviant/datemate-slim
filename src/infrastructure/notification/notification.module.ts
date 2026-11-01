import { Global, Module } from '@nestjs/common';
import { PUSH_NOTIFICATION_SERVICE } from './push-notification.service.interface';
import { PushNotificationService } from './push-notification.service';
import { NotificationsModule } from '../../modules/notifications/notifications.module';

@Global()
@Module({
  imports: [NotificationsModule],
  providers: [
    {
      provide: PUSH_NOTIFICATION_SERVICE,
      useClass: PushNotificationService,
    },
  ],
  exports: [PUSH_NOTIFICATION_SERVICE, NotificationsModule],
})
export class NotificationModule {}
