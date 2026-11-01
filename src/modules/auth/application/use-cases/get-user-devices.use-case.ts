import { Inject, Injectable } from '@nestjs/common';
import {
  IUserSessionRepository,
  USER_SESSION_REPOSITORY,
} from '../../domain/repositories/user-session.repository.interface';
import { TokenService } from '../services/token.service';
import {
  UserDeviceItemDto,
  UserDevicesDataDto,
} from '../dtos/user-devices.dto';

@Injectable()
export class GetUserDevicesUseCase {
  constructor(
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    userId: number,
    currentSessionId?: number,
    currentRefreshToken?: string,
  ): Promise<UserDevicesDataDto> {
    const sessions = await this.sessionRepository.findSessionsByUserId(userId);
    const now = new Date();

    const currentHash =
      currentRefreshToken && currentRefreshToken.trim()
        ? this.tokenService.hashRefreshToken(currentRefreshToken.trim())
        : null;

    const devices: UserDeviceItemDto[] = sessions.map((s) => {
      const isActive = Boolean(s.expiresAt && new Date(s.expiresAt) > now);
      const isCurrent = Boolean(
        (currentSessionId && s.id === currentSessionId) ||
        (currentHash && s.refreshTokenHash === currentHash),
      );

      return {
        id: s.id,
        deviceInfo: s.deviceInfo ?? null,
        fcmToken: s.fcmToken ?? null,
        isActive,
        isCurrent,
        createdAt:
          typeof s.createdAt?.toISOString === 'function'
            ? s.createdAt.toISOString()
            : String(s.createdAt),
        expiresAt: s.expiresAt
          ? typeof s.expiresAt.toISOString === 'function'
            ? s.expiresAt.toISOString()
            : String(s.expiresAt)
          : null,
      };
    });

    const activeDevices = devices.filter((d) => d.isActive);
    const inactiveDevices = devices.filter((d) => !d.isActive);

    return {
      devices,
      activeDevices,
      inactiveDevices,
      total: devices.length,
      activeCount: activeDevices.length,
      inactiveCount: inactiveDevices.length,
    };
  }
}
