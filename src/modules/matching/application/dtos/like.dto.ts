import { ApiProperty } from '@nestjs/swagger';

export class LikedUserDto {
  @ApiProperty({ example: 205 })
  id: number;

  @ApiProperty({ example: 'Sara Connor', nullable: true })
  fullName: string | null;

  @ApiProperty({ example: 'sarah_c', nullable: true })
  username: string | null;

  @ApiProperty({ example: 'Tehran', nullable: true })
  city: string | null;

  @ApiProperty({ example: true })
  isOnline: boolean;

  @ApiProperty({ example: 'http://localhost:3000/assets/avatars/avatar_205.webp', nullable: true })
  avatarUrl: string | null;
}

export class LikesListResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Likes retrieved successfully' })
  message: string;

  @ApiProperty({ type: [LikedUserDto] })
  data: LikedUserDto[];
}
