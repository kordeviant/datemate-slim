import { Injectable, Inject, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import { types as CassandraTypes } from "cassandra-driver";
import {
  SendMessageWsDto,
  MessageAttachmentDto,
} from "../dtos/send-message.dto";
import { MessageItemDto } from "../dtos/get-messages.dto";
import { IMessageRepository } from "../../domain/repositories/message.repository.interface";
import { IConversationRepository } from "../../domain/repositories/conversation.repository.interface";
import { IConversationMemberRepository } from "../../domain/repositories/conversation-member.repository.interface";
import { IMessageIdempotencyRepository } from "../../domain/repositories/message-idempotency.repository.interface";
import { ChatAuthorizationService } from "../services/chat-authorization.service";
import { MessageContent } from "../../domain/value-objects/message-content.vo";
import { TimeBucketUtil } from "@common/utils/time-bucket.util";
import { Message } from "../../domain/entities/message.entity";
import {
  MessageType,
  normalizeMessageType,
} from "../../domain/enums/message-type.enum";
import { ConversationNotFoundException } from "../../domain/exceptions/conversation-not-found.exception";
import { PushNotificationService } from "../../infrastructure/push-notification/push-notification.service";

export interface SendMessageResult {
  message: MessageItemDto;
  recipientUserIds: number[];
  isDuplicate: boolean;
}

@Injectable()
export class SendMessageUseCase {
  private readonly maxMessageLength: number;

  constructor(
    @Inject("IMessageRepository")
    private readonly messageRepo: IMessageRepository,
    @Inject("IConversationRepository")
    private readonly conversationRepo: IConversationRepository,
    @Inject("IConversationMemberRepository")
    private readonly memberRepo: IConversationMemberRepository,
    @Inject("IMessageIdempotencyRepository")
    private readonly idempotencyRepo: IMessageIdempotencyRepository,
    private readonly authService: ChatAuthorizationService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly pushNotificationService?: PushNotificationService,
  ) {
    this.maxMessageLength =
      this.configService.get<number>("chat.maxMessageLength") || 4000;
  }

  public async execute(
    senderId: number,
    dto: SendMessageWsDto,
    senderName?: string,
  ): Promise<SendMessageResult> {
    const { conversationId, clientMessageId, content: rawContent } = dto;

    // 1. Authorize: sender must be a member
    await this.authService.assertMembership(conversationId, senderId);

    // 2. Resolve media attachment and type
    const mediaUrl = dto.url || dto.attachment?.url || null;
    const hasAttachment = !!mediaUrl;

    // Content is required only if no attachment is provided
    const contentVo = new MessageContent(
      rawContent,
      this.maxMessageLength,
      hasAttachment,
    );
    const content = contentVo.value;

    const rawType = dto.type || dto.attachment?.type;
    let messageType = normalizeMessageType(rawType);
    if (!rawType && hasAttachment) {
      messageType = MessageType.FILE;
    }

    let duration: number | null = null;
    if (dto.duration !== undefined && dto.duration !== null) {
      duration = Number(dto.duration);
    } else if (
      dto.attachment?.duration !== undefined &&
      dto.attachment?.duration !== null
    ) {
      duration = Number(dto.attachment.duration);
    }

    if (duration !== null && !rawType) {
      messageType = MessageType.VOICE;
    }

    const attachmentName = dto.attachment?.fileName || null;
    const attachmentSize =
      dto.attachment?.fileSize !== undefined &&
      dto.attachment?.fileSize !== null
        ? Number(dto.attachment.fileSize)
        : null;
    const mimeType = dto.attachment?.mimeType || null;

    const attachmentDto: MessageAttachmentDto | null = mediaUrl
      ? {
          url: mediaUrl,
          type: messageType,
          duration,
          fileName: attachmentName,
          fileSize: attachmentSize,
          mimeType,
        }
      : null;

    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) {
      throw new ConversationNotFoundException(conversationId);
    }

    const members =
      await this.memberRepo.findMembersByConversation(conversationId);
    const recipientUserIds = members.map((m) => m.userId);

    // 3. Generate server-side TimeUuid and messageId
    const serverTimeUuid = CassandraTypes.TimeUuid.now();
    const timeUuidString = serverTimeUuid.toString();
    const generatedMessageId = uuidv4();

    // 4. Check & enforce idempotency using clientMessageId via LWT
    const lwtResult = await this.idempotencyRepo.registerIfNotExists(
      conversationId,
      senderId,
      clientMessageId,
      generatedMessageId,
      timeUuidString,
    );

    if (!lwtResult.applied && lwtResult.existingRecord) {
      // Existing message detected!
      const existing = lwtResult.existingRecord;
      return {
        message: {
          messageId: existing.messageId,
          conversationId: existing.conversationId,
          senderId: existing.senderId,
          content,
          createdAt: existing.createdAt,
          clientMessageId,
          type: messageType,
          url: mediaUrl,
          duration,
          attachment: attachmentDto,
        },
        recipientUserIds,
        isDuplicate: true,
      };
    }

    // 5. Winning persistence flow:
    // Derive bucket from server TimeUuid
    const bucket = TimeBucketUtil.getBucketFromTimeUuid(serverTimeUuid);

    const messageEntity = new Message({
      conversationId,
      bucket,
      createdAt: timeUuidString,
      messageId: generatedMessageId,
      senderId,
      content,
      clientMessageId,
      messageType,
      mediaUrl,
      duration,
      attachmentName,
      attachmentSize,
      mimeType,
    });

    // 5a. Persist to Cassandra messages_by_conversation
    await this.messageRepo.save(messageEntity);

    // 5b. Update canonical conversation metadata with descriptive preview
    let preview = content;
    if (!preview || preview.trim().length === 0) {
      switch (messageType) {
        case MessageType.VOICE:
          preview = duration
            ? `🎤 Voice message (${Math.round(duration)}s)`
            : "🎤 Voice message";
          break;
        case MessageType.IMAGE:
          preview = "📷 Photo";
          break;
        case MessageType.VIDEO:
          preview = "🎥 Video";
          break;
        case MessageType.FILE:
          preview = attachmentName ? `📎 ${attachmentName}` : "📎 Attachment";
          break;
        default:
          preview = "";
          break;
      }
    } else {
      switch (messageType) {
        case MessageType.VOICE:
          preview = `🎤 ${preview}`;
          break;
        case MessageType.IMAGE:
          preview = `📷 ${preview}`;
          break;
        case MessageType.VIDEO:
          preview = `🎥 ${preview}`;
          break;
        case MessageType.FILE:
          preview = `📎 ${preview}`;
          break;
      }
    }

    const truncatedPreview =
      preview.length > 100 ? preview.substring(0, 97) + "..." : preview;
    const now = new Date();
    await this.conversationRepo.updateMetadata(
      conversationId,
      timeUuidString,
      generatedMessageId,
      senderId,
      truncatedPreview,
      now,
      conv.lastMessageAt,
    );

    // 5c. Update conversations_by_user projections for all conversation members
    const oldLastMessageAt = conv.lastMessageAt;
    const updateProjections = recipientUserIds.map((memberUserId) =>
      this.conversationRepo.upsertUserConversationProjection(
        {
          userId: memberUserId,
          lastMessageAt: timeUuidString,
          conversationId,
          conversationType: conv.conversationType,
          lastMessagePreview: truncatedPreview,
          lastMessageSenderId: senderId,
          title: conv.title || null,
        },
        oldLastMessageAt,
      ),
    );

    await Promise.all(updateProjections);

    // 5d. Dispatch push notifications to target user(s) (recipient members except sender)
    if (this.pushNotificationService) {
      const resolvedTitle =
        dto.title || dto.senderName || senderName || conv.title || undefined;

      const pushNotificationContent =
        content ||
        (messageType === MessageType.VOICE
          ? "Sent a voice message"
          : messageType === MessageType.IMAGE
            ? "Sent a photo"
            : messageType === MessageType.VIDEO
              ? "Sent a video"
              : messageType === MessageType.FILE
                ? "Sent an attachment"
                : "New message");

      await this.pushNotificationService.notifyNewMessage({
        targetUserIds: recipientUserIds,
        senderId,
        senderName: dto.senderName || senderName,
        conversationTitle: conv.title || undefined,
        conversationId,
        content: pushNotificationContent,
        customTitle: resolvedTitle,
      });
    }

    return {
      message: {
        messageId: generatedMessageId,
        conversationId,
        senderId,
        content,
        createdAt: timeUuidString,
        clientMessageId,
        type: messageType,
        url: mediaUrl,
        duration,
        attachment: attachmentDto,
      },
      recipientUserIds,
      isDuplicate: false,
    };
  }
}
