import { GroupMembershipStatus } from "../enums/group-membership-status.enum";
import { MemberRole } from "../enums/member-role.enum";

export interface GroupRelationshipProps {
  conversationId: string;
  userId: number;
  status: GroupMembershipStatus;
  role?: MemberRole | null;
  createdAt: Date;
  updatedAt: Date;
  requestedAt?: Date | null;
  invitedAt?: Date | null;
  joinedAt?: Date | null;
  bannedAt?: Date | null;
  bannedByUserId?: number | null;
  banReason?: string | null;
}

export class GroupRelationship {
  constructor(private readonly props: GroupRelationshipProps) {}
  get conversationId() { return this.props.conversationId; }
  get userId() { return this.props.userId; }
  get status() { return this.props.status; }
  get role() { return this.props.role; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
  get requestedAt() { return this.props.requestedAt; }
  get invitedAt() { return this.props.invitedAt; }
  get joinedAt() { return this.props.joinedAt; }
  get bannedAt() { return this.props.bannedAt; }
  get bannedByUserId() { return this.props.bannedByUserId; }
  get banReason() { return this.props.banReason; }
  public toJSON(): GroupRelationshipProps { return { ...this.props }; }
}
