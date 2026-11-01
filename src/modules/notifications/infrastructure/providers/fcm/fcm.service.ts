import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import {
  NotificationProvider,
  ProviderDeviceTarget,
  PushNotificationPayload,
  ProviderSendResult,
  MulticastSendResult,
} from '../../../domain/notification-provider.interface';
import { FCM_INVALID_TOKEN_ERRORS, FCM_PROVIDER_NAME } from './fcm.constants';
import { maskDeviceToken } from '../../../../../common/utils/token-masker.util';

const FCM_MULTICAST_CHUNK_SIZE = 500;

@Injectable()
export class FcmService implements NotificationProvider, OnModuleInit {
  public readonly providerName = FCM_PROVIDER_NAME;
  private readonly logger = new Logger(FcmService.name);
  private firebaseApp: admin.app.App | null = null;
  private isMockMode = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    const configuredMock = this.configService.get<boolean>('notification.fcm.mockMode');
    if (configuredMock !== undefined) {
      this.isMockMode = configuredMock;
    } else {
      this.isMockMode = this.configService.get<boolean>('fcm.mockMode', true);
    }

    if (this.isMockMode) {
      this.logger.log('FCM Service running in MOCK MODE (Push deliveries simulated)');
      return;
    }

    try {
      if (admin.apps.length > 0) {
        this.firebaseApp = admin.apps[0];
        return;
      }

      const credentialsPath =
        this.configService.get<string>('notification.fcm.credentialPath') ||
        this.configService.get<string>('fcm.credentialsPath');
      const projectId =
        this.configService.get<string>('notification.fcm.projectId') ||
        this.configService.get<string>('fcm.projectId');
      const clientEmail =
        this.configService.get<string>('notification.fcm.clientEmail') ||
        this.configService.get<string>('fcm.clientEmail');
      const privateKey =
        this.configService.get<string>('notification.fcm.privateKey') ||
        this.configService.get<string>('fcm.privateKey');

      if (credentialsPath) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(credentialsPath),
        });
        this.logger.log('Firebase initialized with service account file credential');
      } else if (clientEmail && privateKey) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log('Firebase initialized with environment credentials');
      } else {
        this.logger.warn('No Firebase credentials found. Falling back to MOCK MODE');
        this.isMockMode = true;
      }
    } catch (err: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${err?.message}. Using MOCK MODE.`);
      this.isMockMode = true;
    }
  }

  private buildSanitizedData(
    data?: Record<string, any>,
    jobId?: string,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    if (jobId) {
      sanitized.job_id = jobId;
    }
    if (data) {
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && val !== null) {
          sanitized[key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }
    }
    return sanitized;
  }

  async send(
    notification: PushNotificationPayload,
    device: ProviderDeviceTarget,
  ): Promise<ProviderSendResult> {
    const masked = maskDeviceToken(device.token);

    if (this.isMockMode) {
      this.logger.log(
        `[FCM Mock Send] Title: "${notification.title}" to target device: ${masked} (Platform: ${device.platform || 'unknown'})`,
      );
      return {
        success: true,
        provider: this.providerName,
        messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
    }

    try {
      const sanitizedData = this.buildSanitizedData(notification.data, notification.jobId);

      const fcmMessage: admin.messaging.Message = {
        token: device.token,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
        },
        data: sanitizedData,
        android: {
          priority: notification.priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: notification.channelId || 'default_channel',
            sound: notification.sound || 'default',
            clickAction: notification.clickAction,
            ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
          },
          ...(notification.ttl ? { ttl: notification.ttl * 1000 } : {}),
        },
        apns: {
          headers: {
            'apns-priority': notification.priority === 'high' ? '10' : '5',
          },
          payload: {
            aps: {
              sound: notification.sound ? `${notification.sound}.aiff` : 'default',
              badge: notification.badge,
              category: notification.category,
            },
          },
        },
      };

      const messageId = await admin.messaging().send(fcmMessage);
      this.logger.log(`[FCM Sent] MessageId: ${messageId} to target device ${masked}`);

      return {
        success: true,
        provider: this.providerName,
        messageId,
      };
    } catch (error: any) {
      const isInvalid = FCM_INVALID_TOKEN_ERRORS.some(
        (code) => error?.code === code || error?.message?.includes(code),
      );

      this.logger.error(
        `[FCM Error] Failed sending to device ${masked} [Code: ${error?.code}]: ${error?.message}`,
      );

      return {
        success: false,
        provider: this.providerName,
        error: error?.message,
        isInvalidToken: isInvalid,
      };
    }
  }

  async sendMulticast(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<MulticastSendResult> {
    if (!tokens || tokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        provider: this.providerName,
      };
    }

    if (this.isMockMode) {
      this.logger.log(
        `[FCM Mock Multicast] Sent title: "${payload.title}" to ${tokens.length} device token(s) (Job: ${payload.jobId || 'direct'})`,
      );
      return {
        successCount: tokens.length,
        failureCount: 0,
        invalidTokens: [],
        provider: this.providerName,
      };
    }

    let totalSuccess = 0;
    let totalFailure = 0;
    const invalidTokens: string[] = [];
    const sanitizedData = this.buildSanitizedData(payload.data, payload.jobId);

    for (let i = 0; i < tokens.length; i += FCM_MULTICAST_CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + FCM_MULTICAST_CHUNK_SIZE);

      const multicastMessage: admin.messaging.MulticastMessage = {
        tokens: chunk,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: sanitizedData,
        android: {
          priority: payload.priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: payload.channelId || 'default_channel',
            sound: payload.sound || 'default',
            clickAction: payload.clickAction,
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
          },
          ...(payload.ttl ? { ttl: payload.ttl * 1000 } : {}),
        },
        apns: {
          headers: {
            'apns-priority': payload.priority === 'high' ? '10' : '5',
          },
          payload: {
            aps: {
              sound: payload.sound ? `${payload.sound}.aiff` : 'default',
              badge: payload.badge,
              category: payload.category,
            },
          },
        },
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(multicastMessage);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const token = chunk[idx];
            const errorCode = resp.error?.code || '';
            if (FCM_INVALID_TOKEN_ERRORS.includes(errorCode)) {
              invalidTokens.push(token);
            }
          }
        });
      } catch (err: any) {
        this.logger.error(`[FCM Multicast Chunk Error]: ${err?.message}`);
        totalFailure += chunk.length;
      }
    }

    this.logger.log(
      `[FCM Multicast Result] Total: ${tokens.length}, Success: ${totalSuccess}, Failed: ${totalFailure}, InvalidTokens: ${invalidTokens.length}`,
    );

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
      invalidTokens,
      provider: this.providerName,
    };
  }

  async sendToTopic(
    topic: string,
    payload: PushNotificationPayload,
  ): Promise<ProviderSendResult> {
    if (this.isMockMode) {
      this.logger.log(
        `[FCM Mock Topic] Sent title: "${payload.title}" to topic: "${topic}" (Job: ${payload.jobId || 'direct'})`,
      );
      return {
        success: true,
        provider: this.providerName,
        messageId: `mock-topic-msg-${Date.now()}`,
      };
    }

    try {
      const sanitizedData = this.buildSanitizedData(payload.data, payload.jobId);
      const cleanTopic = topic.replace(/^\/topics\//, '');

      const message: admin.messaging.TopicMessage = {
        topic: cleanTopic,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: sanitizedData,
        android: {
          priority: payload.priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: payload.channelId || 'default_channel',
            sound: payload.sound || 'default',
            clickAction: payload.clickAction,
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
          },
        },
      };

      const messageId = await admin.messaging().send(message);
      this.logger.log(`[FCM Topic Sent] MessageId: ${messageId} to topic: "${cleanTopic}"`);

      return {
        success: true,
        provider: this.providerName,
        messageId,
      };
    } catch (error: any) {
      this.logger.error(`[FCM Topic Error] Failed sending to topic "${topic}": ${error?.message}`);
      return {
        success: false,
        provider: this.providerName,
        error: error?.message,
      };
    }
  }
}
