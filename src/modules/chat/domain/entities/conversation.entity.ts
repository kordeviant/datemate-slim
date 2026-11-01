import { ConversationType } from "../enums/conversation-type.enum";

export interface ConversationProps {
  conversationId: string;
  conversationType: ConversationType;
  createdBy: number;
  createdAt: Date;
  title?: string | null;
  lastMessageAt?: string | null; // timeuuid string
  lastMessageId?: string | null; // uuid string
  lastMessageSenderId?: number | null;
  lastMessagePreview?: string | null;
  updatedAt?: Date | null;
}

export class Conversation {
  constructor(private readonly props: ConversationProps) {}

  get conversationId(): string {
    return this.props.conversationId;
  }

  get conversationType(): ConversationType {
    return this.props.conversationType;
  }

  get createdBy(): number {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get title(): string | null | undefined {
    return this.props.title;
  }

  get lastMessageAt(): string | null | undefined {
    return this.props.lastMessageAt;
  }

  get lastMessageId(): string | null | undefined {
    return this.props.lastMessageId;
  }

  get lastMessageSenderId(): number | null | undefined {
    return this.props.lastMessageSenderId;
  }

  get lastMessagePreview(): string | null | undefined {
    return this.props.lastMessagePreview;
  }

  get updatedAt(): Date | null | undefined {
    return this.props.updatedAt;
  }

  public updateLastMessage(
    lastMessageAt: string,
    lastMessageId: string,
    senderId: number,
    preview: string,
    updatedAt: Date = new Date(),
  ): void {
    this.props.lastMessageAt = lastMessageAt;
    this.props.lastMessageId = lastMessageId;
    this.props.lastMessageSenderId = senderId;
    this.props.lastMessagePreview = preview.length > 100 ? preview.substring(0, 97) + "..." : preview;
    this.props.updatedAt = updatedAt;
  }

  public toJSON() {
    return { ...this.props };
  }
}
