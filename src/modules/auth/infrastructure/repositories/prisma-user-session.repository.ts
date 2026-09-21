import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { IUserSessionRepository } from '../../domain/repositories/user-session.repository.interface';
import { UserSessionEntity } from '../../domain/user-session.entity';

@Injectable()
export class PrismaUserSessionRepository implements IUserSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(data: {
    userId: number;
    refreshTokenHash: string;
    deviceInfo?: string;
    fcmToken?: string;
    expiresAt: Date;
  }): Promise<UserSessionEntity> {
    const session = await this.prisma.userSession.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        deviceInfo: data.deviceInfo,
        fcmToken: data.fcmToken,
        expiresAt: data.expiresAt,
      },
    });
    return new UserSessionEntity(session);
  }

  async findByTokenHash(refreshTokenHash: string): Promise<UserSessionEntity | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash },
    });
    return session ? new UserSessionEntity(session) : null;
  }

  async deleteByTokenHash(refreshTokenHash: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { refreshTokenHash },
    });
  }

  async deleteAllForUser(userId: number): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }
}
