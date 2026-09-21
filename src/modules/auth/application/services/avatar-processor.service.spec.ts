import { BadRequestException } from '@nestjs/common';
import { AvatarProcessorService } from './avatar-processor.service';

describe('AvatarProcessorService', () => {
  let service: AvatarProcessorService;

  beforeEach(() => {
    service = new AvatarProcessorService();
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
      // RIFF (52 49 46 46) + 4 bytes size + WEBP (57 45 42 50)
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      expect(service.validateMagicBytes(webpBuffer)).toBe('webp');
    });

    it('should reject invalid files or malware disguised with image extension', () => {
      const fakeFile = Buffer.from('MZ_fake_exe_content_here_with_padding');
      expect(() => service.validateMagicBytes(fakeFile)).toThrow(
        BadRequestException,
      );
    });

    it('should reject SVG or GIF files', () => {
      const gifBuffer = Buffer.from('GIF89a_fake_gif_content_here_extra');
      expect(() => service.validateMagicBytes(gifBuffer)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('File Size Restrictions', () => {
    it('should reject images smaller than 50 KB', async () => {
      const smallBuffer = Buffer.alloc(49 * 1024); // 49 KB
      await expect(service.processAndSaveAvatar(smallBuffer, 1)).rejects.toThrow(
        'Profile picture size is too small',
      );
    });

    it('should reject images larger than 5 MB', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB
      await expect(service.processAndSaveAvatar(largeBuffer, 1)).rejects.toThrow(
        'Profile picture size is too large',
      );
    });
  });
});
