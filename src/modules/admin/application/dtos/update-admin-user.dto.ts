import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminUserDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Confirm/approve the user selfie verification (sets profileValidated to true)',
  })
  @IsOptional()
  @IsBoolean()
  confirmSelfie?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Alternative flag for selfie verification (sets profileValidated to true/false)',
  })
  @IsOptional()
  @IsBoolean()
  selfieVerified?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Direct flag for profile validation (sets profileValidated to true/false)',
  })
  @IsOptional()
  @IsBoolean()
  profileValidated?: boolean;

  @ApiPropertyOptional({
    example: 'علاقه‌مند به طبیعت، موسیقی و مطالعه',
    description: 'User biography description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'علی رضایی',
    description: 'User full display name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the user has premium subscription status',
  })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({
    example: 50.0,
    description: 'User wallet balance',
  })
  @IsOptional()
  @IsNumber()
  wallet?: number;
}
