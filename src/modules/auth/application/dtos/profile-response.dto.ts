import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({ example: 1, description: 'User account ID' })
  userId: number;

  @ApiProperty({ example: 'John', description: 'User first name' })
  firstName: string;

  @ApiProperty({ example: 'john_doe', description: 'User unique handle' })
  username: string;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'User phone number',
    nullable: true,
  })
  phoneNumber?: string | null;

  @ApiPropertyOptional({
    example: 'Software engineer living in Tehran.',
    description: 'User biography',
    nullable: true,
  })
  bio?: string | null;

  @ApiProperty({
    example: '/uploads/avatars/avatar_1_1726912345.webp',
    description: 'Public profile picture avatar URL (WebP, EXIF stripped)',
  })
  avatarUrl: string;

  @ApiPropertyOptional({
    example: '/uploads/selfies/selfie_1_1726912345.webp',
    description:
      'Private verification selfie photo URL used strictly by admin to verify user identity against the profile picture',
    nullable: true,
  })
  selfieUrl?: string | null;

  @ApiPropertyOptional({
    example: 26,
    description:
      'Dynamically calculated age in years (exact DOB is kept private)',
    nullable: true,
  })
  age?: number | null;

  @ApiPropertyOptional({
    example: 'MALE',
    description: 'Gender',
    nullable: true,
  })
  gender?: string | null;

  @ApiPropertyOptional({
    example: 167,
    description: 'Height in cm',
    nullable: true,
  })
  height?: number | null;

  @ApiPropertyOptional({
    example: ['فارسی', 'Chinese'],
    description: 'User spoken languages list',
    nullable: true,
  })
  languages?: string[] | null;

  @ApiPropertyOptional({
    example: 'DOCTORATE',
    description: 'Education degree status',
    nullable: true,
  })
  degree?: string | null;

  @ApiPropertyOptional({
    example: 'Student',
    description: 'User job / profession',
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
    example: 'FUN',
    description: 'Kind of relationship looking for (Preferences)',
    nullable: true,
  })
  relation?: string | null;

  @ApiPropertyOptional({
    example: 12,
    description: 'Selected City ID',
    nullable: true,
  })
  cityId?: number | null;

  @ApiProperty({
    example: 'en',
    description: 'Normalized user language (en or fa)',
  })
  language: string;

  @ApiProperty({
    example: false,
    description:
      'Indicates profile completion status (returns true only when selfie, height, languages, educations, job, relation status, kind of relationship, and questions are all completed)',
  })
  profileCompleted: boolean;

  @ApiProperty({
    example: false,
    description:
      'Indicates whether an administrator has verified the user identity (verified that the selfie photo matches the profile picture)',
  })
  profileValidated: boolean;
}
