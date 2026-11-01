import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsArray, ArrayNotEmpty, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
import { ConversationType } from "../../domain/enums/conversation-type.enum";

export class CreateConversationDto {
  @ApiProperty({
    enum: ConversationType,
    description: "Type of conversation: direct or group",
    example: "direct",
  })
  @IsEnum(ConversationType, { message: "type must be direct or group" })
  type: ConversationType;

  @ApiProperty({
    description: "Array of participant user IDs (numeric integers). Must not contain the authenticated user.",
    example: [42],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty({ message: "participantIds must contain at least one user ID" })
  @IsInt({ each: true, message: "Each participant ID must be an integer" })
  participantIds: number[];

  @ApiPropertyOptional({
    description: "Optional title or name for group conversations",
    example: "Weekend Plans",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
