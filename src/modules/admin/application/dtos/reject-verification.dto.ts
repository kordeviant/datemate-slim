import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectVerificationDto {
  @ApiPropertyOptional({
    description: 'Reason for rejecting identity selfie verification',
    example: 'Blurry face or does not match profile picture',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
