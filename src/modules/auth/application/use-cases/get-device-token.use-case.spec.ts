import { NotFoundException } from '@nestjs/common';
import { GetDeviceTokenUseCase } from './get-device-token.use-case';

describe('GetDeviceTokenUseCase', () => {
  let useCase: GetDeviceTokenUseCase;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      userSession: {
        findFirst: jest.fn(),
      },
    };
    useCase = new GetDeviceTokenUseCase(mockPrisma);
  });

  it('should throw NotFoundException if user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
  });

  it('should return active session token and deviceInfo when active session exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.userSession.findFirst.mockResolvedValueOnce({
      id: 1,
      userId: 10,
      fcmToken: 'active_fcm_token_123',
      deviceInfo: 'Galaxy S24',
      expiresAt: new Date(Date.now() + 100000),
    });

    const result = await useCase.execute(10);

    expect(result).toEqual({
      userId: 10,
      token: 'active_fcm_token_123',
      deviceInfo: 'Galaxy S24',
    });
  });

  it('should fallback to any session with non-null token if no active session found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10 });
    // Active session returns null
    mockPrisma.userSession.findFirst.mockResolvedValueOnce(null);
    // Fallback session returns non-null
    mockPrisma.userSession.findFirst.mockResolvedValueOnce({
      id: 2,
      userId: 10,
      fcmToken: 'fallback_token_456',
      deviceInfo: 'iPad Pro',
    });

    const result = await useCase.execute(10);

    expect(result).toEqual({
      userId: 10,
      token: 'fallback_token_456',
      deviceInfo: 'iPad Pro',
    });
  });

  it('should return token null when user exists but has no token registered', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.userSession.findFirst.mockResolvedValueOnce(null); // active
    mockPrisma.userSession.findFirst.mockResolvedValueOnce(null); // fallback
    mockPrisma.userSession.findFirst.mockResolvedValueOnce({
      id: 3,
      userId: 10,
      fcmToken: null,
      deviceInfo: 'Web Browser',
    });

    const result = await useCase.execute(10);

    expect(result).toEqual({
      userId: 10,
      token: null,
      deviceInfo: 'Web Browser',
    });
  });
});
