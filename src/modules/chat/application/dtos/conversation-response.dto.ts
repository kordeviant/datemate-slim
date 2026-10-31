import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ConversationType } from "../../domain/enums/conversation-type.enum";
import { UserActivityDto } from "./user-activity.dto";

export class LastMessageDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  messageId: string;

  @ApiProperty({ example: 42 })
  senderId: number;

  @ApiProperty({ example: "Hello there" })
  content: string;

  @ApiProperty({ example: "2026-10-13T10:05:00.000Z" })
  createdAt: string;
}

export class RecentMessageDto {
  @ApiProperty({ example: "msg-099" })
  messageId: string;

  @ApiProperty({ example: 2 })
  senderId: number;

  @ApiProperty({ example: "Hello" })
  content: string;

  @ApiProperty({ example: "2026-10-15T08:40:00Z" })
  createdAt: string;
}

export class ConversationResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  conversationId: string;

  @ApiProperty({ enum: ConversationType, example: "direct" })
  type: ConversationType;

  @ApiProperty({ example: 1 })
  createdBy: number;

  @ApiProperty({ example: "2026-10-13T10:00:00.000Z" })
  createdAt: string;

  @ApiPropertyOptional({ example: "Weekend Plans", nullable: true })
  title: string | null;

  @ApiPropertyOptional({ example: [1, 42], type: [Number] })
  memberIds?: number[];

  @ApiPropertyOptional({ type: () => LastMessageDto, nullable: true })
  lastMessage?: LastMessageDto | null;

  @ApiProperty({ type: () => [RecentMessageDto], example: [] })
  recentMessages?: RecentMessageDto[];

  @ApiPropertyOptional({ example: true })
  created?: boolean;

  @ApiPropertyOptional({
    type: () => UserActivityDto,
    nullable: true,
    description: "Online/activity status of the other user in a direct conversation",
  })
  peerActivity?: UserActivityDto | null;

  @ApiPropertyOptional({
    type: () => [UserActivityDto],
    description: "Online/activity status of conversation members",
  })
  membersActivity?: UserActivityDto[];

  @ApiPropertyOptional({ example: 5, description: "Total count of members in the group" })
  membersCount?: number;

  @ApiPropertyOptional({ example: [42, 10, 3], type: [Number], description: "Last 3 joined user IDs" })
  lastUsers?: number[];
}

export class GroupConversationResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  conversationId: string;

  @ApiProperty({ enum: ConversationType, example: "group" })
  type: ConversationType;

  @ApiProperty({ example: 1 })
  createdBy: number;

  @ApiProperty({ example: "2026-10-13T10:00:00.000Z" })
  createdAt: string;

  @ApiPropertyOptional({ example: "Weekend Plans", nullable: true })
  title: string | null;

  @ApiProperty({ example: 5, description: "Total count of members in the group" })
  membersCount: number;

  @ApiProperty({ example: [42, 10, 3], type: [Number], description: "Last 3 joined user IDs" })
  lastUsers: number[];

  @ApiPropertyOptional({ type: () => LastMessageDto, nullable: true })
  lastMessage?: LastMessageDto | null;

  @ApiProperty({ type: () => [RecentMessageDto], example: [] })
  recentMessages?: RecentMessageDto[];
}

export class CreateConversationResponseData {
  @ApiProperty({
    type: () => ConversationResponseDto,
    example: {
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      type: "direct",
      createdBy: 1,
      createdAt: "2026-10-13T10:00:00.000Z",
      title: null,
      memberIds: [1, 42],
      lastMessage: null,
      recentMessages: [],
      created: true,
      peerActivity: {
        userId: 42,
        isOnline: true,
        lastSeenAt: "2026-10-27T11:45:00.000Z",
      },
    },
  })
  conversation: ConversationResponseDto;
}

export class PaginatedConversationsResponseDto {
  @ApiProperty({
    type: () => [ConversationResponseDto],
    example: [
      {
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        type: "direct",
        createdBy: 1,
        createdAt: "2026-10-13T10:00:00.000Z",
        title: null,
        memberIds: [1, 42],
        lastMessage: {
          messageId: "550e8400-e29b-41d4-a716-446655440000",
          senderId: 42,
          content: "Hello there!",
          createdAt: "2026-10-13T10:05:00.000Z",
        },
        recentMessages: [],
        created: true,
        peerActivity: {
          userId: 42,
          isOnline: true,
          lastSeenAt: "2026-10-27T11:45:00.000Z",
        },
      },
    ],
  })
  items: ConversationResponseDto[];

  @ApiPropertyOptional({
    example: "eyJvZmZzZXQiOjIwfQ==",
    nullable: true,
    description: "Opaque cursor for fetching next page",
  })
  nextCursor: string | null;

  @ApiProperty({ example: true, description: "Whether there are more items" })
  hasMore: boolean;
}

export class PaginatedGroupConversationsResponseDto {
  @ApiProperty({
    type: () => [GroupConversationResponseDto],
    example: [
      {
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        type: "group",
        createdBy: 1,
        createdAt: "2026-10-13T10:00:00.000Z",
        title: "Weekend Hikers",
        membersCount: 5,
        lastUsers: [42, 10, 3],
        lastMessage: {
          messageId: "550e8400-e29b-41d4-a716-446655440000",
          senderId: 42,
          content: "Hello everyone!",
          createdAt: "2026-10-13T10:05:00.000Z",
        },
        recentMessages: [],
      },
    ],
  })
  items: GroupConversationResponseDto[];

  @ApiPropertyOptional({
    example: "eyJvZmZzZXQiOjIwfQ==",
    nullable: true,
    description: "Opaque cursor for fetching next page",
  })
  nextCursor: string | null;

  @ApiProperty({ example: true, description: "Whether there are more items" })
  hasMore: boolean;
}

