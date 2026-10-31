import { ChatDomainException } from "./chat-domain.exception";

export class ConversationNotFoundException extends ChatDomainException {
  public readonly errorCode = "CONVERSATION_NOT_FOUND";
  public readonly statusCode = 404;

  constructor(conversationId: string) {
    super(`Conversation with ID ${conversationId} was not found`);
  }
}
