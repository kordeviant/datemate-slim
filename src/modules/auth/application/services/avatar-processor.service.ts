import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp, { Metadata } from 'sharp';

// Ensures compatibility across both CommonJS and ESM interop
const sharpFn = (typeof sharp === 'function'
  ? sharp
  : (sharp as any).default || sharp) as typeof sharp;

export interface ProcessedAvatarResult {
  relativeUrl: string;
  filePath: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

@Injectable()
export class AvatarProcessorService {
  private readonly logger = new Logger(AvatarProcessorService.name);
  private readonly minSizeBytes = 50 * 1024; // 50 KB
  private readonly maxSizeBytes = 5 * 1024 * 1024; // 5 MB
  private readonly minDimension = 300; // 300x300 px
  private readonly maxDimension = 4096; // 4096x4096 px
  private readonly targetDimension = 1080; // 1080x1080 px WebP

  /**
   * Validates file magic bytes to verify actual image content.
   */
  validateMagicBytes(buffer: Buffer): 'jpeg' | 'png' | 'webp' {
    if (!buffer || buffer.length < 12) {
      throw new BadRequestException('Invalid or empty image file buffer');
    }

    // JPEG signature: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpeg';
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'png';
    }

    // WebP signature: RIFF (bytes 0-3) + WEBP (bytes 8-11)
    const isRiff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46;
    const isWebp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;

    if (isRiff && isWebp) {
      return 'webp';
    }

    throw new BadRequestException(
      'Invalid file format. Only authentic JPEG, PNG, and WebP images are allowed (SVG, GIF, and executable files are strictly prohibited).',
    );
  }

  /**
   * General image processor: validates size, magic bytes, dimensions, strips EXIF metadata, resizes, and converts to WebP.
   */
  async processAndSaveImage(
    fileBuffer: Buffer,
    userId: number,
    prefix: string = 'avatar',
    folder: string = 'avatars',
  ): Promise<ProcessedAvatarResult> {
    const label = prefix === 'selfie' ? 'Selfie' : 'Profile picture';
    // 1. File size check
    if (fileBuffer.length < this.minSizeBytes) {
      throw new BadRequestException(
        `${label} size is too small (${Math.round(fileBuffer.length / 1024)} KB). Minimum allowed size is 50 KB to ensure quality.`,
      );
    }

    if (fileBuffer.length > this.maxSizeBytes) {
      throw new BadRequestException(
        `${label} size is too large (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is 5 MB.`,
      );
    }

    // 2. Validate file magic bytes (security check)
    this.validateMagicBytes(fileBuffer);

    // 3. Inspect image dimensions using sharp
    let metadata: Metadata;
    try {
      metadata = await sharpFn(fileBuffer).metadata();
    } catch (err: any) {
      this.logger.error(`Sharp metadata parsing failed: ${err.message}`);
      throw new BadRequestException('Corrupted or invalid image file content');
    }

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('Unable to determine image dimensions');
    }

    if (
      metadata.width < this.minDimension ||
      metadata.height < this.minDimension
    ) {
      throw new BadRequestException(
        `Image resolution (${metadata.width}x${metadata.height}) is below minimum requirement of ${this.minDimension}x${this.minDimension} pixels.`,
      );
    }

    if (
      metadata.width > this.maxDimension ||
      metadata.height > this.maxDimension
    ) {
      throw new BadRequestException(
        `Image resolution (${metadata.width}x${metadata.height}) exceeds maximum allowed limit of ${this.maxDimension}x${this.maxDimension} pixels.`,
      );
    }

    // 4. Image processing:
    // - .rotate() auto-rotates based on original EXIF orientation
    // - Sharp strips all EXIF metadata (GPS, camera info, timestamps) by default when converting
    // - Resize to standard 1080x1080 cover
    // - WebP conversion at quality 85
    const processedBuffer = await sharpFn(fileBuffer)
      .rotate()
      .resize(this.targetDimension, this.targetDimension, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    // 5. Ensure upload directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', folder);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${prefix}_${userId}_${Date.now()}.webp`;
    const fullPath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(fullPath, processedBuffer);

    const relativeUrl = `/uploads/${folder}/${filename}`;

    this.logger.log(
      `[${prefix.toUpperCase()} Upload] User ${userId}: Processed from ${fileBuffer.length} bytes -> ${processedBuffer.length} bytes WebP at ${relativeUrl}`,
    );

    return {
      relativeUrl,
      filePath: fullPath,
      width: this.targetDimension,
      height: this.targetDimension,
      format: 'webp',
      sizeBytes: processedBuffer.length,
    };
  }

  async processAndSaveAvatar(
    fileBuffer: Buffer,
    userId: number,
  ): Promise<ProcessedAvatarResult> {
    return this.processAndSaveImage(fileBuffer, userId, 'avatar', 'avatars');
  }

  async processAndSaveSelfie(
    fileBuffer: Buffer,
    userId: number,
  ): Promise<ProcessedAvatarResult> {
    return this.processAndSaveImage(fileBuffer, userId, 'selfie', 'selfies');
  }
}
