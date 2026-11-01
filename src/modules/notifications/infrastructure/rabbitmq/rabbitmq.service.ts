import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import {
  BOUND_ROUTING_KEYS,
  DEFAULT_DLQ,
  DEFAULT_DLX,
  DEFAULT_EXCHANGE,
  DEFAULT_QUEUE,
} from './rabbitmq.constants';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const isEnabled =
      this.configService.get<boolean>('notification.rabbitmq.enabled') ??
      (process.env.RABBITMQ_ENABLED === 'true');

    if (isEnabled) {
      await this.connectWithRetry();
    } else {
      this.logger.log('RabbitMQ is disabled by configuration (using direct in-process dispatch).');
    }
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Gracefully closing RabbitMQ connection (Signal: ${signal})...`);
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      this.logger.log('RabbitMQ connection closed.');
    } catch (err: any) {
      this.logger.error(`Error during RabbitMQ shutdown: ${err?.message}`);
    }
  }

  getChannel(): amqp.Channel | null {
    return this.channel;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  private async connectWithRetry(attempts = 3, delayMs = 2000): Promise<void> {
    const url =
      this.configService.get<string>('notification.rabbitmq.url') ||
      this.configService.get<string>('rabbitmq.url') ||
      process.env.RABBITMQ_URL;

    if (!url) {
      this.logger.warn('RABBITMQ_URL is not configured. RabbitMQ worker will remain idle.');
      return;
    }

    for (let i = 1; i <= attempts; i++) {
      try {
        this.logger.log(`Connecting to RabbitMQ broker (Attempt ${i}/${attempts})...`);
        this.connection = await amqp.connect(url);
        this.channel = await this.connection.createChannel();

        const prefetch =
          this.configService.get<number>('notification.rabbitmq.prefetchCount') || 10;
        await this.channel.prefetch(prefetch);

        await this.setupTopology();

        this.isConnected = true;
        this.logger.log('RabbitMQ connected and topology configured successfully.');
        return;
      } catch (err: any) {
        this.logger.warn(`RabbitMQ connection attempt ${i} failed: ${err?.message}`);
        if (i < attempts) {
          await new Promise((res) => setTimeout(res, delayMs));
        }
      }
    }
    this.logger.warn(
      'Could not connect to RabbitMQ broker. Operating in direct asynchronous in-process fallback mode.',
    );
  }

  private async setupTopology(): Promise<void> {
    if (!this.channel) return;

    const exchange =
      this.configService.get<string>('notification.rabbitmq.exchange') || DEFAULT_EXCHANGE;
    const queue =
      this.configService.get<string>('notification.rabbitmq.queue') || DEFAULT_QUEUE;

    await this.channel.assertExchange(DEFAULT_DLX, 'direct', { durable: true });
    await this.channel.assertQueue(DEFAULT_DLQ, { durable: true });
    await this.channel.bindQueue(DEFAULT_DLQ, DEFAULT_DLX, 'dead-letter');

    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, {
      durable: true,
      deadLetterExchange: DEFAULT_DLX,
      deadLetterRoutingKey: 'dead-letter',
    });

    for (const key of BOUND_ROUTING_KEYS) {
      await this.channel.bindQueue(queue, exchange, key);
    }
  }

  async publish(routingKey: string, message: Record<string, any>): Promise<boolean> {
    if (!this.channel || !this.isConnected) {
      return false;
    }

    try {
      const exchange =
        this.configService.get<string>('notification.rabbitmq.exchange') || DEFAULT_EXCHANGE;
      const content = Buffer.from(JSON.stringify(message));

      const published = this.channel.publish(exchange, routingKey, content, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      });

      return published;
    } catch (err: any) {
      this.logger.error(`Failed to publish message to RabbitMQ: ${err?.message}`);
      return false;
    }
  }
}
