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

  @ApiPropertyOptional({ example: 'MALE', enum: ['MALE', 'FEMALE'] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.webp' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'alireza' })
  @IsOptional()
  @IsString()
  username?: string | null;

  @ApiPropertyOptional({ example: '09123456789' })
  @IsOptional()
  @IsString()
  phoneNumber?: string | null;

  @ApiPropertyOptional({ example: '1998-11-25' })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 26 })
  @IsOptional()
  @IsNumber()
  age?: number;

  @ApiPropertyOptional({ example: 178 })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({ example: 72 })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ example: 'BACHELOR_DEGREE' })
  @IsOptional()
  @IsString()
  degree?: string | null;

  @ApiPropertyOptional({ example: 'مهندس نرم‌افزار' })
  @IsOptional()
  @IsString()
  job?: string | null;

  @ApiPropertyOptional({ example: 'SINGLE' })
  @IsOptional()
  @IsString()
  relationStatus?: string | null;

  @ApiPropertyOptional({ example: 'ISLAM' })
  @IsOptional()
  @IsString()
  religion?: string | null;

  @ApiPropertyOptional({ example: 'تهران' })
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  profile?: any;

  @ApiPropertyOptional()
  @IsOptional()
  demographic?: any;

  @ApiPropertyOptional()
  @IsOptional()
  preferences?: any;

  @ApiPropertyOptional()
  @IsOptional()
  personality?: any;

  @ApiPropertyOptional()
  @IsOptional()
  Answers?: any;

  @ApiPropertyOptional()
  @IsOptional()
  answers?: any;

  @ApiPropertyOptional()
  @IsOptional()
  LikedActivities?: any;

  @ApiPropertyOptional()
  @IsOptional()
  likedActivities?: any;

  @ApiPropertyOptional()
  @IsOptional()
  interests?: any;
}
