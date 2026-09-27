import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
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
      }
    }
    if (parsed && typeof parsed === 'object') {
      return plainToInstance(cls, parsed);
    }
    return parsed;
  };
};

// ---------------------------------------------------------------------------
// Nested DTO classes matching the Android client schema:
//   { language, lat, lon, Profile: { fullName, username, ...,
//       Demographic: { birthDate, gender, height, weight, degree, profession, religion, relationStatus, City: { id } },
//       Preferences: { relation } } }
// ---------------------------------------------------------------------------

export class CityDto {
  @ApiPropertyOptional({ example: 12, description: 'Selected city ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id?: number;
}

export const transformCity = ({ value }: { value: any }) => {
  if (value === undefined || value === null) return undefined;
  let parsed = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // keep as is
      }
    } else if (!isNaN(Number(trimmed)) && trimmed !== '') {
      return plainToInstance(CityDto, { id: Number(trimmed) });
    }
  }
  if (typeof parsed === 'number') {
    return plainToInstance(CityDto, { id: parsed });
  }
  if (parsed && typeof parsed === 'object') {
    const idVal = parsed.id ?? parsed.cityId ?? parsed.city_id;
    return plainToInstance(CityDto, {
      ...parsed,
      id: idVal !== undefined && idVal !== null && !isNaN(Number(idVal)) ? Number(idVal) : undefined,
    });
  }
  return parsed;
};

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

  @ApiPropertyOptional({ example: 75, description: 'Weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weight?: number;

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
    example: 'ISLAM',
    description: 'Religion status (e.g. CHRISTIANITY, ISLAM, HINDUISM, BUDDHISM, JUDAISM, SPIRITUALITY, AGNOSTIC, ATHEISM, OTHER, RATHER_NOT_SAY)',
  })
  @IsOptional()
  @IsString()
  religion?: string;

  @ApiPropertyOptional({
    example: 'SINGLE',
    description: 'Relationship status (e.g. SINGLE, MARRIED, IN_A_RELATIONSHIP)',
  })
  @IsOptional()
  @IsString()
  relationStatus?: string;

  @ApiPropertyOptional({ type: CityDto, description: 'Selected city' })
  @IsOptional()
  @Transform(transformCity)
  @ValidateNested()
  @Type(() => CityDto)
  City?: CityDto;

  @ApiPropertyOptional({ type: CityDto, description: 'Selected city (lowercase alias)' })
  @IsOptional()
  @Transform(transformCity)
  @ValidateNested()
  @Type(() => CityDto)
  city?: CityDto;

  @ApiPropertyOptional({ example: 12, description: 'City ID flat field' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cityId?: number;

  @ApiPropertyOptional({ example: 12, description: 'City ID snake_case alias' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  city_id?: number;
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

  @ApiPropertyOptional({ example: 75, description: 'Weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({
    example: 'ISLAM',
    description: 'Religion status',
  })
  @IsOptional()
  @IsString()
  religion?: string;

  @ApiPropertyOptional({ type: CityDto, description: 'Selected city' })
  @IsOptional()
  @Transform(transformCity)
  @ValidateNested()
  @Type(() => CityDto)
  City?: CityDto;

  @ApiPropertyOptional({ type: CityDto, description: 'Selected city (lowercase alias)' })
  @IsOptional()
  @Transform(transformCity)
  @ValidateNested()
  @Type(() => CityDto)
  city?: CityDto;

  @ApiPropertyOptional({ example: 12, description: 'City ID flat field' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cityId?: number;

  @ApiPropertyOptional({ example: 12, description: 'City ID snake_case alias' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  city_id?: number;
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

  @ApiPropertyOptional({ description: 'Weight in kg (flat fallback)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weight?: number;

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

  @ApiPropertyOptional({ description: 'Religion status (flat fallback)' })
  @IsOptional()
  @IsString()
  religion?: string;

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

  @ApiPropertyOptional({ description: 'Selected City ID snake_case (flat fallback)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  city_id?: number;

  @ApiPropertyOptional({ type: CityDto, description: 'Selected City (flat fallback)' })
  @IsOptional()
  @Transform(transformCity)
  @ValidateNested()
  @Type(() => CityDto)
  City?: CityDto;

  @ApiPropertyOptional({ type: CityDto, description: 'Selected city lowercase (flat fallback)' })
  @IsOptional()
  @Transform(transformCity)
  @ValidateNested()
  @Type(() => CityDto)
  city?: CityDto;

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
}

export { UpdateProfileDto as CreateProfileDto };
