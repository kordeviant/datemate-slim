import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address of the account to reset password for',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
