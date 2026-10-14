import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({
    example: 'd9b7f5e1a3c54d8e9f2b1a0c4e7d8f9a2b1c3d5e7f8a9b0c1d2e3f4a5b6c7d8e',
    description: 'Refresh token of the current session to terminate',
  })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class LogoutResponseDataDto {
  @ApiProperty({ example: true })
  loggedOut: boolean;
}

export class LogoutResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Logged out successfully' })
  message: string;

  @ApiProperty({ type: LogoutResponseDataDto })
  data: LogoutResponseDataDto;
}
