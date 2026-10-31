import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PushNotificationDto } from '../dto/push-notification.dto';
import { PushResponseDto } from '../dto/push-response.dto';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { UserDeviceService } from './user-device.service';
import { ProviderFactoryService } from '../../infrastructure/providers/provider-factory.service';
import { PushNotificationPayload } from '../../domain/notification-provider.interface';

export interface PushDispatchResult {
  jobId: string;
  title: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  topic?: string;
  durationMs: number;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly userDeviceService: UserDeviceService,
    private readonly providerFactory: ProviderFactoryService,
  ) {}

  /**
   * Immediately accepts and enqueues the push notification (< 2-3ms).
   * Validates target existence and dispatches asynchronously without blocking the caller.
   */
  async enqueue(dto: PushNotificationDto): Promise<PushResponseDto> {
    const hasTarget =
      dto.device_token ||
      (dto.tokens && dto.tokens.length > 0) ||
      dto.topic ||
      dto.userId;

    if (!hasTarget) {
      throw new BadRequestException(
        'At least one target recipient must be provided: device_token, tokens, topic, or userId.',
      );
    }

    const jobId = dto.job_id || uuidv4();
    const payload = {
      ...dto,
      job_id: jobId,
      queued_at: new Date().toISOString(),
    };

    // Try publishing to RabbitMQ
    const published = await this.rabbitMqService.publish('push.dispatch', payload);

    if (!published) {
      this.logger.debug(
        `RabbitMQ not ready for job ${jobId}. Falling back to immediate background execution.`,
      );
      // Non-blocking in-process fallback
      setImmediate(() => {
        this.processPushJob(payload).catch((err) =>
          this.logger.error(`Fallback processing failed for job ${jobId}: ${err?.message}`),
        );
      });
    } else {
      this.logger.debug(`Enqueued push notification job ${jobId} to RabbitMQ.`);
    }

    return {
      job_id: jobId,
      status: 'QUEUED',
      title: dto.title,
      message: 'Push notification accepted and queued for immediate delivery',
    };
  }

  /**
   * Background processor called by RabbitMQ consumer (or async fallback).
   * Dispatches directly to tokens / topic, resolving userId to device token if needed.
   */
  async processPushJob(payload: any): Promise<PushDispatchResult> {
    const startTime = Date.now();
    const jobId = payload.job_id || uuidv4();

    this.logger.log(`Processing push job [${jobId}] Title: "${payload.title}"`);

    // 1. Collect direct tokens
    const directTokens: string[] = [];
    if (payload.device_token) {
      directTokens.push(payload.device_token.trim());
    }
    if (Array.isArray(payload.tokens)) {
      directTokens.push(...payload.tokens.map((t: string) => t.trim()));
    }

    // 2. Resolve userId to device token if provided
    if (payload.userId) {
      try {
        const userToken = await this.userDeviceService.getDeviceToken(payload.userId);
        if (userToken) {
          directTokens.push(userToken.trim());
        } else {
          this.logger.warn(`No active device token found for userId: ${payload.userId}`);
        }
      } catch (err: any) {
        this.logger.error(
          `Failed resolving device token for userId ${payload.userId}: ${err?.message}`,
        );
      }
    }

    const uniqueTokens = Array.from(new Set(directTokens.filter(Boolean)));
    const provider = this.providerFactory.getProvider();

    const notificationPayload: PushNotificationPayload = {
      title: payload.title,
      body: payload.body,
      data: payload.data,
      imageUrl: payload.image_url,
      sound: payload.sound || 'default',
      badge: payload.badge,
      priority: payload.priority?.toLowerCase() === 'high' ? 'high' : 'normal',
      channelId: payload.channel_id,
      clickAction: payload.click_action,
      ttl: payload.ttl,
      jobId,
    };

    let totalSuccess = 0;
    let totalFailure = 0;

    // 3. Dispatch to topic if present
    if (payload.topic) {
      this.logger.log(`Dispatching push notification to topic: "${payload.topic}"`);
      const topicResult = await provider.sendToTopic(payload.topic, notificationPayload);
      if (topicResult.success) {
        totalSuccess++;
      } else {
        totalFailure++;
      }
    }

    // 4. Dispatch multicast to tokens
    if (uniqueTokens.length > 0) {
      this.logger.log(
        `Dispatching multicast push notification to ${uniqueTokens.length} recipients`,
      );
      const multicastResult = await provider.sendMulticast(
        uniqueTokens,
        notificationPayload,
      );
      totalSuccess += multicastResult.successCount;
      totalFailure += multicastResult.failureCount;

      if (multicastResult.invalidTokens.length > 0) {
        this.logger.warn(
          `Detected ${multicastResult.invalidTokens.length} invalid/expired tokens during multicast`,
        );
      }
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `Push job [${jobId}] completed in ${durationMs}ms (Success: ${totalSuccess}, Fail: ${totalFailure})`,
    );

    return {
      jobId,
      title: payload.title,
      targetCount: uniqueTokens.length + (payload.topic ? 1 : 0),
      successCount: totalSuccess,
      failureCount: totalFailure,
      topic: payload.topic,
      durationMs,
    };
  }
}
