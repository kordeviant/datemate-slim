import { FilenameGeneratorService } from './filename-generator.service';

describe('FilenameGeneratorService', () => {
  let service: FilenameGeneratorService;

  beforeEach(() => {
    service = new FilenameGeneratorService();
  });

  describe('generateUniqueFilename', () => {
    it('should generate a unique filename on each call', () => {
      const name1 = service.generateUniqueFilename('icons', 'test.svg', 'image/svg+xml');
      const name2 = service.generateUniqueFilename('icons', 'test.svg', 'image/svg+xml');

      expect(name1).not.toBe(name2);
      expect(name1.startsWith('icons_')).toBe(true);
      expect(name1.endsWith('.svg')).toBe(true);
    });

    it('should generate URL-safe filenames that pass isSafeFilename', () => {
      const filename = service.generateUniqueFilename(
        'avatars',
        '../../evil.jpg',
        'image/jpeg',
      );

      expect(service.isSafeFilename(filename)).toBe(true);
      expect(filename.includes('..')).toBe(false);
      expect(filename.includes('/')).toBe(false);
      expect(filename.endsWith('.jpg')).toBe(true);
    });
  });

  describe('sanitizeFilename', () => {
    it('should strip path traversal sequences and dangerous characters', () => {
      expect(service.sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      expect(service.sanitizeFilename('c:\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(service.sanitizeFilename('bad*file?name<>.png')).toBe('bad_file_name__.png');
    });

    it('should handle empty filename gracefully', () => {
      expect(service.sanitizeFilename('')).toBe('');
    });
  });

  describe('isSafeFilename', () => {
    it('should approve valid filenames', () => {
      expect(service.isSafeFilename('icon_123.svg')).toBe(true);
      expect(service.isSafeFilename('avatar_user_789.webp')).toBe(true);
      expect(service.isSafeFilename('photo-2026_09.jpg')).toBe(true);
    });

    it('should reject directory traversal and null bytes', () => {
      expect(service.isSafeFilename('../evil.png')).toBe(false);
      expect(service.isSafeFilename('folder/image.png')).toBe(false);
      expect(service.isSafeFilename('folder\\image.png')).toBe(false);
      expect(service.isSafeFilename('image.png\0.exe')).toBe(false);
      expect(service.isSafeFilename('..%2f..%2fevil.png')).toBe(false);
    });

    it('should reject excessively long filenames', () => {
      const tooLong = 'a'.repeat(200) + '.png';
      expect(service.isSafeFilename(tooLong)).toBe(false);
    });
  });

  describe('getSafeExtension', () => {
    it('should resolve safe extension by MIME type', () => {
      expect(service.getSafeExtension('image/svg+xml')).toBe('.svg');
      expect(service.getSafeExtension('image/png')).toBe('.png');
      expect(service.getSafeExtension('image/jpeg')).toBe('.jpg');
      expect(service.getSafeExtension('image/webp')).toBe('.webp');
      expect(service.getSafeExtension('image/gif')).toBe('.gif');
      expect(service.getSafeExtension('application/pdf')).toBe('.pdf');
    });

    it('should fall back to original file extension if MIME is generic', () => {
      expect(service.getSafeExtension(undefined, 'badge.svg')).toBe('.svg');
      expect(service.getSafeExtension(undefined, 'photo.jpeg')).toBe('.jpg');
    });

    it('should return .bin if neither mime nor original extension is recognized', () => {
      expect(service.getSafeExtension(undefined, 'unknown_file')).toBe('.bin');
    });
  });
});
