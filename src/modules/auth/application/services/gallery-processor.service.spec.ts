import { BadRequestException } from '@nestjs/common';
import { GalleryProcessorService } from './gallery-processor.service';

describe('GalleryProcessorService', () => {
  let service: GalleryProcessorService;

  beforeEach(() => {
    service = new GalleryProcessorService();
  });

  describe('validateMagicBytes', () => {
    it('should identify valid JPEG magic bytes', () => {
      const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      expect(service.validateMagicBytes(jpegBuffer)).toBe('jpeg');
    });

    it('should identify valid PNG magic bytes', () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      expect(service.validateMagicBytes(pngBuffer)).toBe('png');
    });

    it('should identify valid WebP magic bytes', () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      expect(service.validateMagicBytes(webpBuffer)).toBe('webp');
    });

    it('should reject non-accepted formats like GIF, SVG, or executable files', () => {
      const gifBuffer = Buffer.from('GIF89a_fake_gif_content_here_extra');
      expect(() => service.validateMagicBytes(gifBuffer)).toThrow(
        BadRequestException,
      );

      const fakeExe = Buffer.from('MZ_executable_binary_content_here');
      expect(() => service.validateMagicBytes(fakeExe)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateBatchConstraints', () => {
    it('should reject more than 1 photo per upload', () => {
      const fakeFiles: any[] = [
        { buffer: Buffer.alloc(100) },
        { buffer: Buffer.alloc(100) },
      ];

      expect(() => service.validateBatchConstraints(fakeFiles)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateBatchConstraints(fakeFiles)).toThrow(
        'Cannot upload more than 1 photo per upload',
      );
    });

    it('should reject total upload size exceeding 10MB', () => {
      const fakeFiles: any[] = [
        { size: 11 * 1024 * 1024, buffer: Buffer.alloc(10) },
      ];

      expect(() => service.validateBatchConstraints(fakeFiles)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateBatchConstraints(fakeFiles)).toThrow(
        'exceeds maximum limit of 10MB',
      );
    });

    it('should accept valid upload of 1 photo <= 10MB', () => {
      const fakeFiles: any[] = [
        { size: 2 * 1024 * 1024, buffer: Buffer.alloc(10) },
      ];

      expect(() => service.validateBatchConstraints(fakeFiles)).not.toThrow();
    });
  });

  describe('processAndSaveGalleryImage file size restriction', () => {
    it('should reject single photo below 50KB', async () => {
      const smallBuffer = Buffer.alloc(40 * 1024); // 40 KB
      await expect(
        service.processAndSaveGalleryImage(smallBuffer, 1),
      ).rejects.toThrow('below minimum allowed limit of 50KB');
    });

    it('should reject single photo exceeding 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
      await expect(
        service.processAndSaveGalleryImage(largeBuffer, 1),
      ).rejects.toThrow('exceeds maximum allowed limit of 10MB');
    });
  });
});
