import { ApiProperty } from '@nestjs/swagger';

export class AdminUserListItemDto {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 'Sarahemati@gmail.com' })
  email: string;

  @ApiProperty({ example: 'سارا همتی' })
  fullName: string;

  @ApiProperty({ example: 'sara_h', nullable: true })
  username: string | null;

  @ApiProperty({
    example: 'http://localhost:3000/assets/avatars/avatar_1.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ example: true })
  isPremium: boolean;

  @ApiProperty({ example: false })
  profileValidated: boolean;

  @ApiProperty({ example: false })
  isBanned: boolean;

  @ApiProperty({ example: null, nullable: true })
  bannedUntil: string | null;

  @ApiProperty({ example: 'FEMALE', nullable: true })
  gender: string | null;

  @ApiProperty({ example: 23, nullable: true })
  age: number | null;

  @ApiProperty({ example: 'اسلامشهر', nullable: true })
  city: string | null;

  @ApiProperty({ example: true })
  registrationCompleted: boolean;

  @ApiProperty({ example: true })
  isOnline: boolean;

  @ApiProperty({ example: '2026-10-04T07:15:00.000Z', nullable: true })
  lastSeenAt: string | null;

  @ApiProperty({ example: '2024-11-20T10:00:00.000Z' })
  createdAt: string;
}

export class AdminUsersPaginatedDataDto {
  @ApiProperty({ type: [AdminUserListItemDto] })
  items: AdminUserListItemDto[];

  @ApiProperty({ example: 245 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 25 })
  totalPages: number;
}

export class AdminUsersResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Users list retrieved' })
  message: string;

  @ApiProperty({ type: AdminUsersPaginatedDataDto })
  data: AdminUsersPaginatedDataDto;
}
