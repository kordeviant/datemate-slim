import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserDeviceItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiPropertyOptional({ example: 'iPhone 15 Pro, iOS 17.4', nullable: true })
  deviceInfo: string | null;

  @ApiPropertyOptional({ example: 'fcm_token_xyz', nullable: true })
  fcmToken: string | null;

  @ApiProperty({
    example: true,
    description: 'True if expiresAt is in the future, false if expired/inactive',
  })
  isActive: boolean;

  @ApiProperty({
    example: true,
    description:
      'True if this session corresponds to the caller’s current refresh token',
  })
  isCurrent: boolean;

  @ApiProperty({ example: '2026-10-14T10:00:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ example: '2026-11-14T10:00:00.000Z', nullable: true })
  expiresAt: string | null;
}

export class UserDevicesDataDto {
  @ApiProperty({ type: [UserDeviceItemDto] })
  devices: UserDeviceItemDto[];

  @ApiProperty({ type: [UserDeviceItemDto] })
  activeDevices: UserDeviceItemDto[];

  @ApiProperty({ type: [UserDeviceItemDto] })
  inactiveDevices: UserDeviceItemDto[];

  @ApiProperty({ example: 2 })
  total: number;

  @ApiProperty({ example: 1 })
  activeCount: number;

  @ApiProperty({ example: 1 })
  inactiveCount: number;
}

export class UserDevicesResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'User devices retrieved successfully' })
  message: string;

  @ApiProperty({ type: UserDevicesDataDto })
  data: UserDevicesDataDto;
}

export class TerminateClientDeviceDataDto {
  @ApiProperty({ example: 1 })
  deviceId: number;

  @ApiProperty({ example: true })
  terminated: boolean;
}

export class TerminateClientDeviceResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Device session terminated successfully' })
  message: string;

  @ApiProperty({ type: TerminateClientDeviceDataDto })
  data: TerminateClientDeviceDataDto;
}

export class TerminateClientDevicesDto {
  @ApiPropertyOptional({
    description:
      'If true, terminates all sessions except the current caller session. Defaults to false.',
    example: false,
    default: false,
  })
  excludeCurrent?: boolean;

  @ApiPropertyOptional({
    description:
      'Refresh token of the current session to exclude when excludeCurrent=true (optional if authenticated via Bearer token with session).',
    example: 'd9b7f5e1...',
  })
  refreshToken?: string;
}

export class TerminateAllClientDevicesDataDto {
  @ApiProperty({ example: 2 })
  terminatedCount: number;

  @ApiProperty({ example: true })
  excludedCurrent: boolean;
}

export class TerminateAllClientDevicesResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Device sessions terminated successfully' })
  message: string;

  @ApiProperty({ type: TerminateAllClientDevicesDataDto })
  data: TerminateAllClientDevicesDataDto;
}
