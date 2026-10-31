import { Injectable, Inject } from "@nestjs/common";
import { IConversationRepository } from "../../domain/repositories/conversation.repository.interface";
import { IConversationMemberRepository } from "../../domain/repositories/conversation-member.repository.interface";
import { ChatAuthorizationService } from "../services/chat-authorization.service";
import { UserPresenceService } from "../services/user-presence.service";
import { ConversationResponseDto } from "../dtos/conversation-response.dto";
import { ConversationNotFoundException } from "../../domain/exceptions/conversation-not-found.exception";
import { ConversationType } from "../../domain/enums/conversation-type.enum";

@Injectable()
export class GetConversationDetailsUseCase {
  constructor(
    @Inject("IConversationRepository")
    private readonly conversationRepo: IConversationRepository,
    @Inject("IConversationMemberRepository")
    private readonly memberRepo: IConversationMemberRepository,
    private readonly authService: ChatAuthorizationService,
    private readonly presenceService: UserPresenceService,
  ) {}

  public async execute(conversationId: string, userId: number): Promise<ConversationResponseDto> {
    // 1. Authorize: verifies membership (throws 404 if not found, 403 if not member)
    await this.authService.assertMembership(conversationId, userId);

    // 2. Fetch conversation
    const conv = await this.conversationRepo.findById(conversationId);
    if (!conv) {
      throw new ConversationNotFoundException(conversationId);
    }

    // 3. Fetch members
    const members = await this.memberRepo.findMembersByConversation(conversationId);
    const memberIds = members.map((m) => m.userId);

    // 4. Batch fetch presence for all members
    const presenceMap = await this.presenceService.getUserActivityBatch(memberIds);
    const membersActivity = Array.from(presenceMap.values());

    const peerId = conv.conversationType === ConversationType.DIRECT
      ? memberIds.find((id) => id !== userId) || null
      : null;
    const peerActivity = peerId ? (presenceMap.get(peerId) || null) : null;

    const lastMessage = conv.lastMessageId
      ? {
          messageId: conv.lastMessageId,
          senderId: conv.lastMessageSenderId || 0,
          content: conv.lastMessagePreview || "",
          createdAt: conv.updatedAt ? conv.updatedAt.toISOString() : conv.createdAt.toISOString(),
        }
      : null;

    return {
      conversationId: conv.conversationId,
      type: conv.conversationType,
      createdBy: conv.createdBy,
      createdAt: conv.createdAt.toISOString(),
      title: conv.title || null,
      memberIds,
      lastMessage,
      peerActivity,
      membersActivity,
    };
  }
}
