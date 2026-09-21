import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({
    example: 'Pixel 8',
    description: 'Device model',
  })
  @IsString()
  @IsNotEmpty()
  device: string;

  @ApiProperty({
    example: 'DateMate/2.6 (Android 14)',
    description: 'User-agent string',
  })
  @IsString()
  @IsNotEmpty()
  userAgent: string;

  @ApiProperty({
    example: 'base64_play_integrity_token',
    description: 'Google Play Integrity token',
  })
  @IsString()
  @IsNotEmpty()
  integrityToken: string;

  @ApiProperty({
    example: 'com.dmate.datemate',
    description: 'Application package name',
  })
  @IsString()
  @IsNotEmpty()
  packageName: string;
}
