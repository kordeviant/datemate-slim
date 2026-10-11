import { ApiProperty } from '@nestjs/swagger';

export class DeleteGalleryImageDataDto {
  @ApiProperty({ example: 1, description: 'User ID' })
  userId: number;

  @ApiProperty({ example: 12, description: 'Deleted gallery image ID' })
  galleryId: number;

  @ApiProperty({ example: true, description: 'Gallery image deletion status' })
  deleted: boolean;
}

export class DeleteGalleryImageResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Gallery image deleted successfully' })
  message: string;

  @ApiProperty({ type: DeleteGalleryImageDataDto })
  data: DeleteGalleryImageDataDto;
}
