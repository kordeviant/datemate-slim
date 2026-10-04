import { ApiProperty } from '@nestjs/swagger';

export class BannedUserDataDto {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: true })
  isBanned: boolean;

  @ApiProperty({ example: '2026-10-11T11:50:00.000Z', nullable: true })
  bannedUntil: string | null;

  @ApiProperty({ example: 'Violation of community rules', nullable: true })
  reason?: string | null;
}

export class BanUserResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'User ban status updated successfully' })
  message: string;

  @ApiProperty({ type: BannedUserDataDto })
  data: BannedUserDataDto;
}
