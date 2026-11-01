import { MessageType, normalizeMessageType } from "../enums/message-type.enum";

export interface MessageAttachment {
  url: string;
  type: MessageType;
  duration?: number | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
}

export interface MessageProps {
  conversationId: string;
  bucket: string;
  createdAt: string; // TimeUuid string
  messageId: string; // Uuid string
  senderId: number;
  content: string;
  clientMessageId?: string | null;
  messageType?: MessageType | string | null;
  mediaUrl?: string | null;
  duration?: number | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  mimeType?: string | null;
}

export class Message {
  constructor(private readonly props: MessageProps) {}

  get conversationId(): string {
    return this.props.conversationId;
  }

  get bucket(): string {
    return this.props.bucket;
  }

  get createdAt(): string {
    return this.props.createdAt;
  }

  get messageId(): string {
    return this.props.messageId;
  }

  get senderId(): number {
    return this.props.senderId;
  }

  get content(): string {
    return this.props.content;
  }

  get clientMessageId(): string | null | undefined {
    return this.props.clientMessageId;
  }

  get messageType(): MessageType {
    return normalizeMessageType(this.props.messageType);
  }

  get mediaUrl(): string | null {
    return this.props.mediaUrl || null;
  }

  get duration(): number | null {
    return this.props.duration !== undefined && this.props.duration !== null
      ? Number(this.props.duration)
      : null;
  }

  get attachmentName(): string | null {
    return this.props.attachmentName || null;
  }

  get attachmentSize(): number | null {
    return this.props.attachmentSize !== undefined &&
      this.props.attachmentSize !== null
      ? Number(this.props.attachmentSize)
      : null;
  }

  get mimeType(): string | null {
    return this.props.mimeType || null;
  }

  get attachment(): MessageAttachment | null {
    if (!this.props.mediaUrl) return null;
    return {
      url: this.props.mediaUrl,
      type: this.messageType,
      duration: this.duration,
      fileName: this.props.attachmentName || null,
      fileSize: this.attachmentSize,
      mimeType: this.props.mimeType || null,
    };
  }

  public toJSON() {
    return {
      ...this.props,
      messageType: this.messageType,
      attachment: this.attachment,
    };
  }
}
