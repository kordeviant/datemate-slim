import { GetUserDevicesUseCase } from './get-user-devices.use-case';
import { IUserSessionRepository } from '../../domain/repositories/user-session.repository.interface';
import { TokenService } from '../services/token.service';
import { UserSessionEntity } from '../../domain/user-session.entity';

describe('GetUserDevicesUseCase', () => {
  let useCase: GetUserDevicesUseCase;
  let mockSessionRepository: Partial<IUserSessionRepository>;
  let mockTokenService: Partial<TokenService>;

  beforeEach(() => {
    mockSessionRepository = {
      findSessionsByUserId: jest.fn(),
    };
    mockTokenService = {
      hashRefreshToken: jest.fn((token: string) => `hashed_${token}`),
    };

    useCase = new GetUserDevicesUseCase(
      mockSessionRepository as IUserSessionRepository,
      mockTokenService as TokenService,
    );
  });

  it('should return active and inactive devices and identify current session correctly', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24);

    const mockSessions: UserSessionEntity[] = [
      new UserSessionEntity({
        id: 1,
        userId: 10,
        refreshTokenHash: 'hashed_current_token',
        deviceInfo: 'iPhone 15 Pro',
        fcmToken: 'fcm_1',
        createdAt: new Date('2026-10-10'),
        expiresAt: futureDate,
      }),
      new UserSessionEntity({
        id: 2,
        userId: 10,
        refreshTokenHash: 'hashed_other_token',
        deviceInfo: 'Android Samsung Galaxy',
        fcmToken: 'fcm_2',
        createdAt: new Date('2026-10-09'),
        expiresAt: pastDate,
      }),
    ];

    (
      mockSessionRepository.findSessionsByUserId as jest.Mock
    ).mockResolvedValue(mockSessions);

    const result = await useCase.execute(10, 1);

    expect(mockSessionRepository.findSessionsByUserId).toHaveBeenCalledWith(10);

    expect(result.total).toBe(2);
    expect(result.activeCount).toBe(1);
    expect(result.inactiveCount).toBe(1);

    expect(result.devices[0].id).toBe(1);
    expect(result.devices[0].isActive).toBe(true);
    expect(result.devices[0].isCurrent).toBe(true);

    expect(result.devices[1].id).toBe(2);
    expect(result.devices[1].isActive).toBe(false);
    expect(result.devices[1].isCurrent).toBe(false);

    expect(result.activeDevices).toHaveLength(1);
    expect(result.activeDevices[0].id).toBe(1);
    expect(result.inactiveDevices).toHaveLength(1);
    expect(result.inactiveDevices[0].id).toBe(2);
  });

  it('should handle when currentRefreshToken is not provided', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const mockSessions: UserSessionEntity[] = [
      new UserSessionEntity({
        id: 1,
        userId: 10,
        refreshTokenHash: 'hashed_token',
        deviceInfo: 'MacBook Pro Chrome',
        createdAt: new Date('2026-10-10'),
        expiresAt: futureDate,
      }),
    ];

    (
      mockSessionRepository.findSessionsByUserId as jest.Mock
    ).mockResolvedValue(mockSessions);

    const result = await useCase.execute(10);

    expect(mockTokenService.hashRefreshToken).not.toHaveBeenCalled();
    expect(result.devices[0].isCurrent).toBe(false);
    expect(result.devices[0].isActive).toBe(true);
  });
});
