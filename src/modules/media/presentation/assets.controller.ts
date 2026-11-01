import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Res,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { GetMediaStreamUseCase } from '../application/use-cases/get-media-stream.use-case';
import { Stream } from 'stream';

@ApiTags('Assets')
@Controller({ path: 'assets' })
export class AssetsController {
  constructor(private readonly getMediaStreamUseCase: GetMediaStreamUseCase) {}

  /**
   * Helper to stream asset files with standard caching & conditional HTTP headers.
   */
  private async streamAsset(
    res: Response,
    assetType: string,
    filename: string,
    ifNoneMatch?: string,
  ): Promise<void> {
    const file = await this.getMediaStreamUseCase.execute(assetType, filename);

    // ETag match -> 304 Not Modified
    if (ifNoneMatch && file.etag && ifNoneMatch === file.etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.sizeBytes);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (file.etag) {
      res.setHeader('ETag', file.etag);
    }
    if (file.lastModified) {
      res.setHeader('Last-Modified', file.lastModified.toUTCString());
    }

    if (file.stream instanceof Stream) {
      file.stream.pipe(res);
    } else {
      res.end(file.stream);
    }
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Get('icons/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public asset route: icons',
    description: 'Serves UI icons and badge vector/raster assets with high-performance caching headers.',
  })
  @ApiParam({ name: 'filename', description: 'Safe asset filename', example: 'icon_star_123.svg' })
  @ApiResponse({ status: 200, description: 'Icon binary stream' })
  @ApiResponse({ status: 304, description: 'Not Modified (cached)' })
  @ApiResponse({ status: 404, description: 'Icon asset not found' })
  async getIcon(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ): Promise<void> {
    return this.streamAsset(res, 'icons', filename, ifNoneMatch);
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Get('images/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public asset route: images',
    description: 'Serves standard platform images, gallery photos, and content visuals.',
  })
  @ApiParam({ name: 'filename', description: 'Safe asset filename', example: 'image_banner_123.webp' })
  @ApiResponse({ status: 200, description: 'Image binary stream' })
  @ApiResponse({ status: 304, description: 'Not Modified (cached)' })
  @ApiResponse({ status: 404, description: 'Image asset not found' })
  async getImage(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ): Promise<void> {
    return this.streamAsset(res, 'images', filename, ifNoneMatch);
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Get('avatars/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public asset route: avatars',
    description: 'Serves user profile pictures and avatar photos.',
  })
  @ApiParam({ name: 'filename', description: 'Safe asset filename', example: 'avatar_user_123.webp' })
  @ApiResponse({ status: 200, description: 'Avatar binary stream' })
  @ApiResponse({ status: 304, description: 'Not Modified (cached)' })
  @ApiResponse({ status: 404, description: 'Avatar asset not found' })
  async getAvatar(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ): Promise<void> {
    return this.streamAsset(res, 'avatars', filename, ifNoneMatch);
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Get('selfies/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public asset route: selfies',
    description: 'Serves user identity verification selfie photos.',
  })
  @ApiParam({ name: 'filename', description: 'Safe asset filename', example: 'selfie_user_123.webp' })
  @ApiResponse({ status: 200, description: 'Selfie binary stream' })
  @ApiResponse({ status: 304, description: 'Not Modified (cached)' })
  @ApiResponse({ status: 404, description: 'Selfie asset not found' })
  async getSelfie(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ): Promise<void> {
    return this.streamAsset(res, 'selfies', filename, ifNoneMatch);
  }

  @Version([VERSION_NEUTRAL, '1'])
  @Get(':type/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scalable public asset route for any asset type',
    description:
      'Dynamically serves assets for any registered asset type (e.g. /assets/icons/{filename}, /assets/images/{filename}, /assets/avatars/{filename}, banners, etc.).',
  })
  @ApiParam({ name: 'type', description: 'Asset type category', example: 'icons' })
  @ApiParam({ name: 'filename', description: 'Safe asset filename', example: 'icon_star_123.svg' })
  @ApiResponse({ status: 200, description: 'Asset binary stream' })
  @ApiResponse({ status: 304, description: 'Not Modified (cached)' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  async getAsset(
    @Param('type') type: string,
    @Param('filename') filename: string,
    @Res() res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ): Promise<void> {
    return this.streamAsset(res, type, filename, ifNoneMatch);
  }
}
