import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { IsValidUsername } from '../validators/username.validator';
import { IsValidDateOfBirth } from '../validators/dob.validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'John',
    description: 'First name of the user (2–50 characters, cannot be numbers only)',
  })
  @IsOptional()
  @IsString()
  @Length(2, 50, {
    message: 'Name must be between 2 and 50 characters in length',
  })
  @Matches(/^(?!\d+$).+$/, {
    message: 'Name cannot contain only numbers',
  })
  firstName?: string;

  @ApiPropertyOptional({
    example: 'john_doe',
    description:
      'Unique username (3–30 characters, alphanumeric, single dots/hyphens/underscores, no emojis, no spaces, no reserved names)',
  })
  @IsOptional()
  @IsString()
  @IsValidUsername()
  username?: string;

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
    description:
      'User age in years (alternative fallback if client sends age directly)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  age?: number;

  @ApiPropertyOptional({
    example: 'Male',
    description: 'User gender: must be either Male or Female (strictly binary)',
    enum: ['Male', 'Female', 'MALE', 'FEMALE'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['Male', 'Female', 'MALE', 'FEMALE'], {
    message:
      'Gender must be either Male or Female (Other/Unknown not permitted)',
  })
  gender?: string;

  @ApiPropertyOptional({
    example: 'EN',
    description:
      'User language: EN (English) or FA (Farsi), case-insensitive (normalized to lowercase)',
    enum: ['EN', 'FA', 'en', 'fa'],
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== ''
      ? value.toLowerCase().trim()
      : value,
  )
  @IsString()
  @IsIn(['en', 'fa'], {
    message: 'Language must be either EN (English) or FA (Farsi)',
  })
  language?: string;

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
    example: 51.389,
    description: 'User longitude (defaults to 0.0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    example: 'Software engineer living in Tehran.',
    description: 'User bio / description',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    example: 167,
    description: 'User height in cm (e.g. 167)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({
    example: ['فارسی', 'English', 'Chinese'],
    description: 'Spoken languages list (array or comma-separated string)',
  })
  @IsOptional()
  languages?: string[] | string;

  @ApiPropertyOptional({
    example: 'PhD',
    description: 'Education degree (e.g. PhD, Masters, High school student)',
  })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiPropertyOptional({
    example: 'Masters',
    description: 'Alias for education / degree',
  })
  @IsOptional()
  @IsString()
  educations?: string;

  @ApiPropertyOptional({
    example: 'DOCTORATE',
    description: 'Alias for education / degree',
  })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({
    example: 'Student',
    description: 'Job / profession (e.g. Student, Teacher, Unemployed)',
  })
  @IsOptional()
  @IsString()
  job?: string;

  @ApiPropertyOptional({
    example: 'Engineer',
    description: 'Alias for job / profession',
  })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional({
    example: 'Single',
    description: 'Relation status (e.g. Single, Married, Hooking up with someone)',
  })
  @IsOptional()
  @IsString()
  relationStatus?: string;

  @ApiPropertyOptional({
    example: 'Single',
    description: 'Alias for relationStatus',
  })
  @IsOptional()
  @IsString()
  relation_status?: string;

  @ApiPropertyOptional({
    example: 'Fun and Dating',
    description:
      'Kind of relationship looking for (e.g. Fun and Dating, Open, Long term)',
  })
  @IsOptional()
  @IsString()
  kindOfRelationship?: string;

  @ApiPropertyOptional({
    example: 'FUN',
    description: 'Alias for kind of relationship',
  })
  @IsOptional()
  @IsString()
  relation?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Public profile picture avatar image file (50KB–5MB, JPEG/PNG/WebP, min 300x300)',
  })
  avatar?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Private selfie photo for admin verification to verify the profile picture belongs to this user (50KB–5MB, JPEG/PNG/WebP, min 300x300)',
  })
  selfie?: any;
}

export { UpdateProfileDto as CreateProfileDto };
