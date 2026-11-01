import { ApiProperty } from '@nestjs/swagger';

export class TerminateDeviceDataDto {
  @ApiProperty({ example: 12 })
  userId: number;

  @ApiProperty({ example: 10 })
  deviceId: number;

  @ApiProperty({ example: true })
  terminated: boolean;
}

export class TerminateDeviceResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Device session terminated successfully' })
  message: string;

  @ApiProperty({ type: TerminateDeviceDataDto })
  data: TerminateDeviceDataDto;
}

export class TerminateAllDevicesDataDto {
  @ApiProperty({ example: 12 })
  userId: number;

  @ApiProperty({ example: true })
  terminated: boolean;

  @ApiProperty({ example: 3 })
  count: number;
}

export class TerminateAllDevicesResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'All user device sessions terminated successfully' })
  message: string;

  @ApiProperty({ type: TerminateAllDevicesDataDto })
  data: TerminateAllDevicesDataDto;
}
