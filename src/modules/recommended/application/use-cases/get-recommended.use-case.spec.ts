import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GetRecommendedUseCase } from './get-recommended.use-case';
import {
  CandidatePoolItem,
  IRecommendedRepository,
  UserRecommendationProfile,
} from '../../domain/repositories/recommended.repository.interface';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import { ConfigService } from '@nestjs/config';

describe('GetRecommendedUseCase', () => {
  let useCase: GetRecommendedUseCase;
  let mockRepository: jest.Mocked<IRecommendedRepository>;
  const originalAssetBaseUrl = process.env.ASSET_BASE_URL;
  const originalMediaBaseUrl = process.env.MEDIA_BASE_URL;
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalAppUrl = process.env.APP_URL;

  const baseCurrentUser: UserRecommendationProfile = {
    id: 1,
    gender: 'MALE',
    birthDate: new Date('1998-05-15'),
    cityId: 10,
    cityName: 'Tehran',
    relationPreference: 'LONG',
    answerIds: [101, 102, 103],
    interestIds: [1, 2, 3],
    interestNames: ['Music', 'Art', 'Coffee'],
    bannedUntil: null,
  };

  beforeEach(() => {
    process.env.ASSET_BASE_URL = 'http://localhost:3000';
    delete process.env.MEDIA_BASE_URL;
    delete process.env.APP_BASE_URL;
    process.env.APP_URL = 'http://localhost:3000';

    mockRepository = {
      getUserProfile: jest.fn(),
      getSwipedUserIds: jest.fn(),
      getCandidatePool: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'ASSET_BASE_URL') return 'http://localhost:3000';
        if (key === 'PORT') return 3000;
        return defaultValue;
      }),
    } as unknown as ConfigService;
    const mediaUrlResolver = new MediaUrlResolverService(mockConfigService);

    useCase = new GetRecommendedUseCase(mockRepository, mediaUrlResolver);
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

  it('should throw NotFoundException if current user profile does not exist', async () => {
    mockRepository.getUserProfile.mockResolvedValue(null);

    await expect(useCase.execute(1, { limit: 20 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ForbiddenException if current user is banned', async () => {
    mockRepository.getUserProfile.mockResolvedValue({
      ...baseCurrentUser,
      bannedUntil: new Date(Date.now() + 100000),
    });

    await expect(useCase.execute(1, { limit: 20 })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw BadRequestException if gender demographic is not completed', async () => {
    mockRepository.getUserProfile.mockResolvedValue({
      ...baseCurrentUser,
      gender: null as any,
    });

    await expect(useCase.execute(1, { limit: 20 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should exclude self and already swiped candidate IDs', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([5, 8]);
    mockRepository.getCandidatePool.mockResolvedValue([]);

    await useCase.execute(1, { limit: 20 });

    expect(mockRepository.getCandidatePool).toHaveBeenCalledWith(
      'FEMALE',
      expect.arrayContaining([1, 5, 8]),
      100,
    );
  });

  it('should filter out candidates without photos or unvalidated profiles and return only the 5 fields', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([]);

    const candidateNoPhoto: CandidatePoolItem = {
      id: 2,
      fullName: 'No Photo User',
      username: 'nophoto',
      gender: 'FEMALE',
      birthDate: new Date('1999-01-01'),
      bio: null,
      avatarUrl: null,
      profilePictureUrl: null,
      profileValidated: true,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: false,
      lastSeenAt: null,
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    };

    const candidateUnvalidated: CandidatePoolItem = {
      id: 3,
      fullName: 'Unvalidated User',
      username: 'unvalidated',
      gender: 'FEMALE',
      birthDate: new Date('1999-01-01'),
      bio: null,
      avatarUrl: 'https://example.com/photo.jpg',
      profilePictureUrl: 'https://example.com/photo.jpg',
      profileValidated: false,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: false,
      lastSeenAt: null,
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    };

    const validCandidate: CandidatePoolItem = {
      id: 4,
      fullName: 'Valid User',
      username: 'valid',
      gender: 'FEMALE',
      birthDate: new Date('1998-05-15'),
      bio: 'Hello world',
      avatarUrl: 'https://example.com/valid.jpg',
      profilePictureUrl: 'https://example.com/valid.jpg',
      profileValidated: true,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: true,
      lastSeenAt: new Date(),
      gallery: [{ id: 10, imageUrl: 'https://example.com/valid.jpg', isProfilePicture: true }],
      interestNames: ['Music'],
      interestIds: [1],
      answerIds: [101],
    };

    mockRepository.getCandidatePool.mockResolvedValue([
      candidateNoPhoto,
      candidateUnvalidated,
      validCandidate,
    ]);

    const result = await useCase.execute(1, { limit: 20 });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 4,
      avatarUrl: 'https://example.com/valid.jpg',
      age: expect.any(Number),
      city: 'Tehran',
      username: 'valid',
      fullName: 'Valid User',
    });
  });

  it('should dynamically score candidates by question answers, interests, city, goal and age, ranking top candidates first', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([]);

    // Candidate 1: High match (all answers match, all interests match, same city, same goal, same age)
    const highMatch: CandidatePoolItem = {
      id: 10,
      fullName: 'High Match',
      username: 'high',
      gender: 'FEMALE',
      birthDate: new Date('1998-05-15'), // same age (28)
      bio: 'Passionate artist',
      avatarUrl: 'https://example.com/high.jpg',
      profilePictureUrl: 'https://example.com/high.jpg',
      profileValidated: true,
      cityId: 10, // same city
      cityName: 'Tehran',
      relationPreference: 'LONG', // same goal
      isOnline: true,
      lastSeenAt: new Date(),
      gallery: [{ id: 1, imageUrl: 'https://example.com/high.jpg', isProfilePicture: true }],
      interestNames: ['Music', 'Art', 'Coffee'],
      interestIds: [1, 2, 3], // 3/3 interests match
      answerIds: [101, 102, 103], // 3/3 answers match
    };

    // Candidate 2: Low match (different city, different relation goal, no shared answers, different age)
    const lowMatch: CandidatePoolItem = {
      id: 20,
      fullName: 'Low Match',
      username: 'low',
      gender: 'FEMALE',
      birthDate: new Date('1980-01-01'), // age diff > 10
      bio: 'Traveller',
      avatarUrl: 'https://example.com/low.jpg',
      profilePictureUrl: 'https://example.com/low.jpg',
      profileValidated: true,
      cityId: 99, // different city
      cityName: 'Shiraz',
      relationPreference: 'FUN', // different goal
      isOnline: false,
      lastSeenAt: null,
      gallery: [{ id: 2, imageUrl: 'https://example.com/low.jpg', isProfilePicture: true }],
      interestNames: ['Sports'],
      interestIds: [99],
      answerIds: [999],
    };

    mockRepository.getCandidatePool.mockResolvedValue([lowMatch, highMatch]);

    const result = await useCase.execute(1, { limit: 20 });

    expect(result).toHaveLength(2);
    // highMatch should be ranked first
    expect(result[0]).toEqual({
      id: 10,
      avatarUrl: 'https://example.com/high.jpg',
      age: expect.any(Number),
      city: 'Tehran',
      username: 'high',
      fullName: 'High Match',
    });

    // lowMatch should be ranked second
    expect(result[1]).toEqual({
      id: 20,
      avatarUrl: 'https://example.com/low.jpg',
      age: expect.any(Number),
      city: 'Shiraz',
      username: 'low',
      fullName: 'Low Match',
    });
  });

  it('should respect requested limit parameter', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([]);

    const pool: CandidatePoolItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: 100 + i,
      fullName: `User ${i}`,
      username: `user_${i}`,
      gender: 'FEMALE',
      birthDate: new Date('1998-01-01'),
      bio: null,
      avatarUrl: `https://example.com/user_${i}.jpg`,
      profilePictureUrl: `https://example.com/user_${i}.jpg`,
      profileValidated: true,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: false,
      lastSeenAt: null,
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    }));

    mockRepository.getCandidatePool.mockResolvedValue(pool);

    const result = await useCase.execute(1, { limit: 10 });
    expect(result).toHaveLength(10);
  });

  it('should resolve relative avatar paths into full public URLs', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([]);

    const candidateRelativeAvatar: CandidatePoolItem = {
      id: 50,
      fullName: 'Relative Avatar User',
      username: 'rel_user',
      gender: 'FEMALE',
      birthDate: new Date('1998-05-15'),
      bio: null,
      avatarUrl: 'avatars/avatarbe9c29b29330.webp',
      profilePictureUrl: null,
      profileValidated: true,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: true,
      lastSeenAt: new Date(),
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    };

    mockRepository.getCandidatePool.mockResolvedValue([candidateRelativeAvatar]);

    const result = await useCase.execute(1, { limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].avatarUrl).toBe(
      'http://localhost:3000/assets/avatars/avatarbe9c29b29330.webp',
    );
  });

  it('should backfill swiped candidates when unswiped candidates are fewer than limit, ranking unswiped candidates first', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([99]);

    const unswipedCandidate: CandidatePoolItem = {
      id: 70,
      fullName: 'Unswiped User',
      username: 'unswiped',
      gender: 'FEMALE',
      birthDate: new Date('1998-05-15'),
      bio: null,
      avatarUrl: 'https://example.com/unswiped.jpg',
      profilePictureUrl: 'https://example.com/unswiped.jpg',
      profileValidated: true,
      cityId: 99, // low match
      cityName: 'Shiraz',
      relationPreference: 'FUN',
      isOnline: false,
      lastSeenAt: null,
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    };

    const swipedCandidate: CandidatePoolItem = {
      id: 99,
      fullName: 'Swiped User',
      username: 'swiped',
      gender: 'FEMALE',
      birthDate: new Date('1998-05-15'),
      bio: null,
      avatarUrl: 'https://example.com/swiped.jpg',
      profilePictureUrl: 'https://example.com/swiped.jpg',
      profileValidated: true,
      cityId: 10, // high match
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: true,
      lastSeenAt: new Date(),
      gallery: [],
      interestNames: ['Music', 'Art', 'Coffee'],
      interestIds: [1, 2, 3],
      answerIds: [101, 102, 103],
    };

    // First call: excluding [1, 99] returns unswipedCandidate (count = 1 < limit 10)
    // Second call: excluding [1] returns [swipedCandidate]
    mockRepository.getCandidatePool
      .mockResolvedValueOnce([unswipedCandidate])
      .mockResolvedValueOnce([swipedCandidate]);

    const result = await useCase.execute(1, { limit: 10 });

    expect(result).toHaveLength(2);
    // Unswiped candidate must come first even if swiped candidate has higher compatibility
    expect(result[0].id).toBe(70);
    expect(result[1].id).toBe(99);
  });

  it('supports start and limit pagination', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([]);

    const pool: CandidatePoolItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: 100 + i,
      fullName: `User ${i}`,
      username: `user_${i}`,
      gender: 'FEMALE',
      birthDate: new Date('1998-01-01'),
      bio: null,
      avatarUrl: `https://example.com/user_${i}.jpg`,
      profilePictureUrl: `https://example.com/user_${i}.jpg`,
      profileValidated: true,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: false,
      lastSeenAt: null,
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    }));

    mockRepository.getCandidatePool.mockResolvedValue(pool);

    // start from index 3, limit 2
    const result = await useCase.execute(1, { start: 3, limit: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(103);
    expect(result[1].id).toBe(104);
  });

  it('uses cached candidate ranking if present in RecommendedCacheService', async () => {
    const mockCacheService = {
      getCachedRankedCandidates: jest.fn().mockResolvedValue([
        {
          id: 555,
          avatarUrl: 'https://cdn/555.webp',
          age: 26,
          city: 'Tehran',
          username: 'cached_user',
          fullName: 'Cached User',
          compatibilityScore: 99,
          isOnline: true,
          lastSeenAt: null,
          isSwiped: false,
        },
      ]),
      setCachedRankedCandidates: jest.fn(),
    } as any;

    const cachedUseCase = new GetRecommendedUseCase(
      mockRepository,
      undefined,
      undefined,
      mockCacheService,
    );

    const result = await cachedUseCase.execute(1, { limit: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(555);
    // Repository should not be queried when cache is valid
    expect(mockRepository.getUserProfile).not.toHaveBeenCalled();
    expect(mockCacheService.getCachedRankedCandidates).toHaveBeenCalledWith(1);
  });

  it('does not re-query database when cache is active, and only generates and caches on first request/expiry', async () => {
    const mockCacheService = {
      getCachedRankedCandidates: jest.fn().mockResolvedValue([
        {
          id: 555,
          avatarUrl: 'https://cdn/555.webp',
          age: 26,
          city: 'Tehran',
          username: 'cached_user',
          fullName: 'Cached User',
          compatibilityScore: 99,
          isOnline: true,
          lastSeenAt: null,
          isSwiped: false,
        },
      ]), // cached item
      setCachedRankedCandidates: jest.fn(),
    } as any;

    const cachedUseCase = new GetRecommendedUseCase(
      mockRepository,
      undefined,
      undefined,
      mockCacheService,
    );

    // Request start 0, limit 20 -> cache is active, so database is NOT queried
    const result = await cachedUseCase.execute(1, { start: 0, limit: 20 });

    expect(mockRepository.getUserProfile).not.toHaveBeenCalled();
    expect(mockCacheService.setCachedRankedCandidates).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(555);
  });

  describe('anchor-based window pagination (anchorUserId, before, after)', () => {
    it('returns window around anchorUserId with before and after', async () => {
      const mockCacheService = {
        getCachedRankedCandidates: jest.fn().mockResolvedValue([
          { id: 10, fullName: 'User 10' },
          { id: 20, fullName: 'User 20' },
          { id: 30, fullName: 'User 30' },
          { id: 40, fullName: 'User 40' },
          { id: 50, fullName: 'User 50' },
        ]),
        setCachedRankedCandidates: jest.fn(),
      } as any;

      const cachedUseCase = new GetRecommendedUseCase(
        mockRepository,
        undefined,
        undefined,
        mockCacheService,
      );

      const result = await cachedUseCase.execute(1, {
        anchorUserId: 30,
        before: 1,
        after: 1,
      });

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual([20, 30, 40]);
    });

    it('returns empty array if anchorUserId is not found in candidate pool', async () => {
      const mockCacheService = {
        getCachedRankedCandidates: jest.fn().mockResolvedValue([
          { id: 10, fullName: 'User 10' },
        ]),
        setCachedRankedCandidates: jest.fn(),
      } as any;

      const cachedUseCase = new GetRecommendedUseCase(
        mockRepository,
        undefined,
        undefined,
        mockCacheService,
      );

      const result = await cachedUseCase.execute(1, {
        anchorUserId: 999,
        before: 10,
        after: 10,
      });

      expect(result).toEqual([]);
    });
  });
});
