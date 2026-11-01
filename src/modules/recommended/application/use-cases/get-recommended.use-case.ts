import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IRecommendedRepository,
  RECOMMENDED_REPOSITORY,
} from '../../domain/repositories/recommended.repository.interface';
import {
  RecommendedCandidateDto,
  RecommendedQueryDto,
} from '../dtos/recommended.dto';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import {
  RankedCandidateItem,
  RecommendationAlgorithmService,
} from '../../domain/services/recommendation-algorithm.service';
import { RecommendedCacheService } from '../services/recommended-cache.service';

@Injectable()
export class GetRecommendedUseCase {
  private readonly mediaUrlResolver: MediaUrlResolverService;
  private readonly algorithmService: RecommendationAlgorithmService;

  constructor(
    @Inject(RECOMMENDED_REPOSITORY)
    private readonly recommendedRepository: IRecommendedRepository,
    @Optional()
    mediaUrlResolver?: MediaUrlResolverService,
    @Optional()
    algorithmService?: RecommendationAlgorithmService,
    @Optional()
    private readonly cacheService?: RecommendedCacheService,
  ) {
    this.mediaUrlResolver =
      mediaUrlResolver || new MediaUrlResolverService(new ConfigService());
    this.algorithmService =
      algorithmService ||
      new RecommendationAlgorithmService(this.mediaUrlResolver);
  }

  /**
   * Retrieves or computes the ranked candidate pool for a user.
   * If cached in Redis (with 1-day TTL from env), retrieves from cache.
   * Otherwise, executes the recommendation algorithm and caches the result.
   */
  /**
   * Retrieves or computes the ranked candidate pool for a user.
   * If cached in Redis (with 1-day TTL from env), retrieves from cache.
   * Only if the cache has expired (or on first request), it computes the
   * candidate pool and saves to Redis for 1 day. Subsequent requests during
   * the TTL will never re-generate or query the database automatically.
   */
  async getRankedCandidatePool(
    currentUserId: number,
  ): Promise<RankedCandidateItem[]> {
    // 1. Check Redis cache first. If cached (not expired), return cached pool immediately!
    if (this.cacheService) {
      const cachedPool =
        await this.cacheService.getCachedRankedCandidates(currentUserId);
      if (cachedPool !== null) {
        return cachedPool;
      }
    }

    // 2. Fetch current user recommendation profile
    const currentUser =
      await this.recommendedRepository.getUserProfile(currentUserId);
    if (!currentUser) {
      throw new NotFoundException('User profile not found');
    }

    // Rule 3: Account Status check for current user
    if (currentUser.bannedUntil && currentUser.bannedUntil > new Date()) {
      throw new ForbiddenException('Account is suspended');
    }

    // Rule 6: Current user must have gender demographic set
    if (
      !currentUser.gender ||
      (currentUser.gender !== 'MALE' && currentUser.gender !== 'FEMALE')
    ) {
      throw new BadRequestException(
        'Gender demographic must be completed to retrieve recommendations',
      );
    }

    const targetGender: 'MALE' | 'FEMALE' =
      currentUser.gender === 'MALE' ? 'FEMALE' : 'MALE';

    // Rule 1 & Rule 2: Exclude self and swiped candidates
    const swipedIds =
      await this.recommendedRepository.getSwipedUserIds(currentUserId);
    const excludedIds = Array.from(new Set([currentUserId, ...swipedIds]));

    // Fetch primary candidate pool (excluding self and swiped candidates)
    const poolFetchLimit = 100;
    const candidates = await this.recommendedRepository.getCandidatePool(
      targetGender,
      excludedIds,
      poolFetchLimit,
    );

    // Count valid primary candidates (must have photo and profileValidated)
    const validPrimaryCount = candidates.filter(
      (c) =>
        c.profileValidated &&
        Boolean(this.algorithmService.resolveCandidatePhoto(c)),
    ).length;

    // Fallback: If not enough unswiped candidates to satisfy target, fetch swiped candidates to backfill
    if (validPrimaryCount < 20 && swipedIds.length > 0) {
      const existingCandidateIds = new Set(candidates.map((c) => c.id));
      const swipedCandidates =
        await this.recommendedRepository.getCandidatePool(
          targetGender,
          [currentUserId], // only exclude self
          50,
        );

      for (const sc of swipedCandidates) {
        if (!existingCandidateIds.has(sc.id) && swipedIds.includes(sc.id)) {
          candidates.push(sc);
          existingCandidateIds.add(sc.id);
        }
      }
    }

    // Rank candidates using the isolated recommendation algorithm
    const rankedCandidates = this.algorithmService.rankCandidates(
      currentUser,
      candidates,
      swipedIds,
    );

    // Save ranked candidate list to Redis cache for 1 day (read from env) on first request / expiry
    if (this.cacheService && rankedCandidates.length > 0) {
      await this.cacheService.setCachedRankedCandidates(
        currentUserId,
        rankedCandidates,
      );
    }

    return rankedCandidates;
  }

  async execute(
    currentUserId: number,
    query: RecommendedQueryDto,
  ): Promise<RecommendedCandidateDto[]> {
    const limit = query?.limit ? Math.min(Math.max(query.limit, 1), 50) : 20;

    const rankedCandidates = await this.getRankedCandidatePool(
      currentUserId,
    );

    let sliced: RankedCandidateItem[] = [];

    // Anchor-based window pagination takes precedence when anchorUserId is provided
    if (query?.anchorUserId !== undefined) {
      const anchorIndex = rankedCandidates.findIndex(
        (c) => c.id === query.anchorUserId,
      );
      if (anchorIndex === -1) {
        return [];
      }

      if (query.before !== undefined || query.after !== undefined) {
        const beforeCount =
          query.before !== undefined ? Math.max(0, query.before) : 0;
        const afterCount =
          query.after !== undefined ? Math.max(0, query.after) : 0;
        const startIndex = Math.max(0, anchorIndex - beforeCount);
        const endIndex = Math.min(
          rankedCandidates.length,
          anchorIndex + 1 + afterCount,
        );
        sliced = rankedCandidates.slice(startIndex, endIndex);
      } else {
        const startIndex = anchorIndex;
        let endIndex = startIndex + limit;
        if (query?.end !== undefined && query.end > startIndex) {
          endIndex = query.end;
        }
        sliced = rankedCandidates.slice(startIndex, endIndex);
      }
    } else {
      // Smart start resolution: support explicit candidateId, candidate ID passed in start, or numeric index
      let startIndex = 0;
      if (query?.candidateId !== undefined) {
        const matchIndex = rankedCandidates.findIndex(
          (c) => c.id === query.candidateId,
        );
        startIndex = matchIndex !== -1 ? matchIndex : 0;
      } else if (query?.start !== undefined) {
        const rawStart = query.start;
        if (rawStart >= rankedCandidates.length) {
          const matchIndex = rankedCandidates.findIndex((c) => c.id === rawStart);
          startIndex = matchIndex !== -1 ? matchIndex : rawStart;
        } else {
          startIndex = Math.max(0, rawStart);
        }
      } else if (query?.offset !== undefined) {
        startIndex = Math.max(0, query.offset);
      }

      let endIndex = startIndex + limit;
      if (query?.end !== undefined && query.end > startIndex) {
        endIndex = query.end;
      }

      sliced = rankedCandidates.slice(startIndex, endIndex);
    }

    return sliced.map((c) => ({
      id: c.id,
      avatarUrl: c.avatarUrl,
      age: c.age,
      city: c.city,
      username: c.username,
      fullName: c.fullName,
    }));
  }
}
