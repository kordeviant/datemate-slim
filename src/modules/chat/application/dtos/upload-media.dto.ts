import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { MessageType } from "../../domain/enums/message-type.enum";

export class UploadMediaDto {
  @ApiPropertyOptional({
    enum: MessageType,
    example: MessageType.VOICE,
    description:
      "Optional media type hint: image, video, voice, file. If omitted, will be auto-detected from file mime-type.",
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    example: 12.5,
    description:
      "Duration in seconds (especially for voice messages recorded on mobile)",
  })
  @IsOptional()
  duration?: number | string;

  @ApiPropertyOptional({
    example: "a1a8ecf4-4a25-4c07-b30a-2fb6f6cf557a",
    description: "Optional conversation ID to associate with the upload",
  })
  @IsOptional()
  @IsUUID("4")
  conversationId?: string;
}

export class UploadMediaResponseData {
  @ApiProperty({
    example:
      "http://localhost:3001/uploads/d41d8cd9-8f00-4b04-a980-0998ecf8427e.ogg",
    description:
      "Public URL where the uploaded media or file can be accessed and streamed",
  })
  url: string;

  @ApiProperty({
    enum: MessageType,
    example: MessageType.VOICE,
    description: "Resolved media type category: image, video, voice, or file",
  })
  type: string;

  @ApiPropertyOptional({
    example: 12.5,
    nullable: true,
    description: "Duration in seconds (if audio/voice)",
  })
  duration?: number | null;

  @ApiProperty({
    example: "voice_recording.ogg",
    description: "Original filename uploaded by the client",
  })
  fileName: string;

  @ApiProperty({
    example: "d41d8cd9-8f00-4b04-a980-0998ecf8427e.ogg",
    description: "Unique stored filename on disk",
  })
  storedFileName: string;

  @ApiProperty({
    example: "audio/ogg",
    description: "Detected MIME type",
  })
  mimeType: string;

  @ApiProperty({
    example: 45120,
    description: "File size in bytes",
  })
  size: number;
}
