import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class BanUserDto {
  @ApiPropertyOptional({
    description: 'Ban duration in hours. Provide null or leave omitted for a permanent ban.',
    example: 168,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  durationHours?: number | null;

  @ApiPropertyOptional({
    description: 'Reason for the ban',
    example: 'Violation of community rules',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
