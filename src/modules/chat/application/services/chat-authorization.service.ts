import { Injectable, Inject } from "@nestjs/common";
import { IConversationMemberRepository } from "../../domain/repositories/conversation-member.repository.interface";
import { IConversationRepository } from "../../domain/repositories/conversation.repository.interface";
import { ConversationNotFoundException } from "../../domain/exceptions/conversation-not-found.exception";
import { ConversationForbiddenException } from "../../domain/exceptions/conversation-forbidden.exception";

@Injectable()
export class ChatAuthorizationService {
  constructor(
    @Inject("IConversationRepository")
    private readonly conversationRepo: IConversationRepository,
    @Inject("IConversationMemberRepository")
    private readonly memberRepo: IConversationMemberRepository,
  ) {}

  public async assertMembership(conversationId: string, userId: number): Promise<void> {
    const isMember = await this.memberRepo.isMember(conversationId, userId);
    if (!isMember) {
      // Check if conversation even exists
      const conv = await this.conversationRepo.findById(conversationId);
      if (!conv) {
        throw new ConversationNotFoundException(conversationId);
      }
      throw new ConversationForbiddenException();
    }
  }

  public async isMember(conversationId: string, userId: number): Promise<boolean> {
    return this.memberRepo.isMember(conversationId, userId);
  }
}
