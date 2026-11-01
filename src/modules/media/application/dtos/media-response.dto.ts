import { ApiProperty } from '@nestjs/swagger';

export class MediaUploadResponseDto {
  @ApiProperty({
    example: 'icons_c74384e0323b417187274a6c6c7b9ec3_1727599000000.svg',
    description: 'Unique, safe generated filename',
  })
  filename: string;

  @ApiProperty({
    example: 'icons',
    description: 'Category/type of the asset (icons, images, avatars, etc.)',
  })
  assetType: string;

  @ApiProperty({
    example:
      'http://localhost:3000/assets/icons/icons_c74384e0323b417187274a6c6c7b9ec3_1727599000000.svg',
    description:
      'Full public URL resolved using the configured baseUrl (domain independent)',
  })
  publicUrl: string;

  @ApiProperty({
    example:
      'icons/icons_c74384e0323b417187274a6c6c7b9ec3_1727599000000.svg',
    description: 'Relative storage path / asset key stored in database',
  })
  relativePath: string;

  @ApiProperty({
    example: 'image/svg+xml',
    description: 'Verified MIME type of the uploaded file',
  })
  mimeType: string;

  @ApiProperty({
    example: 2458,
    description: 'File size in bytes',
  })
  sizeBytes: number;

  @ApiProperty({
    example: '2026-09-29T11:45:00.000Z',
    description: 'Upload timestamp in ISO format',
  })
  createdAt: string;
}
