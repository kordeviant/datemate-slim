import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { RankedCandidateItem } from '../../domain/services/recommendation-algorithm.service';

@Injectable()
export class RecommendedCacheService {
  private readonly logger = new Logger(RecommendedCacheService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const configuredTtl =
      this.configService.get<string>('RECOMMENDED_CACHE_TTL_SECONDS') ||
      this.configService.get<string>('RECOMMENDED_CACHE_TTL');
    const parsedTtl = configuredTtl ? parseInt(configuredTtl, 10) : NaN;
    this.ttlSeconds = !isNaN(parsedTtl) && parsedTtl > 0 ? parsedTtl : 86400; // 86400 seconds = 1 day
  }

  getTtlSeconds(): number {
    return this.ttlSeconds;
  }

  private getCacheKey(userId: number): string {
    return `recommended:ranked:${userId}`;
  }

  async getCachedRankedCandidates(
    userId: number,
  ): Promise<RankedCandidateItem[] | null> {
    try {
      const data = await this.redisService.get(this.getCacheKey(userId));
      if (!data) {
        return null;
      }
      const parsed = JSON.parse(data) as RankedCandidateItem[];
      return Array.isArray(parsed) ? parsed : null;
    } catch (err: any) {
      this.logger.warn(
        `Failed to read recommended cache for user ${userId}: ${err?.message}`,
      );
      return null;
    }
  }

  async setCachedRankedCandidates(
    userId: number,
    candidates: RankedCandidateItem[],
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const ttl = ttlSeconds ?? this.ttlSeconds;
      await this.redisService.set(
        this.getCacheKey(userId),
        JSON.stringify(candidates),
        ttl,
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to set recommended cache for user ${userId}: ${err?.message}`,
      );
    }
  }

  async clearCachedRankedCandidates(userId: number): Promise<void> {
    try {
      await this.redisService.del(this.getCacheKey(userId));
    } catch (err: any) {
      this.logger.warn(
        `Failed to clear recommended cache for user ${userId}: ${err?.message}`,
      );
    }
  }
}
