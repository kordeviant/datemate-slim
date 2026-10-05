import { BadRequestException } from '@nestjs/common';
import { AssetTypeRegistry } from '../../domain/asset-type-registry';
import { FileValidatorService } from './file-validator.service';

describe('FileValidatorService', () => {
  let validator: FileValidatorService;
  let registry: AssetTypeRegistry;

  beforeEach(() => {
    registry = new AssetTypeRegistry();
    validator = new FileValidatorService(registry);
  });

  describe('validate', () => {
    it('should throw BadRequestException if buffer is empty', () => {
      expect(() => validator.validate(Buffer.alloc(0), 'icons')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for unsupported asset type', () => {
      const buf = Buffer.from('hello');
      expect(() => validator.validate(buf, 'nonexistent_type')).toThrow(
        /Unsupported asset type/,
      );
    });

    it('should throw BadRequestException if file exceeds max size', () => {
      const hugeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB > 5 MB max for icons
      expect(() =>
        validator.validate(hugeBuffer, 'icons', 'image/svg+xml'),
      ).toThrow(/exceeds maximum allowed size/);
    });

    it('should validate authentic PNG buffer for icons', () => {
      // PNG header: 89 50 4E 47 0D 0A 1A 0A
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(100),
      ]);

      const result = validator.validate(pngBuffer, 'icons', 'image/png');
      expect(result.validatedMimeType).toBe('image/png');
    });

    it('should validate authentic WebP buffer for avatars', () => {
      // WebP header: RIFF (4 bytes) + length (4 bytes) + WEBP (4 bytes)
      const webpHeader = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP'),
      ]);
      const webpBuffer = Buffer.concat([webpHeader, Buffer.alloc(15 * 1024)]);

      const result = validator.validate(webpBuffer, 'avatars', 'image/webp');
      expect(result.validatedMimeType).toBe('image/webp');
    });

    it('should validate authentic WebP buffer for selfies', () => {
      const webpHeader = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP'),
      ]);
      const webpBuffer = Buffer.concat([webpHeader, Buffer.alloc(15 * 1024)]);

      const result = validator.validate(webpBuffer, 'selfies', 'image/webp');
      expect(result.validatedMimeType).toBe('image/webp');
    });

    it('should validate clean SVG buffer for icons', () => {
      const svgBuffer = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
      );

      const result = validator.validate(svgBuffer, 'icons', 'image/svg+xml');
      expect(result.validatedMimeType).toBe('image/svg+xml');
    });

    it('should reject malicious SVG with embedded <script> tags', () => {
      const evilSvg = Buffer.from(
        '<svg><script>alert("xss")</script><rect width="10" height="10"/></svg>',
      );

      expect(() => validator.validate(evilSvg, 'icons', 'image/svg+xml')).toThrow(
        /prohibited executable scripts/,
      );
    });

    it('should reject malicious SVG with event handlers (onload/onerror)', () => {
      const evilSvg = Buffer.from(
        '<svg onload="alert(1)"><rect width="10" height="10"/></svg>',
      );

      expect(() => validator.validate(evilSvg, 'icons', 'image/svg+xml')).toThrow(
        /prohibited executable scripts/,
      );
    });

    it('should reject prohibited format (e.g. text/html or executable)', () => {
      const htmlBuffer = Buffer.from('<html><body>Hello</body></html>');
      expect(() =>
        validator.validate(htmlBuffer, 'icons', 'text/html'),
      ).toThrow(/is not permitted for asset type/);
    });
  });
});
