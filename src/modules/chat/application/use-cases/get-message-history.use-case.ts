import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetMessagesQueryDto, MessageItemDto } from "../dtos/get-messages.dto";
import { PaginatedResult } from "@common/dtos/pagination.dto";
import { IMessageRepository } from "../../domain/repositories/message.repository.interface";
import { IConversationRepository } from "../../domain/repositories/conversation.repository.interface";
import { ChatAuthorizationService } from "../services/chat-authorization.service";
import { ConversationNotFoundException } from "../../domain/exceptions/conversation-not-found.exception";
import { TimeBucketUtil } from "@common/utils/time-bucket.util";
import { CursorUtil, PageCursorData } from "@common/utils/cursor.util";
import { Message } from "../../domain/entities/message.entity";

@Injectable()
export class GetMessageHistoryUseCase {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(
    @Inject("IMessageRepository")
    private readonly messageRepo: IMessageRepository,
    @Inject("IConversationRepository")
    private readonly conversationRepo: IConversationRepository,
    private readonly authService: ChatAuthorizationService,
    private readonly configService: ConfigService,
  ) {
    this.defaultPageSize =
      this.configService.get<number>("chat.defaultPageSize") || 50;
    this.maxPageSize =
      this.configService.get<number>("chat.maxPageSize") || 100;
  }

  public async execute(
    conversationId: string,
    userId: number,
    query: GetMessagesQueryDto,
  ): Promise<PaginatedResult<MessageItemDto>> {
    // 1. Authorization: check user is member
    await this.authService.assertMembership(conversationId, userId);

    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) {
      throw new ConversationNotFoundException(conversationId);
    }

    let limit = query.limit || this.defaultPageSize;
    if (limit > this.maxPageSize) limit = this.maxPageSize;
    if (limit < 1) limit = this.defaultPageSize;

    const conversationCreationBucket = TimeBucketUtil.getBucket(conv.createdAt);

    let currentBucket = TimeBucketUtil.getBucket();
    let currentPagingState: string | null = null;
    let oldestBucket = conversationCreationBucket;

    if (query.cursor) {
      const decoded: PageCursorData = CursorUtil.decode(query.cursor);
      if (decoded.bucket) currentBucket = decoded.bucket;
      if (decoded.pagingState) currentPagingState = decoded.pagingState;
      if (decoded.minBucket) oldestBucket = decoded.minBucket;
    }

    const collectedMessages: Message[] = [];
    let nextPagingState: string | null = null;
    let nextBucketToQuery: string | null = currentBucket;
    let hasMore = false;

    // Traverse buckets until we collect limit messages or run out of buckets
    let safetyCounter = 0;
    const maxDayScans = 30; // Max days to scan back in a single query pass without finding messages

    while (
      collectedMessages.length < limit &&
      safetyCounter < maxDayScans &&
      nextBucketToQuery
    ) {
      safetyCounter++;
      const needed = limit - collectedMessages.length;

      const pageResult = await this.messageRepo.findByBucket(
        conversationId,
        nextBucketToQuery,
        needed,
        currentPagingState,
      );

      collectedMessages.push(...pageResult.items);

      if (pageResult.nextPagingState) {
        // Cassandra still has rows in this current bucket
        nextPagingState = pageResult.nextPagingState;
        hasMore = true;
        break;
      } else {
        // Bucket is exhausted; move to previous day bucket
        const prevBucket = TimeBucketUtil.getPreviousBucket(nextBucketToQuery);
        currentPagingState = null;

        if (TimeBucketUtil.isBucketOlderThan(prevBucket, oldestBucket)) {
          // Reached before conversation creation
          nextBucketToQuery = null;
          hasMore = false;
          break;
        } else {
          nextBucketToQuery = prevBucket;
          hasMore = true;
        }
      }
    }

    let nextCursor: string | null = null;
    if (hasMore && nextBucketToQuery) {
      nextCursor = CursorUtil.encode({
        bucket: nextBucketToQuery,
        pagingState: nextPagingState,
        minBucket: oldestBucket,
      });
    }

    const items: MessageItemDto[] = collectedMessages.map((msg) => ({
      messageId: msg.messageId,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt, // TimeUuid or ISO string representation
      clientMessageId: msg.clientMessageId || null,
      type: msg.messageType,
      url: msg.mediaUrl,
      duration: msg.duration,
      attachment: msg.attachment,
    }));

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }
}
