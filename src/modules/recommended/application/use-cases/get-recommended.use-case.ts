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
  async getRankedCandidatePool(
    currentUserId: number,
    requiredCount: number = 20,
  ): Promise<RankedCandidateItem[]> {
    // 1. Check Redis cache first
    let cachedPool: RankedCandidateItem[] | null = null;
    if (this.cacheService) {
      cachedPool =
        await this.cacheService.getCachedRankedCandidates(currentUserId);
      if (cachedPool && cachedPool.length >= requiredCount) {
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
    const poolFetchLimit = Math.max(requiredCount * 5, 100);
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

    // Fallback: If not enough unswiped candidates to satisfy requiredCount, fetch swiped candidates to backfill
    if (validPrimaryCount < requiredCount && swipedIds.length > 0) {
      const existingCandidateIds = new Set(candidates.map((c) => c.id));
      const neededCount = (requiredCount - validPrimaryCount) * 5;
      const swipedCandidates =
        await this.recommendedRepository.getCandidatePool(
          targetGender,
          [currentUserId], // only exclude self
          Math.max(neededCount, 50),
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

    // Save ranked candidate list to Redis cache for 1 day (read from env)
    if (this.cacheService) {
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
    const startIndex = Math.max(0, query?.start ?? query?.offset ?? 0);
    let endIndex = startIndex + limit;
    if (query?.end !== undefined && query.end > startIndex) {
      endIndex = query.end;
    }

    const rankedCandidates = await this.getRankedCandidatePool(
      currentUserId,
      endIndex,
    );

    return rankedCandidates.slice(startIndex, endIndex).map((c) => ({
      id: c.id,
      avatarUrl: c.avatarUrl,
      age: c.age,
      city: c.city,
      username: c.username,
      fullName: c.fullName,
    }));
  }
}
