import { ChatDomainException } from "./chat-domain.exception";

export class InvalidParticipantsException extends ChatDomainException {
  public readonly errorCode = "INVALID_PARTICIPANTS";
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}
