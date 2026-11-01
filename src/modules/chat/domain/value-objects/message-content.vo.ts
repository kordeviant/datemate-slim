import { ChatDomainException } from "../exceptions/chat-domain.exception";

export class InvalidMessageContentException extends ChatDomainException {
  public readonly errorCode = "INVALID_MESSAGE_CONTENT";
  public readonly statusCode = 400;
  constructor(msg: string) {
    super(msg);
  }
}

export class MessageContent {
  private readonly _value: string;

  constructor(
    rawContent?: string | null,
    maxLength = 4000,
    allowEmpty = false,
  ) {
    if (
      rawContent === undefined ||
      rawContent === null ||
      typeof rawContent !== "string"
    ) {
      if (allowEmpty) {
        this._value = "";
        return;
      }
      throw new InvalidMessageContentException(
        "Message content cannot be empty",
      );
    }
    const trimmed = rawContent.trim();
    if (trimmed.length === 0) {
      if (allowEmpty) {
        this._value = "";
        return;
      }
      throw new InvalidMessageContentException(
        "Message content cannot be empty or whitespace only",
      );
    }
    if (trimmed.length > maxLength) {
      throw new InvalidMessageContentException(
        `Message content exceeds maximum allowed length of ${maxLength} characters`,
      );
    }
    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }
}
