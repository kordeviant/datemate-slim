import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { types as CassandraTypes } from "cassandra-driver";
import { ListConversationsQueryDto } from "../dtos/list-conversations.dto";
import {
  IConversationRepository,
  UserConversationProjection,
} from "../../domain/repositories/conversation.repository.interface";
import { IConversationMemberRepository } from "../../domain/repositories/conversation-member.repository.interface";
import { IMessageRepository } from "../../domain/repositories/message.repository.interface";
import { CursorUtil, PageCursorData } from "@common/utils/cursor.util";
import { TimeBucketUtil } from "@common/utils/time-bucket.util";
import { PaginatedResult } from "@common/dtos/pagination.dto";
import {
  ConversationResponseDto,
  GroupConversationResponseDto,
  LastMessageDto,
  RecentMessageDto,
} from "../dtos/conversation-response.dto";
import { ConversationType } from "../../domain/enums/conversation-type.enum";
import { Conversation } from "../../domain/entities/conversation.entity";
import { Message } from "../../domain/entities/message.entity";
import { UserPresenceService } from "../services/user-presence.service";

@Injectable()
export class ListUserConversationsUseCase {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(
    @Inject("IConversationRepository")
    private readonly conversationRepo: IConversationRepository,
    @Inject("IConversationMemberRepository")
    private readonly memberRepo: IConversationMemberRepository,
    @Inject("IMessageRepository")
    private readonly messageRepo: IMessageRepository,
    private readonly configService: ConfigService,
    private readonly presenceService: UserPresenceService,
  ) {
    this.defaultPageSize = this.configService.get<number>("chat.defaultPageSize") || 20;
    this.maxPageSize = this.configService.get<number>("chat.maxPageSize") || 100;
  }

