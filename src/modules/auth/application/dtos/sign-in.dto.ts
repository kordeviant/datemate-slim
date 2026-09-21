import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User registered email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'Account password',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'Google Pixel 8',
    description: 'Client device model',
  })
  @IsString()
  @IsNotEmpty()
  device: string;

  @ApiProperty({
    example: 'DateMate/2.6 (Android 14)',
    description: 'Client user-agent string',
  })
  @IsString()
  @IsNotEmpty()
  userAgent: string;

  @ApiPropertyOptional({
    example: 'eXamPLe-fCm-ToKen...',
    description: 'FCM push token for notifications',
  })
  @IsString()
  @IsOptional()
  fcmToken?: string;

  @ApiProperty({
    example: 'base64_integrity_token_string',
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
