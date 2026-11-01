import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectVerificationDto {
  @ApiPropertyOptional({
    description: 'Reason for rejecting identity selfie verification (max 255 characters)',
    example: 'Image is blurry or does not match profile picture.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
