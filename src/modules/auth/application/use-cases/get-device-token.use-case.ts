import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { DeviceTokenDataDto } from '../dtos/device-token.dto';

@Injectable()
export class GetDeviceTokenUseCase {
  private readonly logger = new Logger(GetDeviceTokenUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: number): Promise<DeviceTokenDataDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Prioritize active session with non-null fcmToken
    const activeSession = await this.prisma.userSession.findFirst({
      where: {
        userId,
        fcmToken: { not: null },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSession) {
      return {
        userId,
        token: activeSession.fcmToken ?? null,
        deviceInfo: activeSession.deviceInfo ?? null,
      };
    }

    // Fallback to any session with non-null fcmToken
    const fallbackSession = await this.prisma.userSession.findFirst({
      where: {
        userId,
        fcmToken: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (fallbackSession) {
      return {
        userId,
        token: fallbackSession.fcmToken ?? null,
        deviceInfo: fallbackSession.deviceInfo ?? null,
      };
    }

    // If no token exists, return latest session deviceInfo or null
    const latestSession = await this.prisma.userSession.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      userId,
      token: null,
      deviceInfo: latestSession?.deviceInfo ?? null,
    };
  }
}
