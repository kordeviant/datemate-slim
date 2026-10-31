import { Injectable } from "@nestjs/common";
import { types as CassandraTypes } from "cassandra-driver";
import { CassandraClientService } from "../cassandra.client";
import { Message } from "../../../domain/entities/message.entity";
import { IMessageRepository } from "../../../domain/repositories/message.repository.interface";

@Injectable()
export class CassandraMessageRepository implements IMessageRepository {
  constructor(private readonly cassandra: CassandraClientService) {}

  public async save(message: Message): Promise<void> {
    const query = `
      INSERT INTO messages_by_conversation (
        conversation_id, bucket, created_at, message_id, sender_id, content, client_message_id,
        message_type, media_url, duration, attachment_name, attachment_size, mime_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      CassandraTypes.Uuid.fromString(message.conversationId),
      message.bucket,
      CassandraTypes.TimeUuid.fromString(message.createdAt),
      CassandraTypes.Uuid.fromString(message.messageId),
      this.cassandra.toLong(message.senderId),
      message.content,
      message.clientMessageId || null,
      message.messageType || null,
      message.mediaUrl || null,
      message.duration !== undefined && message.duration !== null
        ? Number(message.duration)
        : null,
      message.attachmentName || null,
      message.attachmentSize !== undefined && message.attachmentSize !== null
        ? this.cassandra.toLong(message.attachmentSize)
        : null,
      message.mimeType || null,
    ];

    await this.cassandra.getClient().execute(query, params, { prepare: true });
  }

  public async findByBucket(
    conversationId: string,
    bucket: string,
    limit: number,
    pagingState?: string | null,
  ): Promise<{ items: Message[]; nextPagingState: string | null }> {
    const query = `
      SELECT * FROM messages_by_conversation
      WHERE conversation_id = ? AND bucket = ?;
    `;

    const params = [CassandraTypes.Uuid.fromString(conversationId), bucket];

    const options: any = {
      prepare: true,
      fetchSize: limit,
    };
    if (pagingState) {
      options.pageState = Buffer.from(pagingState, "hex");
    }

    const result = await this.cassandra
      .getClient()
      .execute(query, params, options);

    const items: Message[] = (result.rows || []).map(
      (row) =>
        new Message({
          conversationId: row.conversation_id.toString(),
          bucket: row.bucket,
          createdAt: row.created_at.toString(),
          messageId: row.message_id.toString(),
          senderId: this.cassandra.fromLong(row.sender_id),
          content: row.content,
          clientMessageId: row.client_message_id,
          messageType: row.message_type || null,
          mediaUrl: row.media_url || null,
          duration:
            row.duration !== undefined && row.duration !== null
              ? Number(row.duration)
              : null,
          attachmentName: row.attachment_name || null,
          attachmentSize: row.attachment_size
            ? this.cassandra.fromLong(row.attachment_size)
            : null,
          mimeType: row.mime_type || null,
        }),
    );

    const nextPagingState = result.pageState
      ? Buffer.isBuffer(result.pageState)
        ? result.pageState.toString("hex")
        : String(result.pageState)
      : null;

    return { items, nextPagingState };
  }

  public async findById(
    conversationId: string,
    bucket: string,
    createdAt: string,
    messageId: string,
  ): Promise<Message | null> {
    const query = `
      SELECT * FROM messages_by_conversation
      WHERE conversation_id = ? AND bucket = ? AND created_at = ? AND message_id = ?;
    `;

    const params = [
      CassandraTypes.Uuid.fromString(conversationId),
      bucket,
      CassandraTypes.TimeUuid.fromString(createdAt),
      CassandraTypes.Uuid.fromString(messageId),
    ];

    const result = await this.cassandra
      .getClient()
      .execute(query, params, { prepare: true });
    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0];
    return new Message({
      conversationId: row.conversation_id.toString(),
      bucket: row.bucket,
      createdAt: row.created_at.toString(),
      messageId: row.message_id.toString(),
      senderId: this.cassandra.fromLong(row.sender_id),
      content: row.content,
      clientMessageId: row.client_message_id,
      messageType: row.message_type || null,
      mediaUrl: row.media_url || null,
      duration:
        row.duration !== undefined && row.duration !== null
          ? Number(row.duration)
          : null,
      attachmentName: row.attachment_name || null,
      attachmentSize: row.attachment_size
        ? this.cassandra.fromLong(row.attachment_size)
        : null,
      mimeType: row.mime_type || null,
    });
  }
}
