import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadMediaDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File binary to upload',
  })
  file: any;

  @ApiPropertyOptional({
    description: 'Optional custom display or original filename',
    example: 'my-badge.svg',
  })
  @IsOptional()
  @IsString()
  originalName?: string;
}
