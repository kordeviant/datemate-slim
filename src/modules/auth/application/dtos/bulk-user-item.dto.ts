import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BulkUserItemDto {
  @ApiProperty({ example: 1, description: "User ID" })
  id: number;

  @ApiPropertyOptional({
    example: "http://localhost:3000/assets/avatars/avatar_1.webp",
    description: "Avatar URL",
    nullable: true,
  })
  avatar: string | null;

  @ApiPropertyOptional({
    example: "parsa",
    description: "Username handle",
    nullable: true,
  })
  username: string | null;

  @ApiPropertyOptional({
    example: "Parsa",
    description: "User full name",
    nullable: true,
  })
  fullName: string | null;
}
