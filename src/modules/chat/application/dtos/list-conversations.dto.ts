import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsInt, Min, Max, IsString } from "class-validator";
import { Type } from "class-transformer";

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description: "Number of conversations to return (max 100)",
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Opaque cursor for pagination",
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
