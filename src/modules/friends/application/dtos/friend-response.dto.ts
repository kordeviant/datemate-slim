import { ApiProperty } from '@nestjs/swagger';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

export class FriendItemDto {
  @ApiProperty({ example: 1, description: 'ID of the friend request or friendship' })
  id: number;

  @ApiProperty({
    enum: FriendRequestStatus,
    example: FriendRequestStatus.PENDING,
    description: 'Status of the friend request or friendship',
  })
  status: FriendRequestStatus;

  @ApiProperty({ example: '2026-10-27T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-27T12:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: 'Sara Connor', nullable: true })
  fullName: string | null;

  @ApiProperty({ example: 'sarah_c', nullable: true })
  username: string | null;

  @ApiProperty({
    example: 'http://localhost:3000/assets/avatars/avatar_205.webp',
    nullable: true,
  })
  avatarUrl: string | null;
}

export class PaginatedFriendsDataDto {
  @ApiProperty({ type: [FriendItemDto] })
  items: FriendItemDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class FriendsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Friends retrieved successfully' })
  message: string;

  @ApiProperty({ type: PaginatedFriendsDataDto })
  data: PaginatedFriendsDataDto;
}

export class FriendRequestsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Friend requests retrieved successfully' })
  message: string;

  @ApiProperty({ type: PaginatedFriendsDataDto })
  data: PaginatedFriendsDataDto;
}

export class FriendActionResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Action performed successfully' })
  message: string;

  @ApiProperty({ type: FriendItemDto })
  data: FriendItemDto;
}

export class AddFriendResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Friend request sent successfully' })
  message: string;

  @ApiProperty({ type: FriendItemDto })
  data: FriendItemDto;
}