  public async execute(
    userId: number,
    query: ListConversationsQueryDto,
    filterType: ConversationType.GROUP,
  ): Promise<PaginatedResult<GroupConversationResponseDto>>;
  public async execute(
    userId: number,
    query: ListConversationsQueryDto,
    filterType?: ConversationType.DIRECT,
  ): Promise<PaginatedResult<ConversationResponseDto>>;
  public async execute(
    userId: number,
    query: ListConversationsQueryDto,
    filterType?: ConversationType,
  ): Promise<PaginatedResult<ConversationResponseDto | GroupConversationResponseDto>>;
  public async execute(
    userId: number,
    query: ListConversationsQueryDto,
    filterType?: ConversationType,
  ): Promise<PaginatedResult<any>> {
    let limit = query.limit || this.defaultPageSize;
    if (limit > this.maxPageSize) limit = this.maxPageSize;
    if (limit < 1) limit = this.defaultPageSize;

    let pagingState: string | null = null;
    let skipOffset = 0;
    if (query.cursor) {
      const decoded: PageCursorData = CursorUtil.decode(query.cursor);
      pagingState = decoded.pagingState || null;
      skipOffset = typeof decoded.offset === "number" ? decoded.offset : 0;
    }

    let nextCursor: string | null = null;
    let selectedProjections: UserConversationProjection[] = [];

    if (!filterType) {
      const { items: rows, nextPagingState } = await this.conversationRepo.findUserConversations(
        userId,
        limit,
        pagingState,
      );
      selectedProjections = rows;
      if (nextPagingState) {
        nextCursor = CursorUtil.encode({ pagingState: nextPagingState });
      }
    } else {
      const batchSize = Math.min(Math.max(limit * 2, 20), this.maxPageSize);
      let currentPagingState = pagingState;
      let safetyScans = 0;
      const maxScans = 10;

      while (selectedProjections.length < limit && safetyScans < maxScans) {
        safetyScans++;
        const { items: rows, nextPagingState } = await this.conversationRepo.findUserConversations(
          userId,
          batchSize,
          currentPagingState,
        );

        const matchingInBatch = rows.filter((r) => r.conversationType === filterType);
        const availableInBatch = skipOffset > 0 ? matchingInBatch.slice(skipOffset) : matchingInBatch;
        const needed = limit - selectedProjections.length;

        if (availableInBatch.length <= needed) {
          selectedProjections.push(...availableInBatch);
          skipOffset = 0;
          currentPagingState = nextPagingState;
          if (!nextPagingState) {
            nextCursor = null;
            break;
          }
          if (selectedProjections.length === limit) {
            nextCursor = CursorUtil.encode({ pagingState: nextPagingState, offset: 0 });
            break;
          }
        } else {
          selectedProjections.push(...availableInBatch.slice(0, needed));
          const newOffset = (skipOffset || 0) + needed;
          nextCursor = CursorUtil.encode({ pagingState: currentPagingState, offset: newOffset });
          break;
        }
      }
    }

    // Defensive deduplication by conversationId (retaining the most recent activity item)
    const seenConversationIds = new Set<string>();
    const uniqueProjections = selectedProjections.filter((item) => {
      if (seenConversationIds.has(item.conversationId)) return false;
      seenConversationIds.add(item.conversationId);
      return true;
    });

    // Enrich with canonical conversation details, members, and recent messages
    const items: (ConversationResponseDto | GroupConversationResponseDto)[] = await Promise.all(
      uniqueProjections.map(async (row) => {
        const [conv, members] = await Promise.all([
          this.conversationRepo.findById(row.conversationId),
          this.memberRepo.findMembersByConversation(row.conversationId),
        ]);
        const memberIds = members.map((m) => m.userId);

        const hasMessages = Boolean(
          conv?.lastMessageId ||
          conv?.lastMessagePreview ||
          row.lastMessagePreview,
        );

        const recentMessages = hasMessages
          ? await this.getRecentMessages(row.conversationId, conv, row)
          : [];

        let lastMessage: LastMessageDto | null = null;
        if (recentMessages.length > 0) {
          const lastRecent = recentMessages[recentMessages.length - 1];
          lastMessage = {
            messageId: lastRecent.messageId,
            senderId: lastRecent.senderId,
            content: lastRecent.content,
            createdAt: lastRecent.createdAt,
          };
        } else if (conv?.lastMessageId) {
          lastMessage = {
            messageId: conv.lastMessageId,
            senderId: conv.lastMessageSenderId || 0,
            content: conv.lastMessagePreview || "",
            createdAt: this.formatMessageCreatedAt(conv.lastMessageAt || conv.updatedAt || conv.createdAt),
          };
        } else if (row.lastMessagePreview) {
          lastMessage = {
            messageId: "",
            senderId: row.lastMessageSenderId || 0,
            content: row.lastMessagePreview,
            createdAt: this.formatMessageCreatedAt(row.lastMessageAt),
          };
        }

        const convType = conv?.conversationType || (row.conversationType as ConversationType) || ConversationType.DIRECT;

        // Specifically format GET /v1/conversations/group items
        if (filterType === ConversationType.GROUP) {
          const sortedMembers = [...members].sort((a, b) => {
            const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
            const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
            if (timeB !== timeA) {
              return timeB - timeA;
            }
            return b.userId - a.userId;
          });
          const lastUsers = sortedMembers.slice(0, 3).map((m) => m.userId);

          const groupItem: GroupConversationResponseDto = {
            conversationId: row.conversationId,
            type: ConversationType.GROUP,
            createdBy: conv ? conv.createdBy : 0,
            createdAt: conv?.createdAt
              ? (conv.createdAt instanceof Date ? conv.createdAt.toISOString() : new Date(conv.createdAt).toISOString())
              : "",
            title: conv ? (conv.title ?? null) : (row.title ?? null),
            membersCount: members.length,
            lastUsers,
            lastMessage,
            recentMessages,
          };
          return groupItem;
        }

        const isGroup = convType === ConversationType.GROUP;
        let membersCount: number | undefined;
        let lastUsers: number[] | undefined;
        if (isGroup) {
          const sortedMembers = [...members].sort((a, b) => {
            const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
            const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
            if (timeB !== timeA) {
              return timeB - timeA;
            }
            return b.userId - a.userId;
          });
          membersCount = members.length;
          lastUsers = sortedMembers.slice(0, 3).map((m) => m.userId);
        }

        return {
          conversationId: row.conversationId,
          type: convType,
          createdBy: conv ? conv.createdBy : 0,
          createdAt: conv?.createdAt
            ? (conv.createdAt instanceof Date ? conv.createdAt.toISOString() : new Date(conv.createdAt).toISOString())
            : "",
          title: conv ? (conv.title ?? null) : (row.title ?? null),
          memberIds,
          lastMessage,
          recentMessages,
          ...(isGroup ? { membersCount, lastUsers } : {}),
        };
      }),
    );

    // High performance batch fetch peer activity for direct conversations
    const peerUserIds: number[] = [];
    for (const item of items) {
      if (item.type === ConversationType.DIRECT) {
        const convItem = item as ConversationResponseDto;
        const peerId = convItem.memberIds?.find((id) => id !== userId);
        if (peerId) {
          peerUserIds.push(peerId);
        }
      }
    }

    if (peerUserIds.length > 0) {
      const presenceMap = await this.presenceService.getUserActivityBatch(peerUserIds);
      for (const item of items) {
        if (item.type === ConversationType.DIRECT) {
          const convItem = item as ConversationResponseDto;
          const peerId = convItem.memberIds?.find((id) => id !== userId);
          convItem.peerActivity = peerId ? (presenceMap.get(peerId) || null) : null;
        }
      }
    }

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }

