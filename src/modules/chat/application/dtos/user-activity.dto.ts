import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsInt, ArrayMaxSize, ArrayMinSize } from "class-validator";
import { Type } from "class-transformer";

export class UserActivityDto {
  @ApiProperty({ example: 42, description: "Numeric user ID" })
  userId: number;

  @ApiProperty({ example: true, description: "Whether user is currently online" })
  isOnline: boolean;

  @ApiPropertyOptional({
    example: "2026-10-27T11:45:00.000Z",
    nullable: true,
    description: "ISO 8601 timestamp of last activity / disconnect",
  })
  lastSeenAt: string | null;
}

export class BatchUserActivityRequestDto {
  @ApiProperty({
    example: [1, 2, 42],
    description: "Array of user IDs to check presence for (max 100)",
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Type(() => Number)
  userIds: number[];
}

export class BatchUserActivityResponseDto {
  @ApiProperty({
    type: () => [UserActivityDto],
    example: [
      { userId: 1, isOnline: true, lastSeenAt: null },
      { userId: 2, isOnline: false, lastSeenAt: "2026-10-27T11:40:00.000Z" },
      { userId: 42, isOnline: true, lastSeenAt: null },
    ],
  })
  activities: UserActivityDto[];
}
