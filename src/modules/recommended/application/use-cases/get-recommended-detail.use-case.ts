import { Injectable, Logger } from '@nestjs/common';
import { GetRecommendedUseCase } from './get-recommended.use-case';
import { GetProfileUseCase } from '../../../auth/application/use-cases/get-profile.use-case';
import { RecommendedDetailQueryDto } from '../dtos/recommended.dto';
import { ProfileResponseDto } from '../../../auth/application/dtos/profile-response.dto';
import { RankedCandidateItem } from '../../domain/services/recommendation-algorithm.service';

@Injectable()
export class GetRecommendedDetailUseCase {
  private readonly logger = new Logger(GetRecommendedDetailUseCase.name);

  constructor(
    private readonly getRecommendedUseCase: GetRecommendedUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
  ) {}

  /**
   * Retrieves recommended candidate profiles with full details (matching /me API schema)
   * while preserving the exact cached recommendation ranking order.
   */
  async execute(
    currentUserId: number,
    query: RecommendedDetailQueryDto,
  ): Promise<ProfileResponseDto[]> {
    // Retrieve ranked candidate pool (from 1-day Redis cache if available, or compute on first request)
    const rankedCandidates =
      await this.getRecommendedUseCase.getRankedCandidatePool(
        currentUserId,
      );

    const sliced = this.sliceCandidates(rankedCandidates, query);
    if (sliced.length === 0) {
      return [];
    }

    // Retrieve detailed /me-style profiles for each candidate in the sliced slice
    const detailedProfiles = await Promise.all(
      sliced.map(async (candidate) => {
        try {
          return await this.getProfileUseCase.execute(candidate.id);
        } catch (err: any) {
          this.logger.warn(
            `Failed to retrieve profile details for candidate ${candidate.id}: ${err?.message}`,
          );
          return null;
        }
      }),
    );

    return detailedProfiles.filter(
      (profile): profile is ProfileResponseDto => profile !== null,
    );
  }

  private sliceCandidates(
    candidates: RankedCandidateItem[],
    query: RecommendedDetailQueryDto,
  ): RankedCandidateItem[] {
    const limit = query?.limit ? Math.min(Math.max(query.limit, 1), 50) : 20;

    // Anchor-based window pagination takes precedence when anchorUserId is provided
    if (query?.anchorUserId !== undefined) {
      const anchorIndex = candidates.findIndex(
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
          candidates.length,
          anchorIndex + 1 + afterCount,
        );
        return candidates.slice(startIndex, endIndex);
      }

      const startIndex = anchorIndex;
      let endIndex = startIndex + limit;
      if (query?.end !== undefined && query.end > startIndex) {
        endIndex = query.end;
      }
      return candidates.slice(startIndex, endIndex);
    }

    // Smart start resolution: support explicit candidateId, candidate ID passed in start, or numeric index
    let startIndex = 0;
    if (query?.candidateId !== undefined) {
      const matchIndex = candidates.findIndex(
        (c) => c.id === query.candidateId,
      );
      startIndex = matchIndex !== -1 ? matchIndex : 0;
    } else if (query?.start !== undefined) {
      const rawStart = query.start;
      if (rawStart >= candidates.length) {
        const matchIndex = candidates.findIndex((c) => c.id === rawStart);
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

    return candidates.slice(startIndex, endIndex);
  }
}
