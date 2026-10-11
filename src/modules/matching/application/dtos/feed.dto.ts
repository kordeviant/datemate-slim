import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FeedQueryDto {
  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of profile cards to retrieve (1 to 50, default: 20)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class FeedCandidateDto {
  @ApiProperty({ example: 205 })
  id: number;

  @ApiProperty({ example: 'sara_c', nullable: true })
  username: string | null;

  @ApiProperty({ example: 'Sara Connor', nullable: true })
  fullName: string | null;

  @ApiProperty({ example: 24, nullable: true })
  age: number | null;

  @ApiProperty({ example: 'FEMALE', nullable: true })
  gender: string | null;

  @ApiProperty({ example: 'Love photography and coffee.', nullable: true })
  bio: string | null;

  @ApiProperty({
    example: 'http://localhost:3000/assets/avatars/avatar_205.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ example: true })
  profileValidated: boolean;

  @ApiProperty({
    example: ['http://localhost:3000/assets/images/gallery_1.webp'],
    type: [String],
  })
  gallery: string[];

  @ApiProperty({ example: ['Photography', 'Hiking'], type: [String] })
  interests: string[];

  @ApiProperty({ example: 'Tehran', nullable: true })
  city: string | null;

  @ApiProperty({ example: true })
  isOnline: boolean;

  @ApiProperty({ example: '2026-10-11T12:00:00.000Z', nullable: true })
  lastSeenAt: Date | null;
}

export class FeedDataDto {
  @ApiProperty({ type: [FeedCandidateDto] })
  candidates: FeedCandidateDto[];

  @ApiProperty({ example: 20 })
  count: number;
}

export class FeedResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Feed retrieved successfully' })
  message: string;

  @ApiProperty({ type: FeedDataDto })
  data: FeedDataDto;
}
