import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiBody,
} from '@nestjs/swagger';
import { PushService } from '../application/services/push.service';
import { PushNotificationDto } from '../application/dto/push-notification.dto';
import { PushResponseDto } from '../application/dto/push-response.dto';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';

@ApiTags('Notifications')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller()
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('push')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Push notification dispatch (immediate async queue)',
    description:
      'Immediately accepts and enqueues a push notification (< 2-3ms). Supports title, body, data payload, image, sound, badge, priority, channels, and targets by device token(s), topic, or userId.',
  })
  @ApiBody({
    type: PushNotificationDto,
    examples: {
      byUserId: {
        summary: 'Target by userId (auto-resolves device token)',
        value: {
          title: 'DateMate Match',
          body: 'You have a new mutual match!',
          userId: 12,
          data: { type: 'match', conversationId: 'c_123' },
          priority: 'high',
        },
      },
      byDeviceToken: {
        summary: 'Target by direct FCM device token',
        value: {
          title: 'Message Alert',
          body: 'Parsa sent you a message.',
          device_token: 'fcm_device_token_xyz987',
          data: { type: 'chat_message', conversationId: 'c_team' },
          priority: 'normal',
        },
      },
      byTopic: {
        summary: 'Target by FCM broadcast topic',
        value: {
          title: 'Platform Maintenance Notice',
          body: 'Scheduled maintenance tonight from 02:00 to 02:30 UTC.',
          topic: 'global_announcements',
          priority: 'normal',
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Notification successfully enqueued for delivery',
    type: PushResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or missing target (device_token, tokens, topic, or userId)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized: missing or invalid API Key (header: x-api-key)',
  })
  async sendPush(@Body() dto: PushNotificationDto): Promise<PushResponseDto> {
    return this.pushService.enqueue(dto);
  }

  @Post('notifications/push')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Push notification alias endpoint',
    description: 'Backward-compatible alias for /v1/push endpoint.',
  })
  @ApiResponse({
    status: 202,
    description: 'Notification successfully enqueued for delivery',
    type: PushResponseDto,
  })
  async sendPushAlias(@Body() dto: PushNotificationDto): Promise<PushResponseDto> {
    return this.pushService.enqueue(dto);
  }
}
