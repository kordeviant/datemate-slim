import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsPositive } from 'class-validator';

export class SwipeRequestDto {
  @ApiProperty({
    example: 205,
    description: 'Target user ID to swipe on',
  })
  @IsInt()
  @IsPositive()
  targetUserId: number;

  @ApiProperty({
    enum: ['RIGHT', 'LEFT'],
    example: 'RIGHT',
    description: 'Swipe direction: RIGHT (Like) or LEFT (Pass)',
  })
  @IsEnum(['RIGHT', 'LEFT'], {
    message: 'direction must be either RIGHT or LEFT',
  })
  direction: 'RIGHT' | 'LEFT';
}

export class SwipeResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Swipe recorded successfully' })
  message: string;
}
