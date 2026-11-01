export class UserEntity {
  id: number;
  email: string;
  passwordHash: string;
  role: 'USER' | 'ADMIN';
  language: 'EN' | 'FA';
  profileValidated: boolean;
  isPremium: boolean;
  bannedUntil?: Date | null;
  wallet: number;
  score: number;
  notificationsOn: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
