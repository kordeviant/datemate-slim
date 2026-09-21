import { UserSessionEntity } from '../user-session.entity';

export interface IUserSessionRepository {
  createSession(data: {
    userId: number;
    refreshTokenHash: string;
    deviceInfo?: string;
    fcmToken?: string;
    expiresAt: Date;
  }): Promise<UserSessionEntity>;
  findByTokenHash(refreshTokenHash: string): Promise<UserSessionEntity | null>;
  deleteByTokenHash(refreshTokenHash: string): Promise<void>;
  deleteAllForUser(userId: number): Promise<void>;
}

export const USER_SESSION_REPOSITORY = Symbol('IUserSessionRepository');
