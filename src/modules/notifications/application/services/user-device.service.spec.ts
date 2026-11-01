import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserDeviceService } from './user-device.service';
import { GetDeviceTokenUseCase } from '../../../auth/application/use-cases/get-device-token.use-case';

describe('UserDeviceService', () => {
  let service: UserDeviceService;
  let mockGetDeviceTokenUseCase: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockGetDeviceTokenUseCase = {
      execute: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserDeviceService,
        { provide: GetDeviceTokenUseCase, useValue: mockGetDeviceTokenUseCase },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UserDeviceService>(UserDeviceService);
  });

  it('should resolve token in-memory using GetDeviceTokenUseCase', async () => {
    mockGetDeviceTokenUseCase.execute.mockResolvedValue({
      userId: 10,
      token: 'fcm_token_direct_in_memory',
      deviceInfo: 'iPhone 15',
    });

    const token = await service.getDeviceToken(10);
    expect(token).toBe('fcm_token_direct_in_memory');
    expect(mockGetDeviceTokenUseCase.execute).toHaveBeenCalledWith(10);
  });

  it('should return null when user has no active token in database', async () => {
    mockGetDeviceTokenUseCase.execute.mockResolvedValue({
      userId: 10,
      token: null,
    });

    const token = await service.getDeviceToken(10);
    expect(token).toBeNull();
  });
});
