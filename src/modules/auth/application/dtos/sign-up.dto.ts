import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignUpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address for verification',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'User password (minimum 6 characters)',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    example: 'base64_google_play_integrity_token_here',
    description: 'Google Play Integrity token from Android device',
  })
  @IsString()
  @IsNotEmpty()
  integrityToken: string;

  @ApiProperty({
    example: 'com.dmate.datemate',
    description: 'Android application package name',
  })
  @IsString()
  @IsNotEmpty()
  packageName: string;
}
