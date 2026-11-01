import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { DeviceTokenDataDto, UpdateDeviceTokenDto } from '../dtos/device-token.dto';

@Injectable()
export class UpdateDeviceTokenUseCase {
  private readonly logger = new Logger(UpdateDeviceTokenUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    userId: number,
    dto: UpdateDeviceTokenDto,
    sessionId?: number,
  ): Promise<DeviceTokenDataDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    let targetSession = sessionId
      ? await this.prisma.userSession.findFirst({
          where: { id: sessionId, userId },
        })
      : null;

    if (!targetSession) {
      targetSession = await this.prisma.userSession.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (targetSession) {
      const updated = await this.prisma.userSession.update({
        where: { id: targetSession.id },
        data: {
          fcmToken: dto.token,
          ...(dto.deviceInfo !== undefined ? { deviceInfo: dto.deviceInfo } : {}),
        },
      });

      this.logger.log(`Updated device token for user ${userId} on session ${targetSession.id}`);

      return {
        userId,
        token: updated.fcmToken ?? dto.token,
        deviceInfo: updated.deviceInfo ?? null,
      };
    }

    const refreshTokenHash = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const created = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash,
        fcmToken: dto.token,
        deviceInfo: dto.deviceInfo ?? null,
        expiresAt,
      },
    });

    this.logger.log(`Created new device session ${created.id} with token for user ${userId}`);

    return {
      userId,
      token: created.fcmToken ?? dto.token,
      deviceInfo: created.deviceInfo ?? null,
    };
  }
}
