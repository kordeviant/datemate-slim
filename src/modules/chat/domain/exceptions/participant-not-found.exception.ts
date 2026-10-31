import { ChatDomainException } from "./chat-domain.exception";

export class ParticipantNotFoundException extends ChatDomainException {
  public readonly errorCode = "PARTICIPANT_NOT_FOUND";
  public readonly statusCode = 404;

  constructor(userId: number, conversationId: string) {
    super(`User ${userId} is not a participant in group ${conversationId}`);
  }
}
