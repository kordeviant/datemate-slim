import { Injectable } from "@nestjs/common";
import { types as CassandraTypes } from "cassandra-driver";
import { CassandraClientService } from "../cassandra.client";
import { GroupProfile } from "../../../domain/entities/group-profile.entity";
import { GroupRelationship } from "../../../domain/entities/group-relationship.entity";
import { GroupMembershipStatus } from "../../../domain/enums/group-membership-status.enum";
import { MemberRole } from "../../../domain/enums/member-role.enum";
import { IGroupRepository } from "../../../domain/repositories/group.repository.interface";
import { CursorUtil } from "@common/utils/cursor.util";
import { InvalidCursorException } from "../../../domain/exceptions/invalid-cursor.exception";

@Injectable()
export class CassandraGroupRepository implements IGroupRepository {
  private static readonly RELATIONSHIP_SHARDS = 32;
  constructor(private readonly cassandra: CassandraClientService) {}

  private shardFor(userId: number): number {
    return Math.abs(userId) % CassandraGroupRepository.RELATIONSHIP_SHARDS;
  }

  public async createProfile(profile: GroupProfile): Promise<void> {
    const p = profile.toJSON();
    await this.cassandra.getClient().execute(
      `INSERT INTO group_profiles_by_id (conversation_id, owner_id, active, is_private, title, bio, gender, minimum_age, maximum_age, subject_id, city_id, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        CassandraTypes.Uuid.fromString(p.conversationId),
        this.cassandra.toLong(p.ownerId),
        p.active,
        p.isPrivate,
        p.title,
        p.bio || null,
        p.gender || null,
        p.minimumAge ?? null,
        p.maximumAge ?? null,
        p.subjectId === undefined || p.subjectId === null ? null : this.cassandra.toLong(p.subjectId),
        p.cityId === undefined || p.cityId === null ? null : this.cassandra.toLong(p.cityId),
        p.avatar || null,
        p.createdAt,
        p.updatedAt,
      ],
      { prepare: true },
    );
  }

  public async findProfile(conversationId: string): Promise<GroupProfile | null> {
    const result = await this.cassandra.getClient().execute(
      "SELECT * FROM group_profiles_by_id WHERE conversation_id = ?;",
      [CassandraTypes.Uuid.fromString(conversationId)],
      { prepare: true },
    );
    const row = result.rows?.[0];
    if (!row) return null;
    return new GroupProfile({
      conversationId: row.conversation_id.toString(),
      ownerId: this.cassandra.fromLong(row.owner_id),
      active: row.active,
      isPrivate: row.is_private,
      title: row.title,
      bio: row.bio,
      gender: row.gender,
      minimumAge: row.minimum_age,
      maximumAge: row.maximum_age,
      subjectId: row.subject_id ? this.cassandra.fromLong(row.subject_id) : null,
      cityId: row.city_id ? this.cassandra.fromLong(row.city_id) : null,
      avatar: row.avatar,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  public async updateProfile(profile: GroupProfile): Promise<void> {
    return this.createProfile(profile);
  }

  public async findRelationship(conversationId: string, userId: number): Promise<GroupRelationship | null> {
    const result = await this.cassandra.getClient().execute(
      "SELECT * FROM group_relationships_by_user WHERE conversation_id = ? AND user_id = ?;",
      [CassandraTypes.Uuid.fromString(conversationId), this.cassandra.toLong(userId)],
      { prepare: true },
    );
    return this.toRelationship(result.rows?.[0]);
  }

  public async createRelationshipIfAbsent(
    relationship: GroupRelationship,
  ): Promise<{ applied: boolean; existing?: GroupRelationship | null }> {
    const p = relationship.toJSON();
    const result = await this.cassandra.getClient().execute(
      `INSERT INTO group_relationships_by_user (
        conversation_id, user_id, status, role, created_at, updated_at,
        requested_at, invited_at, joined_at, banned_at, banned_by_user_id, ban_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS;`,
      [
        CassandraTypes.Uuid.fromString(p.conversationId),
        this.cassandra.toLong(p.userId),
        p.status,
        p.role || null,
        p.createdAt,
        p.updatedAt,
        p.requestedAt || null,
        p.invitedAt || null,
        p.joinedAt || null,
        p.bannedAt || null,
        p.bannedByUserId ? this.cassandra.toLong(p.bannedByUserId) : null,
        p.banReason || null,
      ],
      { prepare: true },
    );
    if (result.wasApplied()) {
      await this.writeGroupRelationship(relationship);
      return { applied: true };
    }
    return { applied: false, existing: this.toRelationship(result.rows?.[0]) };
  }

  public async upsertRelationship(relationship: GroupRelationship): Promise<void> {
    const p = relationship.toJSON();
    await this.cassandra.getClient().execute(
      `INSERT INTO group_relationships_by_user (
        conversation_id, user_id, status, role, created_at, updated_at,
        requested_at, invited_at, joined_at, banned_at, banned_by_user_id, ban_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        CassandraTypes.Uuid.fromString(p.conversationId),
        this.cassandra.toLong(p.userId),
        p.status,
        p.role || null,
        p.createdAt,
        p.updatedAt,
        p.requestedAt || null,
        p.invitedAt || null,
        p.joinedAt || null,
        p.bannedAt || null,
        p.bannedByUserId ? this.cassandra.toLong(p.bannedByUserId) : null,
        p.banReason || null,
      ],
      { prepare: true },
    );
    await this.writeGroupRelationship(relationship);
  }

  public async transitionRelationship(relationship: GroupRelationship, expectedStatus: string): Promise<boolean> {
    const p = relationship.toJSON();
    const result = await this.cassandra.getClient().execute(
      `UPDATE group_relationships_by_user
       SET status = ?, role = ?, updated_at = ?, requested_at = ?, invited_at = ?, joined_at = ?, banned_at = ?, banned_by_user_id = ?, ban_reason = ?
       WHERE conversation_id = ? AND user_id = ? IF status = ?;`,
      [
        p.status,
        p.role || null,
        p.updatedAt,
        p.requestedAt || null,
        p.invitedAt || null,
        p.joinedAt || null,
        p.bannedAt || null,
        p.bannedByUserId ? this.cassandra.toLong(p.bannedByUserId) : null,
        p.banReason || null,
        CassandraTypes.Uuid.fromString(p.conversationId),
        this.cassandra.toLong(p.userId),
        expectedStatus,
      ],
      { prepare: true },
    );
    if (!result.wasApplied()) return false;

    if (expectedStatus !== p.status) {
      await this.deleteStatusProjection(p.conversationId, p.userId, expectedStatus);
    }
    await this.writeGroupRelationship(relationship);
    return true;
  }

  public async listRelationships(
    conversationId: string,
    status: string,
    limit: number,
    cursor?: string | null,
  ): Promise<{ items: GroupRelationship[]; nextCursor: string | null }> {
    let startShard = 0;
    let startPagingState: string | null = null;

    if (cursor) {
      try {
        const decoded = CursorUtil.decode(cursor);
        if (typeof decoded.shard === "number") {
          startShard = decoded.shard;
        }
        if (decoded.pagingState) {
          startPagingState = decoded.pagingState;
        }
      } catch {
        throw new InvalidCursorException();
      }
    }

    const items: GroupRelationship[] = [];
    let currentShard = startShard;
    let currentPagingState = startPagingState;
    let nextCursor: string | null = null;

    while (currentShard < CassandraGroupRepository.RELATIONSHIP_SHARDS && items.length < limit) {
      const needed = limit - items.length;
      const options: any = {
        prepare: true,
        fetchSize: needed,
      };
      if (currentPagingState) {
        options.pageState = Buffer.from(currentPagingState, "hex");
      }

      const query = `
        SELECT * FROM group_relationships_by_group_and_status
        WHERE conversation_id = ? AND shard = ? AND status = ?;
      `;
      const result = await this.cassandra.getClient().execute(
        query,
        [CassandraTypes.Uuid.fromString(conversationId), currentShard, status],
        options,
      );

      const rows = result.rows || [];
      for (const row of rows) {
        const rel = this.toRelationship(row);
        if (rel) items.push(rel);
      }

      const pageStateStr = result.pageState
        ? (Buffer.isBuffer(result.pageState) ? result.pageState.toString("hex") : String(result.pageState))
        : null;

      if (pageStateStr) {
        if (items.length >= limit) {
          nextCursor = CursorUtil.encode({ shard: currentShard, pagingState: pageStateStr });
          break;
        } else {
          currentPagingState = pageStateStr;
        }
      } else {
        currentShard++;
        currentPagingState = null;
        if (items.length >= limit) {
          if (currentShard < CassandraGroupRepository.RELATIONSHIP_SHARDS) {
            nextCursor = CursorUtil.encode({ shard: currentShard, pagingState: null });
          } else {
            nextCursor = null;
          }
          break;
        }
      }
    }

    return { items, nextCursor };
  }

  private async writeGroupRelationship(relationship: GroupRelationship): Promise<void> {
    const p = relationship.toJSON();
    const cid = CassandraTypes.Uuid.fromString(p.conversationId);
    const uid = this.cassandra.toLong(p.userId);
    const shard = this.shardFor(p.userId);

    // 1. Write to bounded sharded relationship table
    await this.cassandra.getClient().execute(
      `INSERT INTO group_relationships_by_group (conversation_id, shard, user_id, status, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [cid, shard, uid, p.status, p.role || null, p.createdAt, p.updatedAt],
      { prepare: true },
    );

    // 2. Write to status-specific sharded projection table
    await this.cassandra.getClient().execute(
      `INSERT INTO group_relationships_by_group_and_status (
        conversation_id, shard, status, user_id, role,
        created_at, updated_at, requested_at, invited_at, joined_at,
        banned_at, banned_by_user_id, ban_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        cid,
        shard,
        p.status,
        uid,
        p.role || null,
        p.createdAt,
        p.updatedAt,
        p.requestedAt || null,
        p.invitedAt || null,
        p.joinedAt || null,
        p.bannedAt || null,
        p.bannedByUserId ? this.cassandra.toLong(p.bannedByUserId) : null,
        p.banReason || null,
      ],
      { prepare: true },
    );
  }

  private async deleteStatusProjection(conversationId: string, userId: number, oldStatus: string): Promise<void> {
    await this.cassandra.getClient().execute(
      `DELETE FROM group_relationships_by_group_and_status
       WHERE conversation_id = ? AND shard = ? AND status = ? AND user_id = ?;`,
      [
        CassandraTypes.Uuid.fromString(conversationId),
        this.shardFor(userId),
        oldStatus,
        this.cassandra.toLong(userId),
      ],
      { prepare: true },
    );
  }

  private toRelationship(row: any): GroupRelationship | null {
    if (!row || !row.status) return null;
    return new GroupRelationship({
      conversationId: row.conversation_id.toString(),
      userId: this.cassandra.fromLong(row.user_id),
      status: row.status as GroupMembershipStatus,
      role: (row.role as MemberRole) || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      requestedAt: row.requested_at || null,
      invitedAt: row.invited_at || null,
      joinedAt: row.joined_at || null,
      bannedAt: row.banned_at || null,
      bannedByUserId: row.banned_by_user_id ? this.cassandra.fromLong(row.banned_by_user_id) : null,
      banReason: row.ban_reason || null,
    });
  }
}
