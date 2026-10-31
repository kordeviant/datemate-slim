import { ChatDomainException } from "./chat-domain.exception";

export class SelfConversationNotAllowedException extends ChatDomainException {
  public readonly errorCode = "SELF_CONVERSATION_NOT_ALLOWED";
  public readonly statusCode = 400;

  constructor() {
    super("Users cannot create a conversation with themselves");
  }
}
