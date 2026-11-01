import { ApiProperty } from '@nestjs/swagger';

export class AdminVerificationItemDto {
  @ApiProperty({ example: 1, description: 'Verification record ID' })
  id: number;

  @ApiProperty({ example: 102, description: 'User ID' })
  userId: number;

  @ApiProperty({ example: 'Sara Mohammadi' })
  fullName: string;

  @ApiProperty({ example: 'sara@example.com' })
  email: string;

  @ApiProperty({
    example: 'https://storage.datemate.com/avatars/user-102.webp',
    nullable: true,
    description: 'Avatar URL or null if user has not set an avatar picture',
  })
  avatarUrl: string | null;

  @ApiProperty({
    example: 'https://storage.datemate.com/selfies/user-102-selfie.jpg',
    nullable: true,
    description: 'Uploaded verification selfie photo URL',
  })
  selfieUrl: string | null;

  @ApiProperty({ example: 25, nullable: true })
  age: number | null;

  @ApiProperty({ example: 'FEMALE', nullable: true })
  gender: string | null;

  @ApiProperty({ example: '2026-10-05T12:00:00.000Z', description: 'Submission timestamp (ISO date string)' })
  requestedAt: string;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({ example: '2026-10-05T12:00:00.000Z' })
  createdAt: string;
}

export class AdminVerificationsMetaDto {
  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

export class AdminVerificationsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Pending verifications retrieved successfully' })
  message: string;

  @ApiProperty({ type: [AdminVerificationItemDto] })
  data: AdminVerificationItemDto[];

  @ApiProperty({ type: AdminVerificationsMetaDto })
  meta: AdminVerificationsMetaDto;
}

export class ApproveVerificationDataDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'APPROVED' })
  status: string;

  @ApiProperty({ example: '2026-10-05T12:15:00.000Z' })
  verifiedAt: string;
}

export class ApproveVerificationResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Verification approved successfully' })
  message: string;

  @ApiProperty({ type: ApproveVerificationDataDto })
  data: ApproveVerificationDataDto;
}

export class RejectVerificationDataDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'REJECTED' })
  status: string;

  @ApiProperty({ example: 'Image is blurry or does not match profile picture.' })
  reason: string;

  @ApiProperty({ example: '2026-10-05T12:16:00.000Z' })
  rejectedAt: string;
}

export class RejectVerificationResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Verification rejected successfully' })
  message: string;

  @ApiProperty({ type: RejectVerificationDataDto })
  data: RejectVerificationDataDto;
}
