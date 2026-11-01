import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class ValidateCodeDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit OTP verification code received via email',
  })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({
    example: 'Samsung Galaxy S23',
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
    description: 'Firebase Cloud Messaging device token for push alerts',
  })
  @IsString()
  @IsOptional()
  fcmToken?: string;
}
