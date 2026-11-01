import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPushNotificationService,
} from './push-notification.service.interface';
import {
  FriendRequestAcceptedNotificationParams,
  FriendRequestNotificationParams,
  LikeUserNotificationParams,
  NOTIFICATION_TEMPLATES,
  PushNotificationPayload,
  SelfieAcceptedNotificationParams,
  SelfieRejectedNotificationParams,
} from './notification-templates';
import { PushService } from '../../modules/notifications/application/services/push.service';

@Injectable()
export class PushNotificationService implements IPushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly pushService?: PushService,
  ) {}

  private getPushEndpoint(): { url: string; apiKey: string } | null {
    const rawBaseUrl = this.configService.get<string>(
      'PUSH_NOTIFICATION_BASE_URL',
      process.env.PUSH_NOTIFICATION_BASE_URL || '',
    );
    const apiKey = this.configService.get<string>(
      'PUSH_NOTIFICATION_API_KEY',
      process.env.PUSH_NOTIFICATION_API_KEY || '',
    );

    if (!rawBaseUrl || !apiKey) {
      this.logger.debug(
        'Push notification service skipped: PUSH_NOTIFICATION_BASE_URL or PUSH_NOTIFICATION_API_KEY is not configured.',
      );
      return null;
    }

    const trimmedBase = rawBaseUrl.trim().replace(/\/+$/, '');
    let url = trimmedBase;

    if (!url.endsWith('/v1/push')) {
      if (url.endsWith('/v1')) {
        url = `${url}/push`;
      } else {
        url = `${url}/v1/push`;
      }
    }

    return { url, apiKey: apiKey.trim() };
  }

  async sendPush(payload: PushNotificationPayload): Promise<boolean> {
    const config = this.getPushEndpoint();
    if (!config) {
      if (this.pushService) {
        try {
          const targetUserId = payload.userId || (payload as any).user_id;
          await this.pushService.enqueue({
            title: payload.title,
            body: payload.body,
            userId: targetUserId,
            data: payload.data,
            priority: payload.priority?.toLowerCase() === 'high' ? 'high' : 'normal',
          });
          this.logger.log(
            `Push notification enqueued directly in-process for user ${targetUserId} [type: ${payload.data?.type}]`,
          );
          return true;
        } catch (err: any) {
          this.logger.warn(`Direct in-process push enqueue failed: ${err?.message}`);
          return false;
        }
      }
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const targetUserId = String(
      payload.userId || (payload as any).user_id || '',
    );
    const dataUserId = String(
      payload.data?.userId || (payload.data as any)?.user_id || targetUserId,
    );
    const normalizedPriority =
      payload.priority?.toLowerCase() === 'high' ? 'high' : 'normal';

    const payloadToSend: PushNotificationPayload = {
      ...payload,
      userId: targetUserId,
      data: {
        ...payload.data,
        userId: dataUserId,
      },
      priority: normalizedPriority,
    };
    delete (payloadToSend as any).user_id;
    if (payloadToSend.data) {
      delete (payloadToSend.data as any).user_id;
    }

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify(payloadToSend),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.warn(
          `Push notification delivery failed for user ${payloadToSend.userId} [type: ${payloadToSend.data.type}]. Status: ${response.status} ${response.statusText} - ${errorText}`,
        );
        return false;
      }

      this.logger.log(
        `Push notification sent successfully to user ${payloadToSend.userId} [type: ${payloadToSend.data.type}, priority: ${payloadToSend.priority}]`,
      );
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Push notification error for user ${payloadToSend.userId} [type: ${payloadToSend.data.type}]: ${err?.message || err}`,
      );
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendFriendRequestNotification(
    params: FriendRequestNotificationParams,
  ): Promise<boolean> {
    const payload = NOTIFICATION_TEMPLATES.FRIEND_REQUEST.build(params);
    return this.sendPush(payload);
  }

  async sendFriendRequestAcceptedNotification(
    params: FriendRequestAcceptedNotificationParams,
  ): Promise<boolean> {
    const payload = NOTIFICATION_TEMPLATES.FRIEND_REQUEST_ACCEPTED.build(params);
    return this.sendPush(payload);
  }

  async sendLikeUserNotification(
    params: LikeUserNotificationParams,
  ): Promise<boolean> {
    const payload = NOTIFICATION_TEMPLATES.LIKE_USER.build(params);
    return this.sendPush(payload);
  }

  async sendSelfieAcceptedNotification(
    params: SelfieAcceptedNotificationParams,
  ): Promise<boolean> {
    const payload = NOTIFICATION_TEMPLATES.SELFIE_ACCEPTED.build(params);
    return this.sendPush(payload);
  }

  async sendSelfieRejectedNotification(
    params: SelfieRejectedNotificationParams,
  ): Promise<boolean> {
    const payload = NOTIFICATION_TEMPLATES.SELFIE_REJECTED.build(params);
    return this.sendPush(payload);
  }
}
