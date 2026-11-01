import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProvidersModule } from './infrastructure/providers/providers.module';
import { RabbitMqModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { PushService } from './application/services/push.service';
import { PushConsumerService } from './application/services/push-consumer.service';
import { UserDeviceService } from './application/services/user-device.service';
import { PushController } from './presentation/push.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    ProvidersModule,
    RabbitMqModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [PushController],
  providers: [
    PushService,
    PushConsumerService,
    UserDeviceService,
  ],
  exports: [
    PushService,
    UserDeviceService,
    ProvidersModule,
    RabbitMqModule,
  ],
})
export class NotificationsModule {}
