import { ApiProperty } from '@nestjs/swagger';

export class PushResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique tracking Job ID for the push notification',
  })
  job_id: string;

  @ApiProperty({
    example: 'QUEUED',
    description: 'Current status of the notification request',
  })
  status: string;

  @ApiProperty({
    example: 'DateMate Alert',
    description: 'Title of the queued notification',
  })
  title: string;

  @ApiProperty({
    example: 'Push notification accepted and queued for immediate delivery',
    description: 'Status message',
  })
  message: string;
}
