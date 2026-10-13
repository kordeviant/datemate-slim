import { PrismaRecommendedRepository } from './prisma-recommended.repository';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import { ConfigService } from '@nestjs/config';

describe('PrismaRecommendedRepository', () => {
  let repository: PrismaRecommendedRepository;
  let mockPrisma: any;
  let mockRedisService: any;
  let mockRedisClient: any;
  const originalAssetBaseUrl = process.env.ASSET_BASE_URL;
  const originalMediaBaseUrl = process.env.MEDIA_BASE_URL;
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    process.env.ASSET_BASE_URL = 'http://localhost:3000';
    delete process.env.MEDIA_BASE_URL;
    delete process.env.APP_BASE_URL;
    process.env.APP_URL = 'http://localhost:3000';

    mockRedisClient = {
      smembers: jest.fn().mockResolvedValue([]),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      swipe: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'ASSET_BASE_URL') return 'http://localhost:3000';
        if (key === 'PORT') return 3000;
        return defaultValue;
      }),
    } as unknown as ConfigService;
    const mediaUrlResolver = new MediaUrlResolverService(mockConfigService);

    repository = new PrismaRecommendedRepository(
      mockPrisma as PrismaService,
      mockRedisService as RedisService,
      mediaUrlResolver,
    );
  });

  afterAll(() => {
    if (originalAssetBaseUrl !== undefined) {
      process.env.ASSET_BASE_URL = originalAssetBaseUrl;
    } else {
      delete process.env.ASSET_BASE_URL;
    }
    if (originalMediaBaseUrl !== undefined) {
      process.env.MEDIA_BASE_URL = originalMediaBaseUrl;
    } else {
      delete process.env.MEDIA_BASE_URL;
    }
    if (originalAppBaseUrl !== undefined) {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    } else {
      delete process.env.APP_BASE_URL;
    }
    if (originalAppUrl !== undefined) {
      process.env.APP_URL = originalAppUrl;
    } else {
      delete process.env.APP_URL;
    }
  });

  describe('getUserProfile', () => {
    it('returns null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.getUserProfile(999);
      expect(result).toBeNull();
    });

    it('returns mapped user recommendation profile with answers and interests', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        bannedUntil: null,
        demographic: {
          gender: 'MALE',
          birthDate: new Date('1995-01-01'),
          cityId: 10,
          city: { name: 'Tehran' },
        },
        preferences: {
          relation: 'LONG',
        },
        interests: [
          { interestId: 1, interest: { nameEn: 'Music', nameFa: 'موسیقی' } },
          { interestId: 2, interest: { nameEn: 'Art', nameFa: 'هنر' } },
        ],
        questionAnswers: [
          { questionAnswerId: 101 },
          { questionAnswerId: 102 },
        ],
      });

      const result = await repository.getUserProfile(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.gender).toBe('MALE');
      expect(result?.cityName).toBe('Tehran');
      expect(result?.relationPreference).toBe('LONG');
      expect(result?.answerIds).toEqual([101, 102]);
      expect(result?.interestIds).toEqual([1, 2]);
      expect(result?.interestNames).toEqual(['Music', 'Art']);
    });
  });

  describe('getSwipedUserIds', () => {
    it('merges swipe records from DB and Redis', async () => {
      mockPrisma.swipe.findMany.mockResolvedValue([
        { toUserId: 10 },
        { toUserId: 11 },
      ]);
      mockRedisClient.smembers.mockResolvedValue(['11', '12']);

      const result = await repository.getSwipedUserIds(1);

      expect(result.sort()).toEqual([10, 11, 12]);
      expect(mockRedisClient.smembers).toHaveBeenCalledWith('swiped:1');
    });

    it('handles Redis error gracefully', async () => {
      mockPrisma.swipe.findMany.mockResolvedValue([{ toUserId: 5 }]);
      mockRedisClient.smembers.mockRejectedValue(new Error('Redis connection failed'));

      const result = await repository.getSwipedUserIds(1);
      expect(result).toEqual([5]);
    });
  });

  describe('getCandidatePool', () => {
    it('queries and maps candidate pool items matching target gender and exclusions', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 2,
          profileValidated: true,
          profile: {
            fullName: 'Sara Connor',
            username: 'sara_c',
            bio: 'Artist',
            avatarUrl: 'https://example.com/avatar.jpg',
            profilePictureUrl: 'https://example.com/pic.jpg',
            isOnline: true,
            lastSeenAt: new Date(),
          },
          demographic: {
            gender: 'FEMALE',
            birthDate: new Date('1998-05-15'),
            cityId: 10,
            city: { name: 'Tehran' },
          },
          preferences: {
            relation: 'LONG',
          },
          gallery: [
            { id: 1, imageUrl: 'https://example.com/g1.jpg', isProfilePicture: true },
          ],
          interests: [
            { interestId: 1, interest: { nameEn: 'Music', nameFa: 'موسیقی' } },
          ],
          questionAnswers: [
            { questionAnswerId: 101 },
          ],
        },
      ]);

      const candidates = await repository.getCandidatePool('FEMALE', [1, 99], 50);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe(2);
      expect(candidates[0].fullName).toBe('Sara Connor');
      expect(candidates[0].cityName).toBe('Tehran');
      expect(candidates[0].answerIds).toEqual([101]);
      expect(candidates[0].interestIds).toEqual([1]);
      expect(candidates[0].gallery[0].imageUrl).toBe('https://example.com/g1.jpg');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: [1, 99] },
            demographic: { gender: 'FEMALE' },
            profileValidated: true,
          }),
        }),
      );
    });

    it('resolves relative avatarUrl, profilePictureUrl, and gallery imageUrl into full public URLs', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 3,
          profileValidated: true,
          profile: {
            fullName: 'Jane Doe',
            username: 'janedoe',
            avatarUrl: 'avatars/avatarbe9c29b29330.webp',
            profilePictureUrl: 'avatars/profile_pic.webp',
            isOnline: true,
            lastSeenAt: new Date(),
          },
          demographic: {
            gender: 'FEMALE',
            birthDate: new Date('1998-05-15'),
            cityId: 10,
            city: { name: 'Tehran' },
          },
          preferences: null,
          gallery: [
            { id: 1, imageUrl: 'images/gallery_1.webp', isProfilePicture: true },
          ],
          interests: [],
          questionAnswers: [],
        },
      ]);

      const candidates = await repository.getCandidatePool('FEMALE', [], 10);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].avatarUrl).toBe(
        'http://localhost:3000/assets/avatars/avatarbe9c29b29330.webp',
      );
      expect(candidates[0].profilePictureUrl).toBe(
        'http://localhost:3000/assets/avatars/profile_pic.webp',
      );
      expect(candidates[0].gallery[0].imageUrl).toBe(
        'http://localhost:3000/assets/images/gallery_1.webp',
      );
    });

    it('does not require selfieUrl but enforces profileValidated: true', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 30,
          profileValidated: true,
          profile: {
            fullName: 'Validated Without Selfie',
            username: 'valid_noselfie',
            avatarUrl: 'https://example.com/avatar.jpg',
            profilePictureUrl: null,
            selfieUrl: null,
            isOnline: true,
            lastSeenAt: new Date(),
          },
          demographic: {
            gender: 'FEMALE',
            birthDate: new Date('1998-05-15'),
            cityId: 10,
            city: { name: 'Tehran' },
          },
          preferences: null,
          gallery: [],
          interests: [],
          questionAnswers: [],
        },
      ]);

      const candidates = await repository.getCandidatePool('FEMALE', [], 10);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            profileValidated: true,
          }),
        }),
      );
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe(30);
    });
  });
});
