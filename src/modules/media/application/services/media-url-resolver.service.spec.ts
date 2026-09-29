import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaUrlResolverService } from './media-url-resolver.service';

describe('MediaUrlResolverService', () => {
  let service: MediaUrlResolverService;
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaUrlResolverService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MediaUrlResolverService>(MediaUrlResolverService);
  });

  describe('getBaseUrl', () => {
    it('should read baseUrl from ASSET_BASE_URL', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ASSET_BASE_URL') return 'https://assets.datemate.com';
        return null;
      });

      expect(service.getBaseUrl()).toBe('https://assets.datemate.com');
    });

    it('should strip trailing slashes from configured baseUrl', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ASSET_BASE_URL') return 'https://assets.datemate.com///';
        return null;
      });

      expect(service.getBaseUrl()).toBe('https://assets.datemate.com');
    });

    it('should fall back to MEDIA_BASE_URL if ASSET_BASE_URL is not set', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MEDIA_BASE_URL') return 'https://media.datemate.com';
        return null;
      });

      expect(service.getBaseUrl()).toBe('https://media.datemate.com');
    });

    it('should fall back to APP_BASE_URL if ASSET and MEDIA are not set', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'APP_BASE_URL') return 'https://api.datemate.com';
        return null;
      });

      expect(service.getBaseUrl()).toBe('https://api.datemate.com');
    });

    it('should fall back to http://localhost:<PORT> if no baseUrl is configured', () => {
      mockConfigService.get.mockImplementation((key: string, def?: any) => {
        if (key === 'PORT') return 4000;
        return def || null;
      });

      expect(service.getBaseUrl()).toBe('http://localhost:4000');
    });
  });

  describe('getPublicUrl', () => {
    it('should generate correct scalable public URL for icons', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ASSET_BASE_URL') return 'https://cdn.datemate.com';
        return null;
      });

      const url = service.getPublicUrl('icons', 'badge_star.svg');
      expect(url).toBe('https://cdn.datemate.com/assets/icons/badge_star.svg');
    });

    it('should generate correct scalable public URL for images', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ASSET_BASE_URL') return 'https://cdn.datemate.com';
        return null;
      });

      const url = service.getPublicUrl('images', 'sunset.webp');
      expect(url).toBe('https://cdn.datemate.com/assets/images/sunset.webp');
    });

    it('should generate correct scalable public URL for avatars', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ASSET_BASE_URL') return 'https://cdn.datemate.com';
        return null;
      });

      const url = service.getPublicUrl('avatars', 'user_123.webp');
      expect(url).toBe('https://cdn.datemate.com/assets/avatars/user_123.webp');
    });

    it('should reflect domain change dynamically without modifying filename', () => {
      // Step 1: Initial domain
      mockConfigService.get.mockReturnValueOnce('http://localhost:3000');
      const localUrl = service.getPublicUrl('icons', 'heart.svg');
      expect(localUrl).toBe('http://localhost:3000/assets/icons/heart.svg');

      // Step 2: Domain migration to production CDN
      mockConfigService.get.mockReturnValue('https://cdn.datemate.com');
      const cdnUrl = service.getPublicUrl('icons', 'heart.svg');
      expect(cdnUrl).toBe('https://cdn.datemate.com/assets/icons/heart.svg');
    });
  });

  describe('resolveUrl', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('http://localhost:3000');
    });

    it('should return empty string for null or empty input', () => {
      expect(service.resolveUrl(null)).toBe('');
      expect(service.resolveUrl('')).toBe('');
      expect(service.resolveUrl('   ')).toBe('');
    });

    it('should return absolute URLs untouched', () => {
      expect(service.resolveUrl('https://google.com/avatar.jpg')).toBe(
        'https://google.com/avatar.jpg',
      );
      expect(service.resolveUrl('http://cdn.external.com/photo.png')).toBe(
        'http://cdn.external.com/photo.png',
      );
    });

    it('should resolve relative asset path "/assets/avatars/user.webp"', () => {
      expect(service.resolveUrl('/assets/avatars/user.webp')).toBe(
        'http://localhost:3000/assets/avatars/user.webp',
      );
    });

    it('should resolve legacy upload path "/uploads/avatars/ali.webp"', () => {
      expect(service.resolveUrl('/uploads/avatars/ali.webp')).toBe(
        'http://localhost:3000/assets/avatars/ali.webp',
      );
    });

    it('should resolve relative storage key "icons/sparkle.svg"', () => {
      expect(service.resolveUrl('icons/sparkle.svg')).toBe(
        'http://localhost:3000/assets/icons/sparkle.svg',
      );
    });
  });

  describe('parseAssetPath', () => {
    it('should extract assetType and filename from full URL', () => {
      const parsed = service.parseAssetPath(
        'https://cdn.datemate.com/assets/icons/star_123.svg',
      );
      expect(parsed).toEqual({
        assetType: 'icons',
        filename: 'star_123.svg',
      });
    });

    it('should extract assetType and filename from relative path', () => {
      const parsed = service.parseAssetPath('/assets/avatars/user_456.webp');
      expect(parsed).toEqual({
        assetType: 'avatars',
        filename: 'user_456.webp',
      });
    });

    it('should return null for invalid paths', () => {
      expect(service.parseAssetPath('')).toBeNull();
      expect(service.parseAssetPath('/assets/')).toBeNull();
    });
  });
});
