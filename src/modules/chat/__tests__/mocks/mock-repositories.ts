import { Conversation } from "../../domain/entities/conversation.entity";
import { ConversationMember } from "../../domain/entities/conversation-member.entity";
import { Message } from "../../domain/entities/message.entity";
import { DirectPair } from "../../domain/entities/direct-pair.entity";
import {
  IConversationRepository,
  UserConversationProjection,
} from "../../domain/repositories/conversation.repository.interface";
import { IConversationMemberRepository } from "../../domain/repositories/conversation-member.repository.interface";
import { IMessageRepository } from "../../domain/repositories/message.repository.interface";
import { IDirectPairRepository } from "../../domain/repositories/direct-pair.repository.interface";
import {
  IMessageIdempotencyRepository,
  MessageIdempotencyRecord,
} from "../../domain/repositories/message-idempotency.repository.interface";
import { IGroupRepository } from "../../domain/repositories/group.repository.interface";
import { GroupProfile } from "../../domain/entities/group-profile.entity";
import { GroupRelationship } from "../../domain/entities/group-relationship.entity";
import { CursorUtil } from "@common/utils/cursor.util";
import { InvalidCursorException } from "../../domain/exceptions/invalid-cursor.exception";

export class MockConversationRepository implements IConversationRepository {
  public conversations: Map<string, Conversation> = new Map();
  public userProjections: Map<number, UserConversationProjection[]> = new Map();

  async create(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.conversationId, conversation);
  }

  async findById(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) || null;
  }

  async updateMetadata(
    conversationId: string,
    lastMessageAt: string,
    lastMessageId: string,
    lastMessageSenderId: number,
    lastMessagePreview: string,
    updatedAt: Date,
    expectedPreviousLastMessageAt?: string | null,
  ): Promise<boolean> {
    const conv = this.conversations.get(conversationId);
    if (!conv) return false;

    // Reject update if an older message tries to overwrite newer metadata
    if (conv.lastMessageAt && conv.lastMessageAt > lastMessageAt) {
      return false;
    }

    conv.updateLastMessage(lastMessageAt, lastMessageId, lastMessageSenderId, lastMessagePreview, updatedAt);
    return true;
  }

  async findUserConversations(
    userId: number,
    limit: number,
    pagingState?: string | null,
  ): Promise<{ items: UserConversationProjection[]; nextPagingState: string | null }> {
    const list = this.userProjections.get(userId) || [];
    // Sort by lastMessageAt DESC
    const sorted = [...list].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

    const offset = pagingState ? parseInt(pagingState, 10) : 0;
    const items = sorted.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const nextPagingState = nextOffset < sorted.length ? String(nextOffset) : null;

    return { items, nextPagingState };
  }

  async upsertUserConversationProjection(
    projection: UserConversationProjection,
    oldLastMessageAt?: string | null,
  ): Promise<void> {
    const list = this.userProjections.get(projection.userId) || [];
    // Remove old projection row if present
    const filtered = list.filter(
      (p) => !(p.conversationId === projection.conversationId && (oldLastMessageAt ? p.lastMessageAt === oldLastMessageAt : true)),
    );
    filtered.push(projection);
    this.userProjections.set(projection.userId, filtered);
  }
}

export class MockConversationMemberRepository implements IConversationMemberRepository {
  public members: Map<string, ConversationMember[]> = new Map();

  async addMember(member: ConversationMember): Promise<void> {
    const list = this.members.get(member.conversationId) || [];
    // Avoid duplicate member
    if (!list.some((m) => m.userId === member.userId)) {
      list.push(member);
    }
    this.members.set(member.conversationId, list);
  }

  async addMembers(members: ConversationMember[]): Promise<void> {
    for (const m of members) {
      await this.addMember(m);
    }
  }

  async findMembersByConversation(conversationId: string): Promise<ConversationMember[]> {
    return this.members.get(conversationId) || [];
  }

  async isMember(conversationId: string, userId: number): Promise<boolean> {
    const list = this.members.get(conversationId) || [];
    return list.some((m) => m.userId === userId);
  }

  async findMember(conversationId: string, userId: number): Promise<ConversationMember | null> {
    const list = this.members.get(conversationId) || [];
    return list.find((m) => m.userId === userId) || null;
  }

  async removeMember(conversationId: string, userId: number): Promise<void> {
    const list = this.members.get(conversationId) || [];
    this.members.set(conversationId, list.filter((member) => member.userId !== userId));
  }
}

export class MockMessageRepository implements IMessageRepository {
  public messages: Message[] = [];

  async save(message: Message): Promise<void> {
    this.messages.push(message);
  }

  async findByBucket(
    conversationId: string,
    bucket: string,
    limit: number,
    pagingState?: string | null,
  ): Promise<{ items: Message[]; nextPagingState: string | null }> {
    const filtered = this.messages.filter(
      (m) => m.conversationId === conversationId && m.bucket === bucket,
    );
    // Sort created_at DESC
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = pagingState ? parseInt(pagingState, 10) : 0;
    const items = filtered.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const nextPagingState = nextOffset < filtered.length ? String(nextOffset) : null;

    return { items, nextPagingState };
  }

  async findById(
    conversationId: string,
    bucket: string,
    createdAt: string,
    messageId: string,
  ): Promise<Message | null> {
    return (
      this.messages.find(
        (m) =>
          m.conversationId === conversationId &&
          m.bucket === bucket &&
          m.createdAt === createdAt &&
          m.messageId === messageId,
      ) || null
    );
  }
}

