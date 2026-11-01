export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal';
  channelId?: string;
  clickAction?: string;
  category?: string;
  ttl?: number;
  jobId?: string;
}

export interface ProviderDeviceTarget {
  id?: string;
  token: string;
  platform?: 'android' | 'ios' | 'web' | string;
  userId?: string;
}

export interface ProviderSendResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  isInvalidToken?: boolean;
}

export interface MulticastSendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  provider: string;
}

export interface NotificationProvider {
  readonly providerName: string;
  send(
    notification: PushNotificationPayload,
    device: ProviderDeviceTarget,
  ): Promise<ProviderSendResult>;
  sendMulticast(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<MulticastSendResult>;
  sendToTopic(
    topic: string,
    payload: PushNotificationPayload,
  ): Promise<ProviderSendResult>;
}
