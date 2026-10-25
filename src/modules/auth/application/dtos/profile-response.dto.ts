import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountryResponseDto {
  @ApiPropertyOptional({ example: 103, description: 'Country ID', nullable: true })
  id?: number | null;

  @ApiPropertyOptional({ example: 'Iran', description: 'Country name', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ example: 'ایران', description: 'Country native name', nullable: true })
  native?: string | null;

  @ApiPropertyOptional({ example: '🇮🇷', description: 'Country emoji', nullable: true })
  emoji?: string | null;
}

export class StateResponseDto {
  @ApiPropertyOptional({ example: 3945, description: 'State ID', nullable: true })
  id?: number | null;

  @ApiPropertyOptional({ example: 'Tehran', description: 'State name', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ example: 103, description: 'Country ID', nullable: true })
  countryId?: number | null;

  @ApiPropertyOptional({ type: CountryResponseDto, description: 'Country details', nullable: true })
  Country?: CountryResponseDto | null;
}

export class CityResponseDto {
  @ApiPropertyOptional({ example: 135129, description: 'City ID', nullable: true })
  id?: number | null;

  @ApiPropertyOptional({ example: 'Tehran', description: 'City name', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ example: 'Tehran', description: 'State name (flat string)', nullable: true })
  state?: string | null;

  @ApiPropertyOptional({ example: 'Iran', description: 'Country name (flat string)', nullable: true })
  country?: string | null;

  @ApiPropertyOptional({ type: StateResponseDto, description: 'Nested State details for Android City2 schema', nullable: true })
  State?: StateResponseDto | null;
}

export class DemographicResponseDto {
  @ApiPropertyOptional({
    example: '1998-11-25',
    description: 'Date of birth in YYYY-MM-DD format',
    nullable: true,
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    example: 'MALE',
    description: 'Gender (uppercase: MALE or FEMALE)',
    nullable: true,
  })
  gender?: string | null;

  @ApiPropertyOptional({ example: 180, description: 'Height in cm', nullable: true })
  height?: number | null;

  @ApiPropertyOptional({
    example: 'DOCTORATE',
    description: 'Education degree status enum',
    nullable: true,
  })
  degree?: string | null;

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Profession / occupation',
    nullable: true,
  })
  profession?: string | null;

  @ApiPropertyOptional({
    example: 'SINGLE',
    description: 'Relationship status',
    nullable: true,
  })
  relationStatus?: string | null;

  @ApiPropertyOptional({
    type: CityResponseDto,
    description: 'Selected city details',
    nullable: true,
  })
  City?: CityResponseDto | null;
}

export class PreferencesResponseDto {
  @ApiPropertyOptional({
    example: 'LONG',
    description: 'Kind of relationship looking for',
    nullable: true,
  })
  relation?: string | null;
}


export class GalleryItemResponseDto {
  @ApiProperty({ example: 1, description: 'Gallery photo ID' })
  id: number;

  @ApiProperty({
    example: 'http://localhost:3000/assets/images/gallery_1_123.webp',
    description: 'Resolved public image URL',
  })
  url: string;
 
  @ApiPropertyOptional({
    example: 'Weekend vibes',
    description: 'Photo caption or description',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether this photo is the active profile swipe photo',
  })
  isProfilePicture: boolean;

  @ApiPropertyOptional({
    example: '2026-10-04T12:00:00.000Z',
    description: 'Upload timestamp',
  })
  createdAt?: string;
}

export class ProfileNestedResponseDto {
  @ApiPropertyOptional({ example: 'Parsa', description: 'User full name', nullable: true })
  fullName?: string | null;

  @ApiPropertyOptional({ example: 'parsa', description: 'Username handle', nullable: true })
  username?: string | null;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number', nullable: true })
  phoneNumber?: string | null;

  @ApiPropertyOptional({
    example: 'Software engineer living in Tehran.',
    description: 'User bio',
    nullable: true,
  })
  bio?: string | null;

  @ApiPropertyOptional({
    example: ['en', 'fa'],
    description: 'User spoken language 2-letter codes list',
    nullable: true,
  })
  languages?: string[] | null;

  @ApiProperty({
    example: '/uploads/avatars/avatar_1.webp',
    description: 'Public profile picture avatar URL',
  })
  avatar: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/assets/images/gallery_1_123.webp',
    description:
      'Profile picture URL used for swiping (selected from gallery, distinct from avatar)',
    nullable: true,
  })
  profilePicture?: string | null;

  @ApiPropertyOptional({
    example: 12,
    description: 'Active profile picture gallery ID',
    nullable: true,
  })
  profilePictureId?: number | null;

  @ApiProperty({
    example: true,
    description: 'Profile completion status',
  })
  profileCompleted: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether user has premium status',
  })
  isPremium: boolean;

  @ApiPropertyOptional({
    type: DemographicResponseDto,
    description: 'Demographic details',
    nullable: true,
  })
  Demographic?: DemographicResponseDto | null;

  @ApiPropertyOptional({
    example: 'LONG',
    description: 'Kind of relationship looking for (RelationType: FUN, OPEN, LONG)',
    nullable: true,
  })
  RelationType?: string | null;

  @ApiPropertyOptional({
    type: PreferencesResponseDto,
    description: 'Relationship preferences (deprecated: use RelationType directly)',
    nullable: true,
    deprecated: true,
  })
  Preferences?: PreferencesResponseDto | null;

  @ApiPropertyOptional({
    example: { '1': 0, '2': 1, '3': 0 },
    description:
      'User answers formatted as { [questionid]: answerId } where answerId starts from 0 for each question',
    nullable: true,
  })
  Answers?: Record<string, number> | any;

  @ApiPropertyOptional({
    example: { '1': [1, 2], '9': 72 },
    description:
      'User selected interests map by category ID, formatted like Answers: { [categoryId]: interestId | interestId[] }',
    nullable: true,
  })
  LikedActivities?: Record<string, number | number[]> | any;
}


export class ProfileResponseDto {
  @ApiProperty({ example: 1, description: 'User ID' })
  id: number;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'User email', nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'EN', description: 'App language (uppercase: EN or FA)' })
  language: string;

  @ApiPropertyOptional({ example: 35.6892, description: 'Latitude coordinate', nullable: true })
  lat?: number | null;

  @ApiPropertyOptional({ example: 51.389, description: 'Longitude coordinate', nullable: true })
  lon?: number | null;

  @ApiProperty({
    example: false,
    type: Boolean,
    description: 'Whether admin has verified user identity',
  })
  profileValidated: boolean;

  @ApiProperty({ example: false, description: 'Whether user has premium status' })
  isPremium: boolean;

  @ApiProperty({
    type: ProfileNestedResponseDto,
    description: 'Nested profile details including Demographic and Preferences',
  })
  Profile: ProfileNestedResponseDto;

  @ApiPropertyOptional({
    type: [GalleryItemResponseDto],
    description: 'User gallery images with resolved URLs and profile picture indicator',
  })
  gallery?: GalleryItemResponseDto[];
}
