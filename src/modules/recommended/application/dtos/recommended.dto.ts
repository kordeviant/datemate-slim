import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ProfileResponseDto } from '../../../auth/application/dtos/profile-response.dto';

export class RecommendedQueryDto {
  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description:
      'Starting numeric item index (0-based, e.g. 0) OR Candidate User ID to start after/from (default: 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start?: number;

  @ApiPropertyOptional({
    example: 216,
    description:
      'Optional candidate user ID to start from/after (cursor-based pagination)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  candidateId?: number;

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

  @ApiPropertyOptional({
    example: 20,
    description: 'Optional ending numeric index',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  end?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Alternative alias for start (0-based offset)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    example: 123,
    description:
      'Anchor candidate user ID around which to retrieve preceding and succeeding candidates',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anchorUserId?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Number of candidate profiles to retrieve immediately preceding the anchor user (0 to 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  before?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Number of candidate profiles to retrieve immediately succeeding the anchor user (0 to 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  after?: number;
}

export class RecommendedCandidateDto {
  @ApiProperty({ example: 102 })
  id: number;

  @ApiProperty({
    example: 'http://localhost:3000/assets/avatars/avatar_102.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ example: 25, nullable: true })
  age: number | null;

  @ApiProperty({ example: 'Tehran', nullable: true })
  city: string | null;

  @ApiProperty({ example: 'sarah_c', nullable: true })
  username: string | null;

  @ApiProperty({ example: 'Sara Connor', nullable: true })
  fullName: string | null;
}

export class RecommendedResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Recommended profiles retrieved successfully' })
  message: string;

  @ApiProperty({ type: [RecommendedCandidateDto] })
  data: RecommendedCandidateDto[];
}

export class RecommendedDetailQueryDto {
  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description:
      'Starting numeric item index (0-based, e.g. 0) OR Candidate User ID to start after/from (default: 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start?: number;

  @ApiPropertyOptional({
    example: 216,
    description:
      'Optional candidate user ID to start from/after (cursor-based pagination)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  candidateId?: number;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of detailed recommended profiles to retrieve (1 to 50, default: 20)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 20,
    description: 'Optional ending numeric index',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  end?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Alternative alias for start (0-based offset)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    example: 123,
    description:
      'Anchor candidate user ID around which to retrieve preceding and succeeding candidates',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anchorUserId?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Number of candidate profiles to retrieve immediately preceding the anchor user (0 to 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  before?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Number of candidate profiles to retrieve immediately succeeding the anchor user (0 to 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  after?: number;
}

export class RecommendedDetailResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Recommended detailed profiles retrieved successfully' })
  message: string;

  @ApiProperty({ type: [ProfileResponseDto] })
  data: ProfileResponseDto[];
}
