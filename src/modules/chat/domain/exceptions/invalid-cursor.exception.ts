import { ChatDomainException } from "./chat-domain.exception";

export class InvalidCursorException extends ChatDomainException {
  public readonly errorCode = "INVALID_CURSOR";
  public readonly statusCode = 400;

  constructor(message = "Malformed or invalid pagination cursor") {
    super(message);
  }
}
