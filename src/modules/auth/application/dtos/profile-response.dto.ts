import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ProfileResponseDto {
  @ApiProperty({ example: 1, description: "User account ID" })
  userId: number;

  @ApiProperty({ example: "John", description: "User first name" })
  firstName: string;

  @ApiProperty({ example: "john_doe", description: "User unique handle" })
  username: string;

  @ApiPropertyOptional({
    example: "+1234567890",
    description: "User phone number",
    nullable: true,
  })
  phoneNumber?: string | null;

  @ApiPropertyOptional({
    example: "Software engineer living in Tehran.",
    description: "User biography",
    nullable: true,
  })
  bio?: string | null;

  @ApiProperty({
    example: "/uploads/avatars/avatar_1_1726912345.webp",
    description: "Processed WebP avatar URL (EXIF stripped)",
  })
  avatarUrl: string;

  @ApiPropertyOptional({
    example: 26,
    description:
      "Dynamically calculated age in years (exact DOB is kept private)",
    nullable: true,
  })
  age?: number | null;

  @ApiPropertyOptional({
    example: "MALE",
    description: "Gender",
    nullable: true,
  })
  gender?: string | null;

  @ApiPropertyOptional({
    example: 12,
    description: "Selected City ID",
    nullable: true,
  })
  cityId?: number | null;

  @ApiProperty({
    example: "en",
    description: "Normalized user language (en or fa)",
  })
  language: string;

  @ApiProperty({
    example: false,
    description:
      "Indicates profile completion status (returns false until all questions and onboarding steps are completed)",
  })
  profileCompleted: boolean;
}
