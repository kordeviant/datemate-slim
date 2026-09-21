import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AppleAuthDto {
  @ApiProperty({
    example: 'iPhone 15 Pro',
    description: 'Device model',
  })
  @IsString()
  @IsNotEmpty()
  device: string;

  @ApiProperty({
    example: 'DateMate/2.6 (iOS 17.5)',
    description: 'User-agent string',
  })
  @IsString()
  @IsNotEmpty()
  userAgent: string;

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    description:
      'Apple Identity Token (optional in body if provided in Authorization Bearer header)',
    required: false,
  })
  @IsOptional()
  @IsString()
  identityToken?: string;

  @ApiProperty({
    example: 'com.dmate.datemate',
    description: 'Application bundle identifier / client ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  bundleId?: string;

  @ApiProperty({
    example: 'John',
    description: 'First name provided by Apple on initial sign-in',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name provided by Apple on initial sign-in',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;
}
