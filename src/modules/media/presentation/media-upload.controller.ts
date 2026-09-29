import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadMediaUseCase } from '../application/use-cases/upload-media.use-case';
import { MediaUploadResponseDto } from '../application/dtos/media-response.dto';
import { UploadMediaDto } from '../application/dtos/upload-media.dto';
import { AssetTypeRegistry } from '../domain/asset-type-registry';

@ApiTags('Media & Uploads')
@Controller()
export class MediaUploadController {
  constructor(
    private readonly uploadMediaUseCase: UploadMediaUseCase,
    private readonly registry: AssetTypeRegistry,
  ) {}

  @Version([VERSION_NEUTRAL, '1'])
  @Get('media/types')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get supported asset types and validation limits',
    description:
      'Returns the list of all supported asset categories (icons, images, avatars, etc.) along with their allowed formats and size limits.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of supported asset type definitions',
  })
  getSupportedTypes() {
    const types = this.registry.getAllSupportedTypes();
    return types.map((t) => this.registry.getConfig(t));
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Post(['media/upload/:type', 'assets/upload/:type'])
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload media asset by asset type',
    description:
      'Uploads a media file (icon, image, avatar, etc.) into its dedicated asset category. ' +
      'Generates a collision-proof safe filename, stores the asset decoupled from public domain, ' +
      'and returns the full public URL resolved with configured baseUrl.',
  })
  @ApiParam({
    name: 'type',
    description: 'Target asset type (e.g. icons, images, avatars)',
    example: 'icons',
  })
  @ApiBody({
    description: 'Multipart file upload payload',
    type: UploadMediaDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Media successfully uploaded with full public URL',
    type: MediaUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (invalid format, magic bytes mismatch, or size exceeded)',
  })
  async uploadAssetByType(
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body?: { originalName?: string },
  ): Promise<MediaUploadResponseDto> {
    return this.uploadMediaUseCase.execute(type, file, body?.originalName);
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Post('media/upload/icons')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload UI icon asset',
    description: 'Convenience endpoint to upload icon vector or raster images (SVG, PNG, WebP).',
  })
  @ApiBody({ type: UploadMediaDto })
  @ApiResponse({ status: 201, type: MediaUploadResponseDto })
  async uploadIcon(
    @UploadedFile() file: Express.Multer.File,
    @Body() body?: { originalName?: string },
  ): Promise<MediaUploadResponseDto> {
    return this.uploadMediaUseCase.execute('icons', file, body?.originalName);
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Post('media/upload/images')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload image asset',
    description: 'Convenience endpoint to upload standard images and photos (JPEG, PNG, WebP, GIF).',
  })
  @ApiBody({ type: UploadMediaDto })
  @ApiResponse({ status: 201, type: MediaUploadResponseDto })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body?: { originalName?: string },
  ): Promise<MediaUploadResponseDto> {
    return this.uploadMediaUseCase.execute('images', file, body?.originalName);
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Post('media/upload/avatars')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload avatar asset',
    description: 'Convenience endpoint to upload user profile avatar images (JPEG, PNG, WebP).',
  })
  @ApiBody({ type: UploadMediaDto })
  @ApiResponse({ status: 201, type: MediaUploadResponseDto })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Body() body?: { originalName?: string },
  ): Promise<MediaUploadResponseDto> {
    return this.uploadMediaUseCase.execute('avatars', file, body?.originalName);
  }
}
