import { RecommendedCacheService } from './recommended-cache.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('RecommendedCacheService', () => {
  let service: RecommendedCacheService;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'RECOMMENDED_CACHE_TTL') return '86400';
        return undefined;
      }),
    } as any;

    service = new RecommendedCacheService(mockRedisService, mockConfigService);
  });

  it('reads TTL from environment configuration (defaults to 86400 = 1 day)', () => {
    expect(service.getTtlSeconds()).toBe(86400);

    const customConfig = {
      get: jest.fn().mockReturnValue('43200'),
    } as any;
    const customService = new RecommendedCacheService(
      mockRedisService,
      customConfig,
    );
    expect(customService.getTtlSeconds()).toBe(43200);
  });

  it('returns cached candidates when present in Redis', async () => {
    const cachedData = [
      {
        id: 101,
        avatarUrl: 'https://cdn/101.webp',
        age: 25,
        city: 'Tehran',
        username: 'sara',
        fullName: 'Sara C',
        compatibilityScore: 90,
        isOnline: true,
        lastSeenAt: null,
        isSwiped: false,
      },
    ];
    mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));

    const result = await service.getCachedRankedCandidates(1);
    expect(result).toEqual(cachedData);
    expect(mockRedisService.get).toHaveBeenCalledWith('recommended:ranked:1');
  });

  it('returns null when cache misses or data is invalid', async () => {
    mockRedisService.get.mockResolvedValue(null);
    const result = await service.getCachedRankedCandidates(1);
    expect(result).toBeNull();
  });

  it('handles Redis error gracefully without throwing', async () => {
    mockRedisService.get.mockRejectedValue(new Error('Redis connection failure'));
    const result = await service.getCachedRankedCandidates(1);
    expect(result).toBeNull();
  });

  it('sets cache with configured 1-day TTL', async () => {
    const data: any = [{ id: 101 }];
    mockRedisService.set.mockResolvedValue('OK' as any);

    await service.setCachedRankedCandidates(1, data);
    expect(mockRedisService.set).toHaveBeenCalledWith(
      'recommended:ranked:1',
      JSON.stringify(data),
      86400,
    );
  });

  it('clears cached candidates', async () => {
    mockRedisService.del.mockResolvedValue(1);
    await service.clearCachedRankedCandidates(1);
    expect(mockRedisService.del).toHaveBeenCalledWith('recommended:ranked:1');
  });
});
