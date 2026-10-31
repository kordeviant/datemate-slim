import { MemberRole } from "../enums/member-role.enum";

export interface ConversationMemberProps {
  conversationId: string;
  userId: number;
  joinedAt: Date;
  role: MemberRole;
}

export class ConversationMember {
  constructor(private readonly props: ConversationMemberProps) {}

  get conversationId(): string {
    return this.props.conversationId;
  }

  get userId(): number {
    return this.props.userId;
  }

  get joinedAt(): Date {
    return this.props.joinedAt;
  }

  get role(): MemberRole {
    return this.props.role;
  }

  public toJSON() {
    return { ...this.props };
  }
}
