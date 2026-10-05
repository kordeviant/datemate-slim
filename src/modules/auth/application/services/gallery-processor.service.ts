import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp, { Metadata } from 'sharp';

// Ensures compatibility across CommonJS and ESM
const sharpFn = (typeof sharp === 'function'
  ? sharp
  : (sharp as any).default || sharp) as typeof sharp;

export interface ProcessedGalleryImage {
  relativeUrl: string;
  filePath: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

@Injectable()
export class GalleryProcessorService {
  private readonly logger = new Logger(GalleryProcessorService.name);

  // Validation Boundaries
  public static readonly MIN_FILE_SIZE_BYTES = 50 * 1024; // 50 KB
  public static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per photo
  public static readonly MAX_PHOTOS_PER_UPLOAD = 1; // Max 1 photo per upload
  public static readonly MAX_TOTAL_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB total
  public static readonly MAX_GALLERY_TOTAL_IMAGES = 10; // Max 10 gallery photos total
  public static readonly MAX_UPDATE_API_LIMIT = 1; // Only 1 gallery item per update request

  /**
   * Validates file magic bytes to verify JPEG, WebP, or PNG format.
   */
  validateMagicBytes(buffer: Buffer): 'jpeg' | 'png' | 'webp' {
    if (!buffer || buffer.length < 12) {
      throw new BadRequestException('Invalid or empty image file buffer');
    }

    // JPEG signature: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpeg';
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

    throw new BadRequestException(
      'Invalid file format. Only WebP and JPG/JPEG images are accepted for gallery photos.',
    );
  }

  /**
   * Validates batch upload constraints:
   * - Max 1 photo per upload
   * - Max 10MB total upload size
   */
  validateBatchConstraints(files: Express.Multer.File[]): void {
    if (!files || files.length === 0) return;

    if (files.length > GalleryProcessorService.MAX_PHOTOS_PER_UPLOAD) {
      throw new BadRequestException(
        `Cannot upload more than ${GalleryProcessorService.MAX_PHOTOS_PER_UPLOAD} photo per upload (received ${files.length}).`,
      );
    }

    const totalSizeBytes = files.reduce(
      (sum, f) => sum + (f.size || f.buffer?.length || 0),
      0,
    );
    if (totalSizeBytes > GalleryProcessorService.MAX_TOTAL_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException(
        `Total upload size (${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum limit of 10MB.`,
      );
    }
  }

  /**
   * Validates and processes a single gallery image:
   * - Size min 50KB and max 10MB (resolution check removed)
   * - Strips EXIF metadata and auto-rotates
   * - Converts to WebP format
   */
  async processAndSaveGalleryImage(
    fileBuffer: Buffer,
    userId: number,
  ): Promise<ProcessedGalleryImage> {
    if (fileBuffer.length < GalleryProcessorService.MIN_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `Gallery photo size (${(fileBuffer.length / 1024).toFixed(2)} KB) is below minimum allowed limit of 50KB.`,
      );
    }

    if (fileBuffer.length > GalleryProcessorService.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `Gallery photo size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 10MB.`,
      );
    }

    // 1. Validate magic bytes
    this.validateMagicBytes(fileBuffer);

    // 2. Read dimensions with Sharp (extracted for metadata without enforcing resolution limits)
    let width = 0;
    let height = 0;
    try {
      const metadata: Metadata = await sharpFn(fileBuffer).metadata();
      width = metadata.width || 0;
      height = metadata.height || 0;
    } catch (err: any) {
      this.logger.error(`Sharp metadata extraction failed: ${err.message}`);
      throw new BadRequestException('Corrupted or invalid image file content');
    }

    // 3. Convert to WebP, auto-rotate according to EXIF, strip metadata
    const processedBuffer = await sharpFn(fileBuffer)
      .rotate()
      .webp({ quality: 85 })
      .toBuffer();

    // 4. Ensure storage directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uuid = crypto.randomBytes(6).toString('hex');
    const filename = `gallery_${userId}_${Date.now()}_${uuid}.webp`;
    const fullPath = path.join(uploadsDir, filename);

    await fs.promises.writeFile(fullPath, processedBuffer);

    const relativeUrl = `images/${filename}`;

    this.logger.log(
      `[Gallery Upload] User ${userId}: Processed photo (${width}x${height}, ${fileBuffer.length}b -> ${processedBuffer.length}b WebP) at ${relativeUrl}`,
    );

    return {
      relativeUrl,
      filePath: fullPath,
      width,
      height,
      format: 'webp',
      sizeBytes: processedBuffer.length,
    };
  }

  /**
   * Processes an array of uploaded gallery files for a user.
   */
  async processBatchGallery(
    files: Express.Multer.File[],
    userId: number,
  ): Promise<ProcessedGalleryImage[]> {
    this.validateBatchConstraints(files);

    const results: ProcessedGalleryImage[] = [];
    for (const file of files) {
      if (file && file.buffer) {
        const processed = await this.processAndSaveGalleryImage(
          file.buffer,
          userId,
        );
        results.push(processed);
      }
    }
    return results;
  }
}
