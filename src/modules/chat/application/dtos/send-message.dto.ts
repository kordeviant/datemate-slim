import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsUUID,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsNumber,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { MessageType } from "../../domain/enums/message-type.enum";

export class MessageAttachmentDto {
  @ApiProperty({
    example:
      "http://localhost:3001/uploads/d41d8cd98f00b204e9800998ecf8427e.ogg",
    description: "Public URL to access the attachment file",
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({
    enum: MessageType,
    example: MessageType.VOICE,
    description: "Type of attachment: text, image, video, voice, file",
  })
  @IsOptional()
  @IsString()
  type?: MessageType | string;

  @ApiPropertyOptional({
    example: 12.5,
    description: "Duration in seconds (for voice messages)",
  })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({
    example: "voice_note.ogg",
    description: "Original file name",
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: 45120, description: "File size in bytes" })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiPropertyOptional({ example: "audio/ogg", description: "MIME type" })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class SendMessageWsDto {
  @ApiProperty({ example: "a1a8ecf4-4a25-4c07-b30a-2fb6f6cf557a" })
  @IsUUID("4", { message: "conversationId must be a valid UUID" })
  conversationId: string;

  @ApiProperty({ example: "msg_client_unique_id_999" })
  @IsString()
  @IsNotEmpty({ message: "clientMessageId is required for idempotency" })
  clientMessageId: string;

  @ApiPropertyOptional({
    example: "Hello there! (Optional if attachment is provided)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: "content cannot exceed 4000 characters" })
  content?: string;

  @ApiPropertyOptional({
    enum: MessageType,
    example: MessageType.VOICE,
    description:
      "Message type: text, image, video, voice, or file (defaults to text or inferred from attachment)",
  })
  @IsOptional()
  @IsString()
  type?: MessageType | string;

  @ApiPropertyOptional({
    example: "http://localhost:3001/uploads/voice_123.ogg",
    description: "Optional direct media/file URL",
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    example: 14.5,
    description: "Duration in seconds (especially for voice messages)",
  })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({
    type: () => MessageAttachmentDto,
    description: "Optional nested attachment object",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageAttachmentDto)
  attachment?: MessageAttachmentDto;

  @ApiPropertyOptional({
    example: "Parsa Moloudie",
    description: "Optional sender display name for push notification title",
  })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional({
    example: "Parsa Moloudie",
    description: "Optional notification title override",
  })
  @IsOptional()
  @IsString()
  title?: string;
}
