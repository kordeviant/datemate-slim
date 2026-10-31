import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { GroupMembershipStatus } from "../../domain/enums/group-membership-status.enum";
import { MemberRole } from "../../domain/enums/member-role.enum";

export class GroupDataResponseDto {
  @ApiProperty({ example: false, description: "Whether the group is private" })
  isPrivate: boolean;

  @ApiProperty({ example: "Tehran Hikers Club", description: "Group title" })
  title: string;

  @ApiPropertyOptional({ example: "Weekend hiking and coffee meetups", nullable: true })
  bio: string | null;

  @ApiPropertyOptional({ example: "any", nullable: true })
  gender: string | null;

  @ApiPropertyOptional({ example: 20, nullable: true })
  minimumAge: number | null;

  @ApiPropertyOptional({ example: 35, nullable: true })
  maximumAge: number | null;

  @ApiPropertyOptional({ example: 7, nullable: true })
  subjectId: number | null;

  @ApiPropertyOptional({ example: 21, nullable: true })
  cityId: number | null;

  @ApiPropertyOptional({ example: "https://cdn.example.com/groups/hikers.webp", nullable: true })
  avatar: string | null;

  @ApiProperty({ example: "2026-10-26T10:00:00.000Z" })
  createdAt: string;

  @ApiProperty({ example: "2026-10-26T10:00:00.000Z" })
  updatedAt: string;
}

/** Deliberately does not contain unbounded Lists<User>; use member endpoints with pagination. */
export class GroupResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  conversationId: string;

  @ApiProperty({ example: 1 })
  ownerId: number;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ type: () => GroupDataResponseDto })
  groupData: GroupDataResponseDto;

  @ApiPropertyOptional({
    enum: GroupMembershipStatus,
    example: GroupMembershipStatus.ACTIVE,
    nullable: true,
  })
  membershipStatus: GroupMembershipStatus | null;
}

export class GroupParticipantResponseDto {
  @ApiProperty({ example: 42 })
  userId: number;

  @ApiProperty({ enum: GroupMembershipStatus, example: GroupMembershipStatus.ACTIVE })
  status: GroupMembershipStatus;

  @ApiPropertyOptional({ enum: MemberRole, example: MemberRole.MEMBER, nullable: true })
  role: MemberRole | null;

  @ApiPropertyOptional({ example: "2026-10-26T10:15:00.000Z", nullable: true })
  joinedAt: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  requestedAt: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  invitedAt: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  bannedAt: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  bannedByUserId: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  banReason?: string | null;

  @ApiProperty({ example: "2026-10-26T10:15:00.000Z" })
  updatedAt: string;

  @ApiPropertyOptional({ example: true, description: "Whether participant is currently online" })
  isOnline?: boolean;

  @ApiPropertyOptional({
    example: "2026-10-27T10:00:00.000Z",
    nullable: true,
    description: "Last seen timestamp",
  })
  lastSeenAt?: string | null;
}

export class ListGroupParticipantsResponseDto {
  @ApiProperty({
    type: () => [GroupParticipantResponseDto],
    example: [
      {
        userId: 42,
        status: "active",
        role: "member",
        joinedAt: "2026-10-26T10:15:00.000Z",
        requestedAt: null,
        invitedAt: null,
        bannedAt: null,
        bannedByUserId: null,
        banReason: null,
        updatedAt: "2026-10-26T10:15:00.000Z",
        isOnline: true,
        lastSeenAt: "2026-10-27T10:00:00.000Z",
      },
    ],
  })
  items: GroupParticipantResponseDto[];

  @ApiPropertyOptional({ example: "eyJvZmZzZXQiOjMwfQ==", nullable: true })
  nextCursor: string | null;
}
