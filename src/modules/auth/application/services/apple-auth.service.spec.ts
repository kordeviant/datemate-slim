import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { AppleAuthService } from './apple-auth.service';
import appleSignin from 'apple-signin-auth';

const mockVerifyIdToken = jest.fn();

jest.mock('apple-signin-auth', () => {
  return {
    __esModule: true,
    default: {
      verifyIdToken: (...args: any[]) => mockVerifyIdToken(...args),
    },
    verifyIdToken: (...args: any[]) => mockVerifyIdToken(...args),
  };
});

describe('AppleAuthService', () => {
  let service: AppleAuthService;
  let mockConfigService: any;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppleAuthService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AppleAuthService>(AppleAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully verify a valid Apple ID token', async () => {
    mockConfigService.get.mockReturnValue('com.dmate.datemate');
    const mockPayload = {
      sub: 'apple.user.id',
      email: 'appleuser@example.com',
      email_verified: true,
    };
    mockVerifyIdToken.mockResolvedValue(mockPayload);

    const result = await service.verifyIdToken('valid.jwt.token');

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.jwt.token', {
      audience: 'com.dmate.datemate',
      ignoreExpiration: false,
    });
    expect(result).toEqual(mockPayload);
  });

  it('should use bundleIdOverride if passed', async () => {
    mockConfigService.get.mockReturnValue('com.dmate.datemate');
    const mockPayload = {
      sub: 'apple.user.id',
      email: 'appleuser@example.com',
    };
    mockVerifyIdToken.mockResolvedValue(mockPayload);

    await service.verifyIdToken('valid.jwt.token', 'com.dmate.datemate.ios');

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.jwt.token', {
      audience: 'com.dmate.datemate.ios',
      ignoreExpiration: false,
    });
  });

  it('should throw UnauthorizedException if apple-signin-auth fails', async () => {
    mockVerifyIdToken.mockRejectedValue(
      new Error('Token signature verification failed'),
    );

    await expect(service.verifyIdToken('invalid.jwt.token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
