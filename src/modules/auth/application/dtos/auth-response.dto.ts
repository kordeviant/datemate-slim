import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthValidateResultModel {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived JWT access token (15m)',
  })
  access: string;

  @ApiProperty({
    example: 'd9b7f5e1a3c54d8e9f2b1a0c4e7d8f9a2b1c3d5e7f8a9b0c1d2e3f4a5b6c7d8e',
    description: 'Long-lived refresh token for token rotation (30d)',
  })
  refresh: string;

  @ApiProperty({
    example: 101,
    description: 'User ID in the database',
  })
  userId: number;

  @ApiPropertyOptional({
    example: 'ADMIN',
    description: 'User authorization role (USER or ADMIN)',
  })
  role?: string;
}
