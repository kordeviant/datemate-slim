import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUserDemographicDetailsDto {
  @ApiPropertyOptional({ example: '1997-07-05', nullable: true })
  birthDate: string | null;

  @ApiPropertyOptional({ example: 'FEMALE', nullable: true })
  gender: string | null;

  @ApiPropertyOptional({ example: 29, nullable: true })
  age: number | null;

  @ApiPropertyOptional({ example: 'تهران', nullable: true })
  cityName: string | null;

  @ApiPropertyOptional({ example: 'طراح محصول', nullable: true })
  job: string | null;

  @ApiPropertyOptional({ example: 'کارشناسی ارشد', nullable: true })
  degree: string | null;

  @ApiPropertyOptional({ example: 168, nullable: true })
  height: number | null;

  @ApiPropertyOptional({ example: 58, nullable: true })
  weight: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  religion: string | null;

  @ApiPropertyOptional({ example: 'مجرد', nullable: true })
  relationStatus: string | null;
}

export class AdminUserGalleryDetailsDto {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({
    example: 'https://api-datemate.testdevvvv.site/uploads/gallery/photo1.webp',
  })
  url: string;

  @ApiProperty({ example: 24 })
  likesCount: number;

  @ApiProperty({ example: '2026-01-10T12:00:00.000Z' })
  createdAt: string;
}

export class AdminUserTransactionDto {
  @ApiProperty({ example: 501 })
  id: number;

  @ApiProperty({ example: 'خرید اشتراک طلایی دیتمیت ۳ ماهه' })
  title: string;

  @ApiProperty({ example: 450000 })
  amount: number;

  @ApiProperty({ example: 'اشتراک ویژه طلایی' })
  planName: string;

  @ApiProperty({ example: '۱۴۰۳/۱۱/۲۰' })
  date: string;

  @ApiProperty({ example: 'بانک ملت' })
  bank: string;

  @ApiProperty({ example: '****۶۰۳۷' })
  cardNumber: string;

  @ApiProperty({ example: 'SUCCESS' })
  status: string;
}

export class AdminUserChatRoomDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'کافهگردی و هنر' })
  title: string;

  @ApiProperty({ example: 45 })
  memberCount: number;

  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18',
  })
  imageUrl: string;
}

export class AdminUserDeviceDto {
  @ApiProperty({ example: 10 })
  id: number;

  @ApiProperty({ example: 'iPhone 15 Pro (iOS 17.4)' })
  deviceInfo: string;

  @ApiPropertyOptional({ example: 'fcm-device-token...', nullable: true })
  fcmToken: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-11-14T08:00:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: '2026-10-14T08:00:00.000Z' })
  createdAt: string;
}

export class AdminUserLikeDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 205 })
  userId: number;

  @ApiProperty({ example: 'Sara Connor' })
  fullName: string;

  @ApiPropertyOptional({ example: 'sarah_c', nullable: true })
  username: string | null;

  @ApiPropertyOptional({
    example:
      'https://api-datemate.testdevvvv.site/uploads/avatars/user205.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiPropertyOptional({ example: 'Tehran', nullable: true })
  city?: string | null;

  @ApiProperty({ example: 'RECEIVED', enum: ['RECEIVED', 'SENT'] })
  type: string;

  @ApiProperty({ example: '2026-10-14T08:00:00.000Z' })
  createdAt: string;
}

export class AdminUserDetailsDataDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'sarah.smith@example.com' })
  email: string;

  @ApiProperty({ example: 'USER' })
  role: string;

  @ApiProperty({ example: 'FA' })
  language: string;

  @ApiProperty({ example: 'سارا محمدی' })
  fullName: string;

  @ApiPropertyOptional({ example: 'sarah_m', nullable: true })
  username: string | null;

  @ApiPropertyOptional({ example: '09123456789', nullable: true })
  phoneNumber: string | null;

  @ApiPropertyOptional({
    example: 'علاقهمند به سفر، کوهنوردی و مطالعه کتابهای روانشناسی.',
    nullable: true,
  })
  bio: string | null;

  @ApiPropertyOptional({ example: "MALE", nullable: true })
  gender?: string | null;

  @ApiPropertyOptional({ example: 25, nullable: true })
  age?: number | null;

  @ApiPropertyOptional({
    example: 'https://api-datemate.testdevvvv.site/uploads/avatars/user12.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://api-datemate.testdevvvv.site/uploads/selfies/user12.webp',
    nullable: true,
  })
  selfieUrl: string | null;

  @ApiProperty({ example: true, type: Boolean })
  profileValidated: boolean;

  @ApiProperty({
    example: false,
    type: Boolean,
    description: 'Whether user has a pending selfie submitted for verification',
  })
  hasPendingSelfie: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  bannedUntil: string | null;

  @ApiProperty({ example: 150000 })
  wallet: number;

  @ApiProperty({ example: 420 })
  score: number;

  @ApiProperty({ example: true, type: Boolean })
  notificationsOn: boolean;

  @ApiProperty({ example: false, type: Boolean })
  isPrivate: boolean;

  @ApiProperty({ example: false, type: Boolean })
  isOnline: boolean;

  @ApiProperty({ example: true, type: Boolean })
  isPremium: boolean;

  @ApiPropertyOptional({ example: '2026-10-05T12:00:00.000Z', nullable: true })
  lastSeenAt: string | null;

  @ApiProperty({ example: '2025-11-20T14:22:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-01T08:15:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: AdminUserDemographicDetailsDto })
  demographic: AdminUserDemographicDetailsDto;

  @ApiProperty({ type: [AdminUserGalleryDetailsDto] })
  gallery: AdminUserGalleryDetailsDto[];

  @ApiProperty({ type: [AdminUserTransactionDto] })
  transactions: AdminUserTransactionDto[];

  @ApiProperty({ type: [AdminUserChatRoomDto] })
  chatRooms: AdminUserChatRoomDto[];

  @ApiProperty({ type: [AdminUserDeviceDto] })
  devices: AdminUserDeviceDto[];

  @ApiProperty({ type: [AdminUserLikeDto] })
  likes: AdminUserLikeDto[];

  @ApiProperty({
    type: [String],
    example: ['Traditional Cuisine', 'Hiking', 'Art & Design', 'Cinema', 'Coffee'],
  })
  interests: string[];
}

export class AdminUserDetailsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'User details retrieved successfully' })
  message: string;

  @ApiProperty({ type: AdminUserDetailsDataDto })
  data: AdminUserDetailsDataDto;
}
