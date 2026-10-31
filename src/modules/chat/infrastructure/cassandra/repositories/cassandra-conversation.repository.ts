import { Injectable, Logger } from "@nestjs/common";
import { types as CassandraTypes } from "cassandra-driver";
import { CassandraClientService } from "../cassandra.client";
import { Conversation } from "../../../domain/entities/conversation.entity";
import {
  IConversationRepository,
  UserConversationProjection,
} from "../../../domain/repositories/conversation.repository.interface";
import { ConversationType } from "../../../domain/enums/conversation-type.enum";

@Injectable()
export class CassandraConversationRepository implements IConversationRepository {
  private readonly logger = new Logger(CassandraConversationRepository.name);

  constructor(private readonly cassandra: CassandraClientService) {}

  public async create(conversation: Conversation): Promise<void> {
    const query = `
      INSERT INTO conversations (
        conversation_id, conversation_type, created_by, created_at, title,
        last_message_at, last_message_id, last_message_sender_id, last_message_preview, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const lastMessageAt = conversation.lastMessageAt
      ? CassandraTypes.TimeUuid.fromString(conversation.lastMessageAt)
      : null;
    const lastMessageId = conversation.lastMessageId
      ? CassandraTypes.Uuid.fromString(conversation.lastMessageId)
      : null;
    const senderId = conversation.lastMessageSenderId
      ? this.cassandra.toLong(conversation.lastMessageSenderId)
      : null;

    const params = [
      CassandraTypes.Uuid.fromString(conversation.conversationId),
      conversation.conversationType,
      this.cassandra.toLong(conversation.createdBy),
      conversation.createdAt,
      conversation.title || null,
      lastMessageAt,
      lastMessageId,
      senderId,
      conversation.lastMessagePreview || null,
      conversation.updatedAt || conversation.createdAt,
    ];

    await this.cassandra.getClient().execute(query, params, { prepare: true });
  }

  public async findById(conversationId: string): Promise<Conversation | null> {
    const query = `SELECT * FROM conversations WHERE conversation_id = ?;`;
    const params = [CassandraTypes.Uuid.fromString(conversationId)];
    const result = await this.cassandra.getClient().execute(query, params, { prepare: true });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return new Conversation({
      conversationId: row.conversation_id.toString(),
      conversationType: row.conversation_type as ConversationType,
      createdBy: this.cassandra.fromLong(row.created_by),
      createdAt: row.created_at,
      title: row.title,
      lastMessageAt: row.last_message_at ? row.last_message_at.toString() : null,
      lastMessageId: row.last_message_id ? row.last_message_id.toString() : null,
      lastMessageSenderId: row.last_message_sender_id ? this.cassandra.fromLong(row.last_message_sender_id) : null,
      lastMessagePreview: row.last_message_preview,
      updatedAt: row.updated_at,
    });
  }

  public async updateMetadata(
    conversationId: string,
    lastMessageAt: string,
    lastMessageId: string,
    lastMessageSenderId: number,
    lastMessagePreview: string,
    updatedAt: Date,
  ): Promise<boolean> {
    const query = `
      UPDATE conversations
      SET last_message_at = ?,
          last_message_id = ?,
          last_message_sender_id = ?,
          last_message_preview = ?,
          updated_at = ?
      WHERE conversation_id = ?;
    `;

    const params = [
      CassandraTypes.TimeUuid.fromString(lastMessageAt),
      CassandraTypes.Uuid.fromString(lastMessageId),
      this.cassandra.toLong(lastMessageSenderId),
      lastMessagePreview,
      updatedAt,
      CassandraTypes.Uuid.fromString(conversationId),
    ];

    await this.cassandra.getClient().execute(query, params, { prepare: true });
    return true;
  }

  public async findUserConversations(
    userId: number,
    limit: number,
    pagingState?: string | null,
  ): Promise<{ items: UserConversationProjection[]; nextPagingState: string | null }> {
    const query = `SELECT * FROM conversations_by_user WHERE user_id = ?;`;
    const params = [this.cassandra.toLong(userId)];

    const options: any = {
      prepare: true,
      fetchSize: limit,
    };
    if (pagingState) {
      options.pageState = Buffer.from(pagingState, "hex");
    }

    const result = await this.cassandra.getClient().execute(query, params, options);

    const items: UserConversationProjection[] = (result.rows || []).map((row) => ({
      userId: this.cassandra.fromLong(row.user_id),
      lastMessageAt: row.last_message_at ? row.last_message_at.toString() : "",
      conversationId: row.conversation_id.toString(),
      conversationType: row.conversation_type,
      lastMessagePreview: row.last_message_preview,
      lastMessageSenderId: row.last_message_sender_id ? this.cassandra.fromLong(row.last_message_sender_id) : null,
      title: row.title,
    }));

    const nextPagingState = result.pageState
      ? (Buffer.isBuffer(result.pageState) ? result.pageState.toString("hex") : String(result.pageState))
      : null;

    return { items, nextPagingState };
  }

  public async upsertUserConversationProjection(
    projection: UserConversationProjection,
    oldLastMessageAt?: string | null,
  ): Promise<void> {
    const client = this.cassandra.getClient();

    // 1. If old projection exists with different clustering key, delete old row to prevent duplicates
    if (oldLastMessageAt && oldLastMessageAt !== projection.lastMessageAt) {
      const deleteQuery = `
        DELETE FROM conversations_by_user
        WHERE user_id = ? AND last_message_at = ? AND conversation_id = ?;
      `;
      const deleteParams = [
        this.cassandra.toLong(projection.userId),
        CassandraTypes.TimeUuid.fromString(oldLastMessageAt),
        CassandraTypes.Uuid.fromString(projection.conversationId),
      ];
      await client.execute(deleteQuery, deleteParams, { prepare: true });
    }

    // 2. Insert new projection row
    const insertQuery = `
      INSERT INTO conversations_by_user (
        user_id, last_message_at, conversation_id, conversation_type,
        last_message_preview, last_message_sender_id, title
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    const insertParams = [
      this.cassandra.toLong(projection.userId),
      CassandraTypes.TimeUuid.fromString(projection.lastMessageAt),
      CassandraTypes.Uuid.fromString(projection.conversationId),
      projection.conversationType,
      projection.lastMessagePreview || null,
      projection.lastMessageSenderId ? this.cassandra.toLong(projection.lastMessageSenderId) : null,
      projection.title || null,
    ];

    await client.execute(insertQuery, insertParams, { prepare: true });
  }
}
