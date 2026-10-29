import { Global, Module } from '@nestjs/common';
import { PUSH_NOTIFICATION_SERVICE } from './push-notification.service.interface';
import { PushNotificationService } from './push-notification.service';

@Global()
@Module({
  providers: [
    {
      provide: PUSH_NOTIFICATION_SERVICE,
      useClass: PushNotificationService,
    },
  ],
  exports: [PUSH_NOTIFICATION_SERVICE],
})
export class NotificationModule {}
