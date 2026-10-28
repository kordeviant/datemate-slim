import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserAvatarDto {
  @ApiProperty({ example: 1, description: "User ID" })
  id: number;

  @ApiPropertyOptional({
    example: "http://localhost:3000/assets/avatars/avatar_1.webp",
    description: "User avatar URL",
    nullable: true,
  })
  avatarUrl: string | null;
}
