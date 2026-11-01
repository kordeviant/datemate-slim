import { Injectable, Logger } from "@nestjs/common";
import { CassandraClientService } from "../cassandra.client";
import {
  IUserPresenceRepository,
  UserPresenceRecord,
} from "../../../domain/repositories/user-presence.repository.interface";

@Injectable()
export class CassandraUserPresenceRepository implements IUserPresenceRepository {
  private readonly logger = new Logger(CassandraUserPresenceRepository.name);

  constructor(private readonly cassandra: CassandraClientService) {}

  public async upsertPresence(
    userId: number,
    isOnline: boolean,
    lastSeenAt: Date,
  ): Promise<void> {
    const query = `
      INSERT INTO user_presence (user_id, is_online, last_seen_at)
      VALUES (?, ?, ?);
    `;
    const params = [
      this.cassandra.toLong(userId),
      isOnline,
      lastSeenAt,
    ];
    await this.cassandra.getClient().execute(query, params, { prepare: true });
  }

  public async findById(userId: number): Promise<UserPresenceRecord | null> {
    const query = `
      SELECT user_id, is_online, last_seen_at
      FROM user_presence
      WHERE user_id = ?;
    `;
    const params = [this.cassandra.toLong(userId)];
    const result = await this.cassandra.getClient().execute(query, params, { prepare: true });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      userId: this.cassandra.fromLong(row.user_id),
      isOnline: Boolean(row.is_online),
      lastSeenAt: row.last_seen_at || null,
    };
  }

  public async findBatch(userIds: number[]): Promise<Map<number, UserPresenceRecord>> {
    const resultMap = new Map<number, UserPresenceRecord>();
    if (!userIds || userIds.length === 0) {
      return resultMap;
    }

    const uniqueIds = Array.from(new Set(userIds));
    const longIds = uniqueIds.map((id) => this.cassandra.toLong(id));

    const query = `
      SELECT user_id, is_online, last_seen_at
      FROM user_presence
      WHERE user_id IN ?;
    `;
    const result = await this.cassandra.getClient().execute(query, [longIds], { prepare: true });

    if (result.rows && result.rows.length > 0) {
      for (const row of result.rows) {
        const id = this.cassandra.fromLong(row.user_id);
        resultMap.set(id, {
          userId: id,
          isOnline: Boolean(row.is_online),
          lastSeenAt: row.last_seen_at || null,
        });
      }
    }

    return resultMap;
  }
}
