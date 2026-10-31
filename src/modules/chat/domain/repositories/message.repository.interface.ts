import { Message } from "../entities/message.entity";

export interface IMessageRepository {
  save(message: Message): Promise<void>;
  findByBucket(
    conversationId: string,
    bucket: string,
    limit: number,
    pagingState?: string | null,
  ): Promise<{ items: Message[]; nextPagingState: string | null }>;
  findById(conversationId: string, bucket: string, createdAt: string, messageId: string): Promise<Message | null>;
}
