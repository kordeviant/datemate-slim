import { ApiProperty } from '@nestjs/swagger';

export class DeleteUserGalleryDataDto {
  @ApiProperty({ example: 63, description: 'User ID' })
  userId: number;

  @ApiProperty({ example: 68, description: 'Deleted gallery photo ID' })
  galleryId: number;

  @ApiProperty({ example: true })
  deleted: boolean;
}

export class DeleteGalleryResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Gallery image deleted successfully' })
  message: string;

  @ApiProperty({ type: DeleteUserGalleryDataDto })
  data: DeleteUserGalleryDataDto;
}
