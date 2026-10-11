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
