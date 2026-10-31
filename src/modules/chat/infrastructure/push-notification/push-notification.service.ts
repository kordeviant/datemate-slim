import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PushService } from "../../../notifications/application/services/push.service";

export interface PushNotificationPayload {
  userId: number;
  title: string;
  body: string;
  data: {
    conversationId: string;
    [key: string]: any;
  };
  priority?: "high" | "normal";
}

export interface SendPushNotificationResult {
  success: boolean;
  userId: number;
  statusCode?: number;
  error?: string;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly pushService?: PushService,
  ) {
    this.baseUrl =
      this.configService.get<string>("pushNotification.baseUrl") ||
      process.env.PUSH_NOTIFICATION_BASE_URL ||
      process.env.NOTIFICATION_SERVICE_URL ||
      process.env.PUSH_SERVICE_URL ||
      "http://localhost:3003";

    this.apiKey =
      this.configService.get<string>("pushNotification.apiKey") ||
      process.env.PUSH_NOTIFICATION_API_KEY ||
      process.env.NOTIFICATION_SERVICE_API_KEY ||
      process.env.PUSH_API_KEY ||
      "";

    this.timeoutMs =
      this.configService.get<number>("pushNotification.timeoutMs") ||
      parseInt(process.env.PUSH_NOTIFICATION_TIMEOUT_MS || "5000", 10);
  }

  /**
   * Resolves the push notification endpoint URL cleanly from baseUrl.
   * Ensures no duplicated /v1/push paths.
   */
  public getEndpointUrl(): string {
    const base = (this.baseUrl || "http://localhost:3003").trim().replace(/\/+$/, "");
    if (base.endsWith("/v1/push")) {
      return base;
    }
    if (base.endsWith("/v1")) {
      return `${base}/push`;
    }
    return `${base}/v1/push`;
  }

  /**
   * Sends a single push notification to the target user.
   */
  public async sendPush(payload: PushNotificationPayload): Promise<SendPushNotificationResult> {
    if (this.pushService) {
      try {
        await this.pushService.enqueue({
          title: payload.title,
          body: payload.body,
          userId: payload.userId,
          data: payload.data,
          priority: payload.priority || 'high',
        });
        this.logger.log(
          `Push notification dispatched directly in-process for target userId ${payload.userId} (conversationId: ${payload.data?.conversationId})`,
        );
        return {
          success: true,
          userId: payload.userId,
          statusCode: 202,
        };
      } catch (err: any) {
        this.logger.warn(`In-process push enqueue failed for userId ${payload.userId}: ${err.message}`);
      }
    }

    const url = this.getEndpointUrl();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey && this.apiKey.trim().length > 0) {
      headers["X-API-Key"] = this.apiKey.trim();
    }

    const requestBody = {
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: payload.priority || "high",
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        this.logger.warn(
          `Push notification failed for target userId ${payload.userId}: HTTP ${response.status} - ${errorText}`,
        );
        return {
          success: false,
          userId: payload.userId,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      this.logger.log(
        `Push notification dispatched successfully for target userId ${payload.userId} (conversationId: ${payload.data.conversationId})`,
      );

      return {
        success: true,
        userId: payload.userId,
        statusCode: response.status,
      };
    } catch (err: any) {
      this.logger.error(
        `Error dispatching push notification to target userId ${payload.userId}: ${err.message}`,
      );
      return {
        success: false,
        userId: payload.userId,
        error: err.message,
      };
    }
  }

  /**
   * Sends push notifications to multiple target users in parallel.
   */
  public async sendNotificationsToUsers(
    targetUserIds: number[],
    notification: {
      title: string;
      body: string;
      conversationId: string;
      priority?: "high" | "normal";
    },
  ): Promise<SendPushNotificationResult[]> {
    if (!targetUserIds || targetUserIds.length === 0) {
      return [];
    }

    const promises = targetUserIds.map((userId) =>
      this.sendPush({
        userId,
        title: notification.title,
        body: notification.body,
        data: {
          conversationId: notification.conversationId,
        },
        priority: notification.priority || "high",
      }),
    );

    const settled = await Promise.allSettled(promises);
    return settled.map((result, idx) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        success: false,
        userId: targetUserIds[idx],
        error: result.reason?.message || "Unknown error",
      };
    });
  }

  /**
   * High-level helper invoked when a new message is sent.
   * Filters out sender from targets and constructs title and body.
   */
  public async notifyNewMessage(params: {
    targetUserIds: number[];
    senderId: number;
    senderName?: string;
    conversationTitle?: string;
    conversationId: string;
    content: string;
    customTitle?: string;
  }): Promise<void> {
    const recipients = (params.targetUserIds || []).filter((id) => id !== params.senderId);
    if (recipients.length === 0) {
      return;
    }

    const title =
      params.customTitle ||
      params.senderName ||
      params.conversationTitle ||
      "New Message";

    await this.sendNotificationsToUsers(recipients, {
      title,
      body: params.content,
      conversationId: params.conversationId,
      priority: "high",
    });
  }
}
