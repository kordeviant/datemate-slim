import { Injectable } from "@nestjs/common";
import { types as CassandraTypes } from "cassandra-driver";
import { CassandraClientService } from "../cassandra.client";
import { ConversationMember } from "../../../domain/entities/conversation-member.entity";
import { IConversationMemberRepository } from "../../../domain/repositories/conversation-member.repository.interface";
import { MemberRole } from "../../../domain/enums/member-role.enum";

@Injectable()
export class CassandraConversationMemberRepository implements IConversationMemberRepository {
  constructor(private readonly cassandra: CassandraClientService) {}

  public async addMember(member: ConversationMember): Promise<void> {
    const query = `
      INSERT INTO conversation_members (conversation_id, user_id, joined_at, role)
      VALUES (?, ?, ?, ?);
    `;
    const params = [
      CassandraTypes.Uuid.fromString(member.conversationId),
      this.cassandra.toLong(member.userId),
      member.joinedAt,
      member.role,
    ];
    await this.cassandra.getClient().execute(query, params, { prepare: true });
  }

  public async addMembers(members: ConversationMember[]): Promise<void> {
    await Promise.all(members.map((m) => this.addMember(m)));
  }

  public async findMembersByConversation(conversationId: string): Promise<ConversationMember[]> {
    const query = `SELECT * FROM conversation_members WHERE conversation_id = ?;`;
    const params = [CassandraTypes.Uuid.fromString(conversationId)];
    const result = await this.cassandra.getClient().execute(query, params, { prepare: true });

    return (result.rows || []).map(
      (row) =>
        new ConversationMember({
          conversationId: row.conversation_id.toString(),
          userId: this.cassandra.fromLong(row.user_id),
          joinedAt: row.joined_at,
          role: row.role as MemberRole,
        }),
    );
  }

  public async isMember(conversationId: string, userId: number): Promise<boolean> {
    const query = `SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?;`;
    const params = [
      CassandraTypes.Uuid.fromString(conversationId),
      this.cassandra.toLong(userId),
    ];
    const result = await this.cassandra.getClient().execute(query, params, { prepare: true });
    return !!(result.rows && result.rows.length > 0);
  }

  public async findMember(conversationId: string, userId: number): Promise<ConversationMember | null> {
    const query = `SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?;`;
    const params = [
      CassandraTypes.Uuid.fromString(conversationId),
      this.cassandra.toLong(userId),
    ];
    const result = await this.cassandra.getClient().execute(query, params, { prepare: true });
    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0];
    return new ConversationMember({
      conversationId: row.conversation_id.toString(),
      userId: this.cassandra.fromLong(row.user_id),
      joinedAt: row.joined_at,
      role: row.role as MemberRole,
    });
  }

  public async removeMember(conversationId: string, userId: number): Promise<void> {
    await this.cassandra.getClient().execute(
      "DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?;",
      [CassandraTypes.Uuid.fromString(conversationId), this.cassandra.toLong(userId)],
      { prepare: true },
    );
  }
}
