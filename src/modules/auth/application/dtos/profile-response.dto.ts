import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CityResponseDto {
  @ApiPropertyOptional({ example: 12, description: 'City ID', nullable: true })
  id?: number | null;

  @ApiPropertyOptional({ example: 'Tehran', description: 'City name', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ example: 'Tehran Province', description: 'State name', nullable: true })
  state?: string | null;

  @ApiPropertyOptional({ example: 'Iran', description: 'Country name', nullable: true })
  country?: string | null;
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

  // selfie url: this will not use still, only cline shoululs send

  @ApiProperty({
    example: true,
    description: 'Profile completion status',
  })
  profileCompleted: boolean;

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

  @ApiProperty({ example: false, description: 'Whether admin has verified user identity' })
  profileValidated: boolean;

  @ApiProperty({
    type: ProfileNestedResponseDto,
    description: 'Nested profile details including Demographic and Preferences',
  })
  Profile: ProfileNestedResponseDto;
}
