import { Conversation } from "../entities/conversation.entity";

export interface UserConversationProjection {
  userId: number;
  lastMessageAt: string;
  conversationId: string;
  conversationType: string;
  lastMessagePreview?: string | null;
  lastMessageSenderId?: number | null;
  title?: string | null;
}

export interface IConversationRepository {
  create(conversation: Conversation): Promise<void>;
  findById(conversationId: string): Promise<Conversation | null>;
  updateMetadata(
    conversationId: string,
    lastMessageAt: string,
    lastMessageId: string,
    lastMessageSenderId: number,
    lastMessagePreview: string,
    updatedAt: Date,
    expectedPreviousLastMessageAt?: string | null,
  ): Promise<boolean>;
  findUserConversations(
    userId: number,
    limit: number,
    pagingState?: string | null,
  ): Promise<{ items: UserConversationProjection[]; nextPagingState: string | null }>;
  upsertUserConversationProjection(
    projection: UserConversationProjection,
    oldLastMessageAt?: string | null,
  ): Promise<void>;
}