export class MockDirectPairRepository implements IDirectPairRepository {
  public pairs: Map<string, DirectPair> = new Map();

  async createIfNotExists(
    canonicalPairKey: string,
    conversationId: string,
    createdAt: Date,
  ): Promise<{ applied: boolean; conversationId: string }> {
    if (this.pairs.has(canonicalPairKey)) {
      return {
        applied: false,
        conversationId: this.pairs.get(canonicalPairKey)!.conversationId,
      };
    }
    const pair = new DirectPair({ canonicalPairKey, conversationId, createdAt });
    this.pairs.set(canonicalPairKey, pair);
    return { applied: true, conversationId };
  }

  async findByPairKey(canonicalPairKey: string): Promise<DirectPair | null> {
    return this.pairs.get(canonicalPairKey) || null;
  }
}

export class MockMessageIdempotencyRepository implements IMessageIdempotencyRepository {
  public records: Map<string, MessageIdempotencyRecord> = new Map();

  private key(conversationId: string, senderId: number, clientMessageId: string): string {
    return `${conversationId}:${senderId}:${clientMessageId}`;
  }

  async registerIfNotExists(
    conversationId: string,
    senderId: number,
    clientMessageId: string,
    messageId: string,
    createdAt: string,
  ): Promise<{ applied: boolean; existingRecord?: MessageIdempotencyRecord | null }> {
    const k = this.key(conversationId, senderId, clientMessageId);
    if (this.records.has(k)) {
      return { applied: false, existingRecord: this.records.get(k) };
    }
    const rec: MessageIdempotencyRecord = {
      conversationId,
      senderId,
      clientMessageId,
      messageId,
      createdAt,
    };
    this.records.set(k, rec);
    return { applied: true };
  }

  async find(
    conversationId: string,
    senderId: number,
    clientMessageId: string,
  ): Promise<MessageIdempotencyRecord | null> {
    const k = this.key(conversationId, senderId, clientMessageId);
    return this.records.get(k) || null;
  }
}

export class MockGroupRepository implements IGroupRepository {
  public profiles = new Map<string, GroupProfile>();
  public relationships = new Map<string, GroupRelationship>();
  private key(conversationId: string, userId: number): string { return `${conversationId}:${userId}`; }
  async createProfile(profile: GroupProfile): Promise<void> { this.profiles.set(profile.conversationId, profile); }
  async findProfile(conversationId: string): Promise<GroupProfile | null> { return this.profiles.get(conversationId) || null; }
  async updateProfile(profile: GroupProfile): Promise<void> { this.profiles.set(profile.conversationId, profile); }
  async findRelationship(conversationId: string, userId: number): Promise<GroupRelationship | null> {
    return this.relationships.get(this.key(conversationId, userId)) || null;
  }
  async createRelationshipIfAbsent(relationship: GroupRelationship): Promise<{ applied: boolean; existing?: GroupRelationship | null }> {
    const key = this.key(relationship.conversationId, relationship.userId); const existing = this.relationships.get(key);
    if (existing) return { applied: false, existing };
    this.relationships.set(key, relationship); return { applied: true };
  }
  async upsertRelationship(relationship: GroupRelationship): Promise<void> {
    this.relationships.set(this.key(relationship.conversationId, relationship.userId), relationship);
  }
  async transitionRelationship(relationship: GroupRelationship, expectedStatus: string): Promise<boolean> {
    const key = this.key(relationship.conversationId, relationship.userId);
    const current = this.relationships.get(key);
    if (!current || current.status !== expectedStatus) return false;
    this.relationships.set(key, relationship);
    return true;
  }
  async listRelationships(
    conversationId: string,
    status: string,
    limit: number,
    cursor?: string | null,
  ): Promise<{ items: GroupRelationship[]; nextCursor: string | null }> {
    const all = Array.from(this.relationships.values()).filter(
      (r) => r.conversationId === conversationId && r.status === status,
    );
    let offset = 0;
    if (cursor) {
      try {
        const decoded = CursorUtil.decode(cursor);
        offset = typeof decoded.offset === "number" ? decoded.offset : 0;
      } catch {
        throw new InvalidCursorException();
      }
    }
    const pageItems = all.slice(offset, offset + limit);
    const nextOffset = offset + pageItems.length;
    const nextCursor = nextOffset < all.length ? CursorUtil.encode({ offset: nextOffset }) : null;
    return { items: pageItems, nextCursor };
  }
}

export class MockUserPresenceRepository {
  public records: Map<number, { userId: number; isOnline: boolean; lastSeenAt: Date | null }> = new Map();

  async upsertPresence(userId: number, isOnline: boolean, lastSeenAt: Date): Promise<void> {
    this.records.set(userId, { userId, isOnline, lastSeenAt });
  }

  async findById(userId: number): Promise<{ userId: number; isOnline: boolean; lastSeenAt: Date | null } | null> {
    return this.records.get(userId) || null;
  }

  async findBatch(userIds: number[]): Promise<Map<number, { userId: number; isOnline: boolean; lastSeenAt: Date | null }>> {
    const map = new Map<number, { userId: number; isOnline: boolean; lastSeenAt: Date | null }>();
    for (const id of userIds) {
      const rec = this.records.get(id);
      if (rec) map.set(id, rec);
    }
    return map;
  }
}

