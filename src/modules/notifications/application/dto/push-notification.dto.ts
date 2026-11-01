import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class PushNotificationDto {
  @ApiProperty({
    example: 'DateMate Alert',
    description: 'Title of the push notification',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'You have a new mutual match!',
    description: 'Body text content of the push notification',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    example: 'fcm_device_token_xyz987',
    description: 'Target single mobile device token',
  })
  @IsOptional()
  @IsString()
  device_token?: string;

  @ApiPropertyOptional({
    example: ['fcm_token_1', 'fcm_token_2'],
    description: 'Target array of mobile device tokens (multicast)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tokens?: string[];

  @ApiPropertyOptional({
    example: 12,
    description: 'Target user ID to retrieve device token from user service or local database',
  })
  @IsOptional()
  userId?: string | number;

  @ApiPropertyOptional({
    example: 'global_announcements',
    description: 'Target FCM topic name for broadcast messaging',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({
    example: { type: 'match', conversationId: 'c_123' },
    description: 'Custom key-value JSON data payload sent to client application',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'https://example.com/banner.jpg',
    description: 'Image URL for rich push notification banner/attachment',
  })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiPropertyOptional({
    example: 'default',
    description: 'Sound name to play on device (default: "default")',
  })
  @IsOptional()
  @IsString()
  sound?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Badge count number to display on iOS app icon',
  })
  @IsOptional()
  @IsNumber()
  badge?: number;

  @ApiPropertyOptional({
    enum: ['high', 'normal'],
    default: 'normal',
    description: 'Message delivery priority',
  })
  @IsOptional()
  @IsEnum(['high', 'normal'])
  priority?: 'high' | 'normal';

  @ApiPropertyOptional({
    example: 'chat_channel',
    description: 'Android notification channel ID',
  })
  @IsOptional()
  @IsString()
  channel_id?: string;

  @ApiPropertyOptional({
    example: '/chat/c_123',
    description: 'Deep link URL or click action identifier',
  })
  @IsOptional()
  @IsString()
  click_action?: string;

  @ApiPropertyOptional({
    example: 3600,
    description: 'Time-to-live in seconds before message expires on FCM',
  })
  @IsOptional()
  @IsNumber()
  ttl?: number;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Custom job ID for tracking or idempotency',
  })
  @IsOptional()
  @IsString()
  job_id?: string;
}
