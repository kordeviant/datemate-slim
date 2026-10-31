import { Injectable } from "@nestjs/common";
import { types as CassandraTypes } from "cassandra-driver";
import { CassandraClientService } from "../cassandra.client";
import {
  IMessageIdempotencyRepository,
  MessageIdempotencyRecord,
} from "../../../domain/repositories/message-idempotency.repository.interface";

@Injectable()
export class CassandraMessageIdempotencyRepository implements IMessageIdempotencyRepository {
  constructor(private readonly cassandra: CassandraClientService) {}

  public async registerIfNotExists(
    conversationId: string,
    senderId: number,
    clientMessageId: string,
    messageId: string,
    createdAt: string,
  ): Promise<{ applied: boolean; existingRecord?: MessageIdempotencyRecord | null }> {
    const client = this.cassandra.getClient();

    const insertQuery = `
      INSERT INTO message_idempotency (conversation_id, sender_id, client_message_id, message_id, created_at)
      VALUES (?, ?, ?, ?, ?)
      IF NOT EXISTS;
    `;

    const params = [
      CassandraTypes.Uuid.fromString(conversationId),
      this.cassandra.toLong(senderId),
      clientMessageId,
      CassandraTypes.Uuid.fromString(messageId),
      CassandraTypes.TimeUuid.fromString(createdAt),
    ];

    const result = await client.execute(insertQuery, params, { prepare: true });

    if (result.wasApplied()) {
      return { applied: true };
    }

    // Row already exists; inspect returned LWT columns
    if (result.rows && result.rows.length > 0 && result.rows[0].message_id) {
      const row = result.rows[0];
      return {
        applied: false,
        existingRecord: {
          conversationId,
          senderId,
          clientMessageId,
          messageId: row.message_id.toString(),
          createdAt: row.created_at ? row.created_at.toString() : createdAt,
        },
      };
    }

    // Fallback: query record explicitly
    const existing = await this.find(conversationId, senderId, clientMessageId);
    return {
      applied: false,
      existingRecord: existing,
    };
  }

  public async find(
    conversationId: string,
    senderId: number,
    clientMessageId: string,
  ): Promise<MessageIdempotencyRecord | null> {
    const query = `
      SELECT * FROM message_idempotency
      WHERE conversation_id = ? AND sender_id = ? AND client_message_id = ?;
    `;

    const params = [
      CassandraTypes.Uuid.fromString(conversationId),
      this.cassandra.toLong(senderId),
      clientMessageId,
    ];

    const result = await this.cassandra.getClient().execute(query, params, { prepare: true });
    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      conversationId: row.conversation_id.toString(),
      senderId: this.cassandra.fromLong(row.sender_id),
      clientMessageId: row.client_message_id,
      messageId: row.message_id.toString(),
      createdAt: row.created_at.toString(),
    };
  }
}
