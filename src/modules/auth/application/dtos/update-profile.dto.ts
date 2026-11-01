import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
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

export const parseIfJsonString = ({ value }: { value: any }) => {
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

export const transformJsonOrObject = <T>(cls: new () => T) => {
  return ({ value }: { value: any }) => {
    if (value === undefined || value === null) return undefined;
    let parsed = value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          return value;
        }
      } else {
        const num = Number(trimmed);
        if (!isNaN(num) && trimmed !== '') {
          return plainToInstance(cls, { id: num });
        }
        return plainToInstance(cls, { name: trimmed });
      }
    } else if (typeof value === 'number') {
      return plainToInstance(cls, { id: value });
    }

    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed)) {
        if (parsed.length > 1) {
          throw new BadRequestException(
            'Only one gallery picture is allowed per request. Multiple gallery uploads are not permitted.',
          );
        }
        parsed = parsed[0];
      }
      return plainToInstance(cls, parsed);
    }
    return parsed;
  };
};

// ---------------------------------------------------------------------------
// Gallery DTO: single gallery picture object
// ---------------------------------------------------------------------------

export class GalleryDto {
  @ApiPropertyOptional({
    example: 12,
    description: 'Gallery image ID (for updating existing gallery image or setting as profile picture)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id?: number;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/assets/images/gallery_1_123.webp',
    description: 'Image URL or path for gallery photo',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    example: 'Weekend trip',
    description: 'Optional caption or description for gallery photo',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether this gallery image should be set as the profile picture. Optional; if not sent, the first gallery image is set as profile picture by default.',
  })
  @IsOptional()
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.is_profile_picture;
    if (typeof raw === 'string') {
      const lower = raw.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    return raw;
  })
  @IsBoolean()
  isProfilePicture?: boolean;
}

export class CityDto {
  @ApiPropertyOptional({ example: 12, description: 'Selected city ID' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const num = Number(value);
    return !isNaN(num) ? num : value;
  })
  id?: number | string;

  @ApiPropertyOptional({ example: 'Tehran', description: 'Selected city name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Selected state object or name' })
  @IsOptional()
  State?: any;

  @ApiPropertyOptional({ description: 'Selected state (lowercase alias)' })
  @IsOptional()
  state?: any;

  @ApiPropertyOptional({ description: 'Selected country object or name' })
  @IsOptional()
  Country?: any;

  @ApiPropertyOptional({ description: 'Selected country (lowercase alias)' })
  @IsOptional()
  country?: any;
}

export class DemographicDto {
  @ApiPropertyOptional({
    example: '1998-11-25',
    description: 'Date of birth (YYYY-MM-DD or ISO, must be 18–80 years old)',
  })
  @IsOptional()
  @Transform(({ value, obj }) => {
    const val = value ?? obj?.date ?? obj?.birth_date ?? obj?.birthdate;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val !== undefined && val !== null ? val : undefined;
  })
  @IsValidDateOfBirth()
  birthDate?: string;

