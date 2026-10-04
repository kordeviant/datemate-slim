import { ApiProperty } from '@nestjs/swagger';

export class AdminVerificationItemDto {
  @ApiProperty({ example: 101 })
  userId: number;

  @ApiProperty({ example: 'سارا همتی' })
  fullName: string;

  @ApiProperty({ example: 'sara_h', nullable: true })
  username: string | null;

  @ApiProperty({ example: 'Sarahemati@gmail.com' })
  email: string;

  @ApiProperty({
    example: 'http://localhost:3000/assets/avatars/avatar_1.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({
    example: 'http://localhost:3000/assets/selfies/selfie_1.webp',
    nullable: true,
  })
  selfieUrl: string | null;

  @ApiProperty({ example: 'FEMALE', nullable: true })
  gender: string | null;

  @ApiProperty({ example: 23, nullable: true })
  age: number | null;

  @ApiProperty({ example: 'اسلامشهر', nullable: true })
  city: string | null;

  @ApiProperty({ example: '2026-10-04T07:15:00.000Z' })
  submittedAt: string;

  @ApiProperty({ example: '2024-11-20T10:00:00.000Z' })
  createdAt: string;
}

export class AdminVerificationsPaginatedDataDto {
  @ApiProperty({ type: [AdminVerificationItemDto] })
  items: AdminVerificationItemDto[];

  @ApiProperty({ example: 7 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}

export class AdminVerificationsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Pending verifications retrieved' })
  message: string;

  @ApiProperty({ type: AdminVerificationsPaginatedDataDto })
  data: AdminVerificationsPaginatedDataDto;
}

export class ApproveVerificationDataDto {
  @ApiProperty({ example: 101 })
  userId: number;

  @ApiProperty({ example: true })
  profileValidated: boolean;
}

export class ApproveVerificationResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'User selfie verification approved' })
  message: string;

  @ApiProperty({ type: ApproveVerificationDataDto })
  data: ApproveVerificationDataDto;
}

export class RejectVerificationDataDto {
  @ApiProperty({ example: 101 })
  userId: number;

  @ApiProperty({ example: false })
  profileValidated: boolean;

  @ApiProperty({
    example: 'Blurry face or does not match profile picture',
    nullable: true,
  })
  reason: string | null;
}

export class RejectVerificationResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'User selfie verification rejected' })
  message: string;

  @ApiProperty({ type: RejectVerificationDataDto })
  data: RejectVerificationDataDto;
}
