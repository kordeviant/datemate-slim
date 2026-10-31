import { Test, TestingModule } from '@nestjs/testing';
import { PushController } from './push.controller';
import { PushService } from '../application/services/push.service';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';

describe('PushController', () => {
  let controller: PushController;
  let mockPushService: any;

  beforeEach(async () => {
    mockPushService = {
      enqueue: jest.fn().mockResolvedValue({
        job_id: 'job-12345',
        status: 'QUEUED',
        title: 'Test Notification',
        message: 'Push notification accepted and queued for immediate delivery',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushController],
      providers: [{ provide: PushService, useValue: mockPushService }],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PushController>(PushController);
  });

  it('should accept and enqueue push notification via /v1/push', async () => {
    const dto = {
      title: 'Test Notification',
      body: 'Hello there',
      userId: 12,
    };

    const response = await controller.sendPush(dto as any);
    expect(response.status).toBe('QUEUED');
    expect(response.job_id).toBe('job-12345');
    expect(mockPushService.enqueue).toHaveBeenCalledWith(dto);
  });

  it('should accept and enqueue push notification via alias /v1/notifications/push', async () => {
    const dto = {
      title: 'Alias Test',
      body: 'Testing alias route',
      device_token: 'token_abc',
    };

    const response = await controller.sendPushAlias(dto as any);
    expect(response.status).toBe('QUEUED');
    expect(mockPushService.enqueue).toHaveBeenCalledWith(dto);
  });
});
