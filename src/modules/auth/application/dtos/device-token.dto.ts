import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDeviceTokenDto {
  @ApiProperty({
    example: 'fcm_token_sample_123456',
    description: 'Device push notification token',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({
    example: 'Samsung Galaxy S24 (Android 14)',
    description: 'Device hardware and OS information',
  })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

export class DeviceTokenDataDto {
  @ApiProperty({ example: 12, description: 'User ID' })
  userId: number;

  @ApiProperty({
    example: 'fcm_token_sample_123456',
    description: 'Device push notification token',
    nullable: true,
  })
  token: string | null;

  @ApiProperty({
    example: 'Samsung Galaxy S24 (Android 14)',
    description: 'Device hardware and OS information',
    nullable: true,
  })
  deviceInfo: string | null;
}

export class DeviceTokenResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Device token updated successfully' })
  message: string;

  @ApiProperty({ type: DeviceTokenDataDto })
  data: DeviceTokenDataDto;
}
