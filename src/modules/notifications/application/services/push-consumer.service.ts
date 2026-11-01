import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { PushService } from './push.service';
import { DEFAULT_QUEUE } from '../../infrastructure/rabbitmq/rabbitmq.constants';

@Injectable()
export class PushConsumerService implements OnModuleInit {
  private readonly logger = new Logger(PushConsumerService.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly pushService: PushService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const isRabbitEnabled =
      this.configService.get<boolean>('notification.rabbitmq.enabled') ??
      (process.env.RABBITMQ_ENABLED === 'true');

    if (isRabbitEnabled) {
      this.startConsumer();
    }
  }

  private async startConsumer() {
    const queueName =
      this.configService.get<string>('notification.rabbitmq.queue') ||
      this.configService.get<string>('rabbitmq.queue') ||
      DEFAULT_QUEUE;
    const maxRetries =
      this.configService.get<number>('notification.defaults.retryAttempts') || 3;

    // Wait briefly for RabbitMQ connection to stabilize
    let retries = 0;
    while (!this.rabbitMqService.getChannel() && retries < 10) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    const channel = this.rabbitMqService.getChannel();
    if (!channel) {
      this.logger.debug(
        'RabbitMQ channel not ready. Push consumer will remain dormant.',
      );
      return;
    }

    this.logger.log(`Starting Push Notification Consumer on queue: "${queueName}"`);

    try {
      await channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          let payload: any;
          try {
            const raw = msg.content.toString();
            payload = JSON.parse(raw);
          } catch (err: any) {
            this.logger.error(
              `Malformed JSON message received on queue ${queueName}: ${err.message}. Routing to DLQ.`,
            );
            channel.nack(msg, false, false);
            return;
          }

          try {
            const normalizedPayload = this.normalizePayload(payload);
            await this.pushService.processPushJob(normalizedPayload);
            channel.ack(msg);
          } catch (error: any) {
            const deathHeader = msg.properties.headers?.['x-death'];
            const currentDeathCount =
              deathHeader && deathHeader.length > 0 ? deathHeader[0].count : 0;

            this.logger.error(
              `Failed to process push job [RoutingKey: ${msg.fields.routingKey}]: ${error?.message}`,
            );

            if (currentDeathCount < maxRetries) {
              this.logger.warn(
                `Retrying push job (${currentDeathCount + 1}/${maxRetries}). Re-queueing via DLX.`,
              );
              channel.nack(msg, false, false);
            } else {
              this.logger.error(
                `Max retry attempts reached (${maxRetries}). Discarding message to DLQ.`,
              );
              channel.nack(msg, false, false);
            }
          }
        },
        { noAck: false },
      );
    } catch (err: any) {
      this.logger.error(`Error attaching RabbitMQ queue consumer: ${err?.message}`);
    }
  }

  private normalizePayload(payload: any): any {
    if (payload.data && payload.data.title && !payload.title) {
      return {
        title: payload.data.title,
        body: payload.data.body || payload.data.message || '',
        tokens: payload.data.tokens,
        device_token: payload.data.device_token || payload.data.token,
        userId: payload.data.userId || payload.data.user_id,
        topic: payload.data.topic,
        data: payload.data.metadata || payload.data.data,
        job_id: payload.job_id || payload.id,
      };
    }
    return payload;
  }
}
