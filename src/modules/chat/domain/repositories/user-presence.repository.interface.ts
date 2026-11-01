export interface UserPresenceRecord {
  userId: number;
  isOnline: boolean;
  lastSeenAt: Date | null;
}

export interface IUserPresenceRepository {
  upsertPresence(userId: number, isOnline: boolean, lastSeenAt: Date): Promise<void>;
  findById(userId: number): Promise<UserPresenceRecord | null>;
  findBatch(userIds: number[]): Promise<Map<number, UserPresenceRecord>>;
}