  private async getRecentMessages(
    conversationId: string,
    conv?: Conversation | null,
    projection?: UserConversationProjection,
  ): Promise<RecentMessageDto[]> {
    if (!this.messageRepo) {
      return [];
    }

    let currentBucket: string | null = null;
    const lastMsgAt = conv?.lastMessageAt || projection?.lastMessageAt;
    if (lastMsgAt) {
      try {
        const parsedTimeUuid = CassandraTypes.TimeUuid.fromString(lastMsgAt);
        currentBucket = TimeBucketUtil.getBucket(parsedTimeUuid.getDate());
      } catch {
        const d = new Date(lastMsgAt);
        if (!isNaN(d.getTime())) {
          currentBucket = TimeBucketUtil.getBucket(d);
        }
      }
    }

    if (!currentBucket) {
      currentBucket = TimeBucketUtil.getBucket();
    }

    let oldestBucket: string | null = null;
    if (conv?.createdAt) {
      oldestBucket = TimeBucketUtil.getBucket(
        conv.createdAt instanceof Date ? conv.createdAt : new Date(conv.createdAt),
      );
    }

    const collectedMessages: Message[] = [];
    let currentPagingState: string | null = null;
    let safetyCounter = 0;
    const maxDayScans = 30;
    const limit = 20;

    while (collectedMessages.length < limit && safetyCounter < maxDayScans && currentBucket) {
      safetyCounter++;
      const needed = limit - collectedMessages.length;

      const pageResult = await this.messageRepo.findByBucket(
        conversationId,
        currentBucket,
        needed,
        currentPagingState,
      );

      collectedMessages.push(...pageResult.items);

      if (pageResult.nextPagingState && collectedMessages.length < limit) {
        currentPagingState = pageResult.nextPagingState;
      } else {
        currentPagingState = null;
        const prevBucket = TimeBucketUtil.getPreviousBucket(currentBucket);

        if (oldestBucket && TimeBucketUtil.isBucketOlderThan(prevBucket, oldestBucket)) {
          currentBucket = null;
        } else {
          currentBucket = prevBucket;
        }
      }
    }

    return collectedMessages
      .reverse()
      .map((msg) => ({
        messageId: msg.messageId,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: this.formatMessageCreatedAt(msg.createdAt),
      }));
  }

  private formatMessageCreatedAt(val: any): string {
    if (!val) return new Date().toISOString();
    if (val instanceof Date) return val.toISOString();
    if (typeof val === "string") {
      if (val.includes("T") || val.endsWith("Z")) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      try {
        const parsedUuid = CassandraTypes.TimeUuid.fromString(val);
        return parsedUuid.getDate().toISOString();
      } catch {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString();
        return val;
      }
    }
    if (typeof val.getDate === "function") {
      return val.getDate().toISOString();
    }
    return String(val);
  }
}
