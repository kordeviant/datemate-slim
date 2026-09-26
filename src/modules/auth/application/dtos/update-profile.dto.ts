import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { IsValidUsername } from '../validators/username.validator';
import { IsValidDateOfBirth } from '../validators/dob.validator';

const parseIfJsonString = ({ value }: { value: any }) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
  }
  return value;
};

// ---------------------------------------------------------------------------
// Nested DTO classes matching the Android client schema:
//   { language, lat, lon, Profile: { fullName, username, ...,
//       Demographic: { birthDate, gender, height, degree, profession, relationStatus, City: { id } },
//       Preferences: { relation } } }
// ---------------------------------------------------------------------------

export class CityDto {
  @ApiPropertyOptional({ example: 12, description: 'Selected city ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id?: number;
}

export class DemographicDto {
  @ApiPropertyOptional({
    example: '1998-11-25',
    description: 'Date of birth (YYYY-MM-DD or ISO, must be 18–80 years old)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return typeof value === 'string' || value instanceof Date ? value : undefined;
  })
  @IsValidDateOfBirth()
  birthDate?: string;

  @ApiPropertyOptional({
    example: 'MALE',
    description: 'Gender: Male or Female (case-insensitive)',
    enum: ['Male', 'Female', 'MALE', 'FEMALE', 'male', 'female'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['Male', 'Female', 'MALE', 'FEMALE', 'male', 'female'], {
    message: 'Gender must be either Male or Female',
  })
  gender?: string;

  @ApiPropertyOptional({ example: 180, description: 'Height in cm' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({
    example: 'DOCTORATE',
    description: 'Education degree (e.g. DOCTORATE, MASTER, BACHELOR, HIGH_SCHOOL)',
  })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Profession / occupation',
  })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional({
    example: 'SINGLE',
    description: 'Relationship status (e.g. SINGLE, MARRIED, IN_A_RELATIONSHIP)',
  })
  @IsOptional()
  @IsString()
  relationStatus?: string;

  @ApiPropertyOptional({ type: CityDto, description: 'Selected city' })
  @IsOptional()
  @Transform(parseIfJsonString)
  @ValidateNested()
  @Type(() => CityDto)
  City?: CityDto;
}

export class PreferencesDto {
  @ApiPropertyOptional({
    example: 'LONG',
    description: 'Kind of relationship (e.g. FUN, OPEN, LONG)',
  })
  @IsOptional()
  @IsString()
  relation?: string;
}

export class ProfileNestedDto {
  @ApiPropertyOptional({
    example: 'Parsa',
    description: 'User full name (2–100 chars, cannot be only numbers)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @Length(2, 100, {
    message: 'Full name must be between 2 and 100 characters in length',
  })
  @Matches(/^(?!\d+$).+$/, {
    message: 'Full name cannot contain only numbers',
  })
  fullName?: string;

  @ApiPropertyOptional({
    example: 'parsa',
    description: 'Unique username (3–30 chars, alphanumeric, dots/hyphens/underscores)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @IsValidUsername()
  username?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'Software engineer living in Tehran.',
    description: 'User bio / description',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    example: ['en', 'fa'],
    description:
      'Spoken languages list (2-letter codes or full names). Accepted: en, fa, de, fr, es, it, pt, ru, uk, tr, ar, hi, ur, zh, ja, ko, nl, pl, sv, no, da, fi, cs, el, he',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  languages?: string[] | string;

  @ApiPropertyOptional({
    type: DemographicDto,
    description: 'Demographic details (birthDate, gender, height, degree, profession, relationStatus, City)',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  @ValidateNested()
  @Type(() => DemographicDto)
  Demographic?: DemographicDto;

  @ApiPropertyOptional({
    type: PreferencesDto,
    description: 'Preferences (relation type)',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  @ValidateNested()
  @Type(() => PreferencesDto)
  Preferences?: PreferencesDto;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'EN',
    description: 'App language: EN or FA (case-insensitive)',
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

  @ApiPropertyOptional({ example: 35.6892, description: 'Latitude coordinate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 51.389, description: 'Longitude coordinate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lon?: number;

  @ApiPropertyOptional({
    type: ProfileNestedDto,
    description: 'Profile details including Demographic and Preferences',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  @ValidateNested()
  @Type(() => ProfileNestedDto)
  Profile?: ProfileNestedDto;

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
      'Private selfie photo for admin verification (50KB–5MB, JPEG/PNG/WebP, min 300x300)',
  })
  selfie?: any;

  @ApiPropertyOptional({
    description: 'Android multipart payload containing JSON string of user data',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  data?: any;
}

export { UpdateProfileDto as CreateProfileDto };
