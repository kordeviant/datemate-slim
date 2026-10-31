import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PushService } from './push.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { UserDeviceService } from './user-device.service';
import { ProviderFactoryService } from '../../infrastructure/providers/provider-factory.service';

describe('PushService', () => {
  let service: PushService;
  let mockRabbitMq: any;
  let mockUserDeviceService: any;
  let mockProviderFactory: any;
  let mockFcmProvider: any;

  beforeEach(async () => {
    mockRabbitMq = {
      publish: jest.fn().mockResolvedValue(true),
    };

    mockUserDeviceService = {
      getDeviceToken: jest.fn(),
    };

    mockFcmProvider = {
      send: jest.fn().mockResolvedValue({ success: true, provider: 'fcm' }),
      sendMulticast: jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        invalidTokens: [],
        provider: 'fcm',
      }),
      sendToTopic: jest.fn().mockResolvedValue({ success: true, provider: 'fcm' }),
    };

    mockProviderFactory = {
      getProvider: jest.fn().mockReturnValue(mockFcmProvider),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: RabbitMqService, useValue: mockRabbitMq },
        { provide: UserDeviceService, useValue: mockUserDeviceService },
        { provide: ProviderFactoryService, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
  });

  describe('enqueue', () => {
    it('should throw BadRequestException if neither device_token, tokens, topic nor userId is provided', async () => {
      await expect(
        service.enqueue({
          title: 'Parsa Moloudie',
          body: 'hello Jhon, how are you?',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should immediately enqueue to RabbitMQ when device_token is provided', async () => {
      const response = await service.enqueue({
        title: 'Parsa Moloudie',
        body: 'hello Jhon, how are you?',
        device_token: 'fcm_token_123',
      });

      expect(response.status).toBe('QUEUED');
      expect(response.title).toBe('Parsa Moloudie');
      expect(response.job_id).toBeDefined();
      expect(mockRabbitMq.publish).toHaveBeenCalledWith(
        'push.dispatch',
        expect.objectContaining({
          title: 'Parsa Moloudie',
          body: 'hello Jhon, how are you?',
          device_token: 'fcm_token_123',
          job_id: response.job_id,
        }),
      );
    });

    it('should immediately enqueue to RabbitMQ when only userId is provided', async () => {
      const response = await service.enqueue({
        title: 'Parsa Moloudie',
        body: 'hello Jhon, how are you?',
        userId: 12,
      });

      expect(response.status).toBe('QUEUED');
      expect(response.title).toBe('Parsa Moloudie');
      expect(response.job_id).toBeDefined();
      expect(mockRabbitMq.publish).toHaveBeenCalledWith(
        'push.dispatch',
        expect.objectContaining({
          title: 'Parsa Moloudie',
          body: 'hello Jhon, how are you?',
          userId: 12,
          job_id: response.job_id,
        }),
      );
    });

    it('should fallback to in-process execution without error if RabbitMQ publish fails', async () => {
      mockRabbitMq.publish.mockResolvedValueOnce(false);

      const response = await service.enqueue({
        title: 'Parsa Moloudie',
        body: 'hello Jhon, how are you?',
        topic: 'news',
      });

      expect(response.status).toBe('QUEUED');
      expect(response.job_id).toBeDefined();
    });
  });

  describe('processPushJob', () => {
    it('should resolve userId to device token via UserDeviceService and send multicast', async () => {
      mockUserDeviceService.getDeviceToken.mockResolvedValue('resolved_user_token_99');

      const result = await service.processPushJob({
        title: 'Direct User Msg',
        body: 'Message for user 12',
        userId: 12,
      });

      expect(mockUserDeviceService.getDeviceToken).toHaveBeenCalledWith(12);
      expect(mockFcmProvider.sendMulticast).toHaveBeenCalledWith(
        ['resolved_user_token_99'],
        expect.objectContaining({
          title: 'Direct User Msg',
          body: 'Message for user 12',
        }),
      );
      expect(result.successCount).toBe(1);
    });

    it('should dispatch to topic when topic is provided in job', async () => {
      const result = await service.processPushJob({
        title: 'Topic Alert',
        body: 'Broadcast update',
        topic: 'general_news',
      });

      expect(mockFcmProvider.sendToTopic).toHaveBeenCalledWith(
        'general_news',
        expect.objectContaining({
          title: 'Topic Alert',
          body: 'Broadcast update',
        }),
      );
      expect(result.topic).toBe('general_news');
      expect(result.successCount).toBe(1);
    });
  });
});
