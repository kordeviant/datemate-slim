import { ChatDomainException } from "./chat-domain.exception";

export class ConversationForbiddenException extends ChatDomainException {
  public readonly errorCode = "FORBIDDEN";
  public readonly statusCode = 403;

  constructor(message = "You are not an authorized member of this conversation") {
    super(message);
  }
}
