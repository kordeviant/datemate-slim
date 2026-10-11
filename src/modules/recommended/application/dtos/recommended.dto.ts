import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RecommendedQueryDto {
  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of recommended profiles to retrieve (1 to 50, default: 20)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class RecommendedCandidateDto {
  @ApiProperty({ example: 102 })
  id: number;

  @ApiProperty({ example: 'Sara', nullable: true })
  firstName: string | null;

  @ApiProperty({ example: 'Sara Connor', nullable: true })
  fullName: string | null;

  @ApiProperty({ example: 'sarah_c', nullable: true })
  username: string | null;

  @ApiProperty({ example: 25, nullable: true })
  age: number | null;

  @ApiProperty({ example: 'FEMALE', nullable: true })
  gender: string | null;

  @ApiProperty({ example: 'Art enthusiast and coffee lover.', nullable: true })
  bio: string | null;

  @ApiProperty({
    example: 'http://localhost:3000/assets/avatars/avatar_102.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ example: true })
  profileValidated: boolean;

  @ApiProperty({
    example: ['http://localhost:3000/assets/images/gallery_102.webp'],
    type: [String],
  })
  gallery: string[];

  @ApiProperty({ example: ['Music', 'Art', 'Coffee'], type: [String] })
  interests: string[];

  @ApiProperty({ example: 'Tehran', nullable: true })
  city: string | null;

  @ApiProperty({ example: true })
  isOnline: boolean;

  @ApiProperty({ example: '2026-10-11T12:00:00.000Z', nullable: true })
  lastSeenAt: Date | null;

  @ApiProperty({
    example: 88,
    description: 'Compatibility score (0 to 100) based on shared questions, interests, city, goals, and age',
  })
  compatibilityScore: number;

  @ApiProperty({
    example: ['Coffee', 'Music'],
    type: [String],
    description: 'Interests shared between the current user and this candidate',
  })
  sharedInterests: string[];

  @ApiProperty({
    example: 4,
    description: 'Number of identical question answers (lifestyle, personality, values) shared with current user',
  })
  sharedAnswersCount: number;

  @ApiProperty({
    example: true,
    description: 'Whether the candidate lives in the same city as the user',
  })
  sameCity: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether the candidate shares the same relationship goal (LONG, FUN, OPEN)',
  })
  sameRelationGoal: boolean;
}

export class RecommendedResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Recommended profiles retrieved successfully' })
  message: string;

  @ApiProperty({ type: [RecommendedCandidateDto] })
  data: RecommendedCandidateDto[];
}
