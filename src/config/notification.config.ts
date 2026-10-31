export interface NotificationConfig {
  fcm: {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    credentialPath?: string;
    mockMode: boolean;
  };
  rabbitmq: {
    enabled: boolean;
    url: string;
    queue: string;
    exchange: string;
    prefetchCount: number;
  };
  defaults: {
    priority: 'normal' | 'high';
    ttlSeconds: number;
    timeoutMs: number;
    maxBatchSize: number;
    retryAttempts: number;
  };
  security: {
    apiKeys: string[];
  };
}

export const notificationConfig = (): { notification: NotificationConfig } => {
  const isMockMode =
    process.env.FCM_MOCK_MODE === 'true' ||
    (!process.env.FCM_PRIVATE_KEY &&
      !process.env.FIREBASE_CONFIG &&
      !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      !process.env.FCM_SERVICE_ACCOUNT_KEY);

  const configuredKeys = [
    process.env.PUSH_NOTIFICATION_API_KEY,
    process.env.NOTIFICATION_SERVICE_API_KEY,
    process.env.INTERNAL_API_KEY,
    process.env.API_KEY,
    'datemate_push_api_key_2026',
    'datemate_internal_api_key_2026',
    'datemate_device_token_api_key_2026',
  ].filter(Boolean) as string[];

  return {
    notification: {
      fcm: {
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        credentialPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        mockMode: isMockMode,
      },
      rabbitmq: {
        enabled: process.env.RABBITMQ_ENABLED === 'true',
        url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
        queue: process.env.RABBITMQ_QUEUE || 'datemate_push_notifications',
        exchange: process.env.RABBITMQ_EXCHANGE || 'datemate_notifications',
        prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH || '10', 10),
      },
      defaults: {
        priority: (process.env.PUSH_DEFAULT_PRIORITY?.toLowerCase() === 'high' ? 'high' : 'normal') as 'normal' | 'high',
        ttlSeconds: parseInt(process.env.PUSH_DEFAULT_TTL || '86400', 10),
        timeoutMs: parseInt(process.env.PUSH_NOTIFICATION_TIMEOUT_MS || '5000', 10),
        maxBatchSize: parseInt(process.env.PUSH_MAX_BATCH_SIZE || '500', 10),
        retryAttempts: parseInt(process.env.PUSH_RETRY_ATTEMPTS || '3', 10),
      },
      security: {
        apiKeys: Array.from(new Set(configuredKeys)),
      },
    },
  };
};
