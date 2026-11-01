export interface MessageIdempotencyRecord {
  conversationId: string;
  senderId: number;
  clientMessageId: string;
  messageId: string;
  createdAt: string; // TimeUuid string
}

export interface IMessageIdempotencyRepository {
  /**
   * Registers client message ID with LWT IF NOT EXISTS.
   * Returns applied = true if registered, false if already exists with existing record.
   */
  registerIfNotExists(
    conversationId: string,
    senderId: number,
    clientMessageId: string,
    messageId: string,
    createdAt: string,
  ): Promise<{ applied: boolean; existingRecord?: MessageIdempotencyRecord | null }>;

  find(conversationId: string, senderId: number, clientMessageId: string): Promise<MessageIdempotencyRecord | null>;
}
