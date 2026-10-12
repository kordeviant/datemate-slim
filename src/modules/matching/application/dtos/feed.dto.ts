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

  @ApiProperty({ example: 'Sara Connor', nullable: true })
  fullName: string | null;

  @ApiProperty({ example: 'Tehran', nullable: true })
  city: string | null;

  @ApiProperty({ example: 24, nullable: true })
  age: number | null;

  @ApiProperty({
    example: 'http://localhost:3000/assets/avatars/avatar_205.webp',
    nullable: true,
  })
  profilePicture: string | null;

  @ApiProperty({ example: 'sara_c', nullable: true })
  username: string | null;
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
