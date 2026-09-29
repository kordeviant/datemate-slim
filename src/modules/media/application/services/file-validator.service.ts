import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AssetTypeRegistry } from '../../domain/asset-type-registry';
import { AssetTypeRule } from '../../domain/asset-type-config.interface';

@Injectable()
export class FileValidatorService {
  private readonly logger = new Logger(FileValidatorService.name);

  constructor(private readonly registry: AssetTypeRegistry) {}

  /**
   * Validates a file upload buffer and metadata against the asset type rules.
   */
  public validate(
    fileBuffer: Buffer,
    assetType: string,
    originalMimeType?: string,
  ): { validatedMimeType: string; rule: AssetTypeRule } {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('File is empty or missing');
    }

    const rule = this.registry.getConfig(assetType);
    if (!rule) {
      throw new BadRequestException(
        `Unsupported asset type "${assetType}". Allowed types: ${this.registry.getAllSupportedTypes().join(', ')}`,
      );
    }

    // Size checks
    if (rule.minSizeBytes && fileBuffer.length < rule.minSizeBytes) {
      throw new BadRequestException(
        `File size (${Math.round(fileBuffer.length / 1024)} KB) is below minimum of ${Math.round(rule.minSizeBytes / 1024)} KB for ${assetType}`,
      );
    }

    if (fileBuffer.length > rule.maxSizeBytes) {
      const maxMb = (rule.maxSizeBytes / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `File size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of ${maxMb} MB for ${assetType}`,
      );
    }

    // Detect actual MIME type from content
    const detectedMime = this.detectMimeFromBuffer(fileBuffer, originalMimeType);

    // Verify allowed MIME types
    const effectiveMime = detectedMime || originalMimeType;
    if (
      !effectiveMime ||
      !rule.allowedMimeTypes.includes(effectiveMime.toLowerCase())
    ) {
      throw new BadRequestException(
        `File format "${effectiveMime || 'unknown'}" is not permitted for asset type "${assetType}". Allowed formats: ${rule.allowedMimeTypes.join(', ')}`,
      );
    }

    // Additional SVG sanitization to prevent stored XSS
    if (effectiveMime === 'image/svg+xml') {
      this.validateAndSanitizeSvg(fileBuffer);
    }

    return {
      validatedMimeType: effectiveMime,
      rule,
    };
  }

  /**
   * Binary magic bytes inspection
   */
  public detectMimeFromBuffer(
    buffer: Buffer,
    hintMime?: string,
  ): string | null {
    if (buffer.length < 4) {
      return null;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }

    // WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return 'image/webp';
    }

    // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
    if (
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      return 'image/gif';
    }

    // PDF: %PDF- (25 50 44 46 2D)
    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      return 'application/pdf';
    }

    // SVG: Text check (<svg or <?xml ... <svg)
    const preview = buffer.slice(0, 1024).toString('utf-8').trim().toLowerCase();
    if (
      preview.includes('<svg') ||
      (preview.startsWith('<?xml') && preview.includes('<svg'))
    ) {
      return 'image/svg+xml';
    }

    // Audio / other formats may fall back to hintMime if provided and valid
    if (hintMime && hintMime.startsWith('audio/')) {
      return hintMime;
    }

    return null;
  }

  /**
   * Validates SVG content against script injection or malicious attributes
   */
  private validateAndSanitizeSvg(buffer: Buffer): void {
    const text = buffer.toString('utf-8');
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // onerror=, onclick=, onload=
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) {
        throw new BadRequestException(
          'SVG contains prohibited executable scripts or active event handlers',
        );
      }
    }
  }
}