  @ApiPropertyOptional({
    example: '1998-11-25',
    description: 'Date of birth alias for birthDate',
  })
  @IsOptional()
  @Transform(({ value, obj }) => {
    const val = value ?? obj?.birthDate ?? obj?.birth_date ?? obj?.birthdate;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val !== undefined && val !== null ? val : undefined;
  })
  @IsValidDateOfBirth()
  date?: string;

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
    example: 'DOCTORATE',
    description: 'Education alias for degree',
  })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Profession / occupation',
  })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Job alias for profession',
  })
  @IsOptional()
  @IsString()
  job?: string;

  @ApiPropertyOptional({
    example: 'SINGLE',
    description: 'Relationship status (e.g. SINGLE, MARRIED, IN_A_RELATIONSHIP)',
  })
  @IsOptional()
  @IsString()
  relationStatus?: string;

  @ApiPropertyOptional({ type: CityDto, description: 'Selected city details' })
  @IsOptional()
  @Transform(transformJsonOrObject(CityDto))
  @ValidateNested()
  @Type(() => CityDto)
  City?: CityDto;

  @ApiPropertyOptional({ example: 12, description: 'City ID flat field' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cityId?: number;
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
  @Transform(transformJsonOrObject(DemographicDto))
  @ValidateNested()
  @Type(() => DemographicDto)
  Demographic?: DemographicDto;

  @ApiPropertyOptional({
    type: DemographicDto,
    description: 'Demographic details (lowercase alias)',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(DemographicDto))
  @ValidateNested()
  @Type(() => DemographicDto)
  demographic?: DemographicDto;

  @ApiPropertyOptional({
    example: 'LONG',
    description: 'Kind of relationship looking for (RelationType: FUN, OPEN, LONG)',
  })
  @IsOptional()
  @IsString()
  RelationType?: string;

  @ApiPropertyOptional({
    example: 'LONG',
    description: 'Kind of relationship lowercase alias',
  })
  @IsOptional()
  @IsString()
  relationType?: string;

  @ApiPropertyOptional({
    type: PreferencesDto,
    description: 'Preferences (relation type)',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(PreferencesDto))
  @ValidateNested()
  @Type(() => PreferencesDto)
  Preferences?: PreferencesDto;

  @ApiPropertyOptional({
    type: PreferencesDto,
    description: 'Preferences (lowercase alias)',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(PreferencesDto))
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;

  @ApiPropertyOptional({
    example: '/uploads/avatars/default.webp',
    description: 'Avatar image URL or path',
  })
  @IsOptional()
  @IsString()
  avatar?: string;



  @ApiPropertyOptional({
    description:
      'Question answers formatted as { [questionId]: answerId } where answerId starts from 0 for each question (e.g. { "1": 0, "2": 1 }), or array of IDs',
    example: { '1': 0, '2': 1, '3': 0 },
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  Answers?: Record<string, number> | any;

  @ApiPropertyOptional({
    description:
      'Question answers formatted as { [questionId]: answerId } (lowercase alias)',
    example: { '1': 0, '2': 1, '3': 0 },
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  answers?: Record<string, number> | any;

  @ApiPropertyOptional({
    description: 'User selected interests map by category ID, formatted like Answers: { [categoryId]: interestId | interestId[] }',
    example: { '1': [1, 3], '9': 72 },
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  LikedActivities?: any;

  @ApiPropertyOptional({
    description: 'User selected interests map or list (lowercase alias)',
    example: { '1': [1, 3], '9': 72 },
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  likedActivities?: any;

  @ApiPropertyOptional({
    description: 'User selected interests map or list (alias)',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  interest?: any;

  @ApiPropertyOptional({
    description: 'User selected interests map or list (alias)',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  interests?: any;

  @ApiPropertyOptional({
    description: 'User selected interests map or list (alias)',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  favorites?: any;
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
  @Transform(transformJsonOrObject(ProfileNestedDto))
  @ValidateNested()
  @Type(() => ProfileNestedDto)
  Profile?: ProfileNestedDto;

  @ApiPropertyOptional({
    type: ProfileNestedDto,
    description: 'Profile details (lowercase alias)',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(ProfileNestedDto))
  @ValidateNested()
  @Type(() => ProfileNestedDto)
  profile?: ProfileNestedDto;

  @ApiPropertyOptional({
    type: DemographicDto,
    description: 'Demographic details if provided at root level',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(DemographicDto))
  @ValidateNested()
  @Type(() => DemographicDto)
  Demographic?: DemographicDto;

  @ApiPropertyOptional({
    type: DemographicDto,
    description: 'Demographic details (lowercase root level alias)',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(DemographicDto))
  @ValidateNested()
  @Type(() => DemographicDto)
  demographic?: DemographicDto;

  @ApiPropertyOptional({
    example: 'LONG',
    description: 'Kind of relationship at root level (RelationType: FUN, OPEN, LONG)',
  })
  @IsOptional()
  @IsString()
  RelationType?: string;

  @ApiPropertyOptional({
    example: 'LONG',
    description: 'Kind of relationship lowercase alias at root level',
  })
  @IsOptional()
  @IsString()
  relationType?: string;

  @ApiPropertyOptional({
    type: PreferencesDto,
    description: 'Preferences if provided at root level',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(PreferencesDto))
  @ValidateNested()
  @Type(() => PreferencesDto)
  Preferences?: PreferencesDto;

  @ApiPropertyOptional({
    type: PreferencesDto,
    description: 'Preferences (lowercase root level alias)',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(PreferencesDto))
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;

  // --- Flat form-data fallback fields (prevents ValidationPipe whitelist stripping) ---
  @ApiPropertyOptional({ description: 'Full name (flat fallback)' })
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

  @ApiPropertyOptional({ description: 'Username (flat fallback)' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @IsValidUsername()
  username?: string;

  @ApiPropertyOptional({ description: 'Phone number (flat fallback)' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Bio (flat fallback)' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Languages list (flat fallback)' })
  @IsOptional()
  @Transform(parseIfJsonString)
  languages?: string[] | string;

  @ApiPropertyOptional({ description: 'Birth date YYYY-MM-DD (flat fallback)' })
  @IsOptional()
  @Transform(({ value, obj }) => {
    const val = value ?? obj?.date ?? obj?.birth_date ?? obj?.birthdate;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val !== undefined && val !== null ? val : undefined;
  })
  @IsValidDateOfBirth()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Date of birth alias (flat fallback)' })
  @IsOptional()
  @Transform(({ value, obj }) => {
    const val = value ?? obj?.birthDate ?? obj?.birth_date ?? obj?.birthdate;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val !== undefined && val !== null ? val : undefined;
  })
  @IsValidDateOfBirth()
  date?: string;

  @ApiPropertyOptional({ description: 'Gender Male/Female (flat fallback)' })
  @IsOptional()
  @IsString()
  @IsIn(['Male', 'Female', 'MALE', 'FEMALE', 'male', 'female'], {
    message: 'Gender must be either Male or Female',
  })
  gender?: string;

  @ApiPropertyOptional({ description: 'Height in cm (flat fallback)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({ description: 'Education degree (flat fallback)' })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({ description: 'Education alias (flat fallback)' })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiPropertyOptional({ description: 'Profession / job (flat fallback)' })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional({ description: 'Job alias (flat fallback)' })
  @IsOptional()
  @IsString()
  job?: string;

  @ApiPropertyOptional({ description: 'Relationship status (flat fallback)' })
  @IsOptional()
  @IsString()
  relationStatus?: string;

  @ApiPropertyOptional({ description: 'Kind of relationship (flat fallback)' })
  @IsOptional()
  @IsString()
  relation?: string;

  @ApiPropertyOptional({ description: 'Selected City ID (flat fallback)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cityId?: number;

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

  @ApiPropertyOptional({
    description: 'Liked activities / interests',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  LikedActivities?: any;

  @ApiPropertyOptional({
    description: 'Favorites / interests alias',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  favorites?: any;

  @ApiPropertyOptional({
    description: 'User interests list or category list',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  interest?: any;

  @ApiPropertyOptional({
    description: 'User interests list or category list (alias)',
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  interests?: any;


  @ApiPropertyOptional({
    description:
      'Question answers formatted as { [questionId]: answerId } where answerId starts from 0 for each question (e.g. { "1": 0, "2": 1 }), or array of IDs',
    example: { '1': 0, '2': 1, '3': 0 },
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  Answers?: Record<string, number> | any;

  @ApiPropertyOptional({
    description:
      'Question answers formatted as { [questionId]: answerId } (lowercase alias)',
    example: { '1': 0, '2': 1, '3': 0 },
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  answers?: Record<string, number> | any;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Gallery image ID to select as primary profile swipe picture (flat fallback)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  profilePictureId?: number;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/assets/images/gallery_1_123.webp',
    description:
      'Deprecated. No need to send in request; use profilePictureId or gallery.isProfilePicture instead.',
    deprecated: true,
  })
  @IsOptional()
  profilePicture?: string;

  @ApiPropertyOptional({
    type: GalleryDto,
    description:
      'Single gallery photo object containing image and/or isProfilePicture flag. Multiple gallery items in one request are not allowed.',
  })
  @IsOptional()
  @Transform(transformJsonOrObject(GalleryDto))
  @ValidateNested()
  @Type(() => GalleryDto)
  gallery?: GalleryDto;

  @ApiPropertyOptional({
    description: 'List of gallery image IDs to delete/remove',
    example: [1, 2],
  })
  @IsOptional()
  @Transform(parseIfJsonString)
  deleteGalleryIds?: number[];
}

export { UpdateProfileDto as CreateProfileDto };
