import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUserGalleryItemDto {
  @ApiProperty({ example: 1, description: 'Gallery photo ID' })
  id: number;

  @ApiProperty({
    example: 'http://localhost:3000/assets/images/gallery_101_1728000000000_abc.webp',
    description: 'Resolved public image URL',
  })
  url: string;

  @ApiPropertyOptional({
    example: 'Weekend vibes',
    description: 'Photo caption or description',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({ example: 12, description: 'Likes count' })
  likesCount: number;

  @ApiProperty({
    example: true,
    description: 'Whether this photo is the active profile swipe photo',
  })
  isProfilePicture: boolean;

  @ApiPropertyOptional({
    example: '2026-10-04T12:00:00.000Z',
    description: 'Upload timestamp',
  })
  createdAt?: string;
}

export class AdminUserListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'علی رضایی' })
  fullName: string;

  @ApiProperty({
    example: 'https://api-datemate.testdevvvv.site/uploads/avatars/user1.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ example: 28, nullable: true })
  age: number | null;

  @ApiProperty({ example: 'MALE', nullable: true })
  gender: string | null;

  @ApiProperty({ example: true })
  isPremium: boolean;

  @ApiProperty({
    example: false,
    type: Boolean,
    description: 'Whether user has a pending selfie submitted for verification',
  })
  hasPendingSelfie: boolean;

  @ApiProperty({
    example: true,
    type: Boolean,
    description: 'Whether user profile has been validated by admin',
  })
  profileValidated: boolean;

  @ApiProperty({ example: true, type: Boolean })
  isOnline: boolean;

  @ApiProperty({ example: null, nullable: true })
  bannedUntil: string | null;

  @ApiProperty({ example: '2026-03-15T10:30:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ example: 'تهران', nullable: true })
  city?: string | null;
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
