import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address of the account',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '654321',
    description: '6-digit password reset OTP received via email',
  })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({
    example: 'NewStrongPassword456!',
    description: 'New password (minimum 6 characters)',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
