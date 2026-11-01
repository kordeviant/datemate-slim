import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class AddFriendDto {
  @ApiProperty({
    example: 205,
    description: 'Target user ID to add as friend / send friend request to',
  })
  @IsInt()
  @IsPositive()
  userId: number;
}
