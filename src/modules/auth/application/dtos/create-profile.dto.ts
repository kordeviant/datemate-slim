import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { IsValidUsername } from '../validators/username.validator';
import { IsValidDateOfBirth } from '../validators/dob.validator';

export class CreateProfileDto {
  @ApiProperty({
    example: 'John',
    description: 'First name of the user (2–50 characters, cannot be numbers only)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @Length(2, 50, { message: 'Name must be between 2 and 50 characters in length' })
  @Matches(/^(?!\d+$).+$/, {
    message: 'Name cannot contain only numbers',
  })
  firstName: string;

  @ApiProperty({
    example: 'john_doe',
    description:
      'Unique username (3–30 characters, alphanumeric, single dots/hyphens/underscores, no emojis, no spaces, no reserved names)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Username cannot be empty' })
  @IsValidUsername()
  username: string;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Optional phone number',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '1998-11-25',
    description:
      'Date of birth in YYYY-MM-DD format (must be between 18 and 80 years old)',
  })
  @IsOptional()
  @IsString()
  @IsValidDateOfBirth()
  birthDate?: string;

  @ApiPropertyOptional({
    example: 23,
    description: 'User age in years (alternative fallback if client sends age directly)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  age?: number;

  @ApiProperty({
    example: 'Male',
    description: 'User gender: must be either Male or Female (strictly binary)',
    enum: ['Male', 'Female', 'MALE', 'FEMALE'],
  })
  @IsString()
  @IsNotEmpty({ message: 'Gender selection cannot be empty' })
  @IsIn(['Male', 'Female', 'MALE', 'FEMALE'], {
    message: 'Gender must be either Male or Female (Other/Unknown not permitted)',
  })
  gender: string;

  @ApiProperty({
    example: 'EN',
    description:
      'User language: EN (English) or FA (Farsi), case-insensitive (normalized to lowercase)',
    enum: ['EN', 'FA', 'en', 'fa'],
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Language cannot be empty' })
  @IsIn(['en', 'fa'], {
    message: 'Language must be either EN (English) or FA (Farsi)',
  })
  language: string;

  @ApiPropertyOptional({
    example: 12,
    description: 'Selected city ID for region location',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cityId?: number;

  @ApiPropertyOptional({
    example: 35.6892,
    description: 'User latitude (defaults to 0.0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    example: 51.3890,
    description: 'User longitude (defaults to 0.0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile avatar image file (50KB–5MB, JPEG/PNG/WebP, min 300x300)',
  })
  avatar?: any;
}
