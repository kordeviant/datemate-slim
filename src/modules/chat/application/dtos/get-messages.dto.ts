import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsInt, Min, Max, IsString } from "class-validator";
import { Type } from "class-transformer";
import { MessageType } from "../../domain/enums/message-type.enum";
import { MessageAttachmentDto } from "./send-message.dto";

export class GetMessagesQueryDto {
  @ApiPropertyOptional({
    description: "Number of messages to retrieve (max 100)",
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: "Opaque cursor for backward pagination",
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class MessageItemDto {
  @ApiProperty({ example: "b218ecf4-4a25-4c07-b30a-2fb6f6cf557b" })
  messageId: string;

  @ApiProperty({ example: "a1a8ecf4-4a25-4c07-b30a-2fb6f6cf557a" })
  conversationId: string;

  @ApiProperty({ example: 42 })
  senderId: number;

  @ApiProperty({ example: "Hello" })
  content: string;

  @ApiProperty({ example: "2026-10-13T10:05:00.000Z" })
  createdAt: string;

  @ApiPropertyOptional({ example: "client-req-123", nullable: true })
  clientMessageId?: string | null;

  @ApiPropertyOptional({
    enum: MessageType,
    example: MessageType.TEXT,
    description: "Message type: text, image, video, voice, or file",
  })
  type?: string;

  @ApiPropertyOptional({
    example: "http://localhost:3001/uploads/voice_123.ogg",
    nullable: true,
    description: "Public URL of attached media or file",
  })
  url?: string | null;

  @ApiPropertyOptional({
    example: 12.5,
    nullable: true,
    description: "Duration in seconds (for voice messages)",
  })
  duration?: number | null;

  @ApiPropertyOptional({
    type: () => MessageAttachmentDto,
    nullable: true,
    description: "Detailed attachment metadata",
  })
  attachment?: MessageAttachmentDto | null;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({
    type: () => [MessageItemDto],
    example: [
      {
        messageId: "b218ecf4-4a25-4c07-b30a-2fb6f6cf557b",
        conversationId: "a1a8ecf4-4a25-4c07-b30a-2fb6f6cf557a",
        senderId: 42,
        content: "Hello",
        createdAt: "2026-10-13T10:05:00.000Z",
        clientMessageId: "client-req-123",
        type: "text",
        url: null,
        duration: null,
        attachment: null,
      },
    ],
  })
  items: MessageItemDto[];

  @ApiPropertyOptional({
    example: "eyJidWNrZXQiOiIyMDI2MTAxMyIsInBhZ2luZ1N0YXRlIjoiMTIzNCJ9",
    nullable: true,
  })
  nextCursor?: string | null;

  @ApiProperty({ example: false })
  hasMore: boolean;
}
