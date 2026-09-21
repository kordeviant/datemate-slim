export class UserSessionEntity {
  id: number;
  userId: number;
  refreshTokenHash: string;
  deviceInfo?: string | null;
  fcmToken?: string | null;
  expiresAt: Date;
  createdAt: Date;

  constructor(partial: Partial<UserSessionEntity>) {
    Object.assign(this, partial);
  }
}
