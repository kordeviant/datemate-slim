import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignInDto {
  @ApiPropertyOptional({
    example: 'admin@example.com or admin',
    description: 'User registered email address or username handle',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'User handle or username (alias for identifier)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'Username or email login identifier alias',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsString()
  @IsOptional()
  usernameOrEmail?: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'Account password',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    example: 'Google Pixel 8 or Web Browser',
    description: 'Client device model',
  })
  @IsString()
  @IsOptional()
  device?: string;

  @ApiPropertyOptional({
    example: 'DateMate/2.6 (Android 14) or Mozilla/5.0...',
    description: 'Client user-agent string',
  })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional({
    example: 'eXamPLe-fCm-ToKen...',
    description: 'FCM push token for notifications',
  })
  @IsString()
  @IsOptional()
  fcmToken?: string;

  @ApiPropertyOptional({
    example: 'base64_integrity_token_string',
    description: 'Google Play Integrity token (for Android clients)',
  })
  @IsString()
  @IsOptional()
  integrityToken?: string;

  @ApiPropertyOptional({
    example: 'com.dmate.datemate',
    description: 'Application package name (for Android clients)',
  })
  @IsString()
  @IsOptional()
  packageName?: string;
}
