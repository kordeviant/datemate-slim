import { Injectable, Logger } from '@nestjs/common';
import { GetRecommendedUseCase } from './get-recommended.use-case';
import { GetProfileUseCase } from '../../../auth/application/use-cases/get-profile.use-case';
import { RecommendedDetailQueryDto } from '../dtos/recommended.dto';
import { ProfileResponseDto } from '../../../auth/application/dtos/profile-response.dto';

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
    const limit = query?.limit ? Math.min(Math.max(query.limit, 1), 50) : 20;
    const startIndex = Math.max(0, query?.start ?? query?.offset ?? 0);
    let endIndex = startIndex + limit;
    if (query?.end !== undefined && query.end > startIndex) {
      endIndex = query.end;
    }

    // Retrieve ranked candidate pool (from 1-day Redis cache if available, or compute)
    const rankedCandidates =
      await this.getRecommendedUseCase.getRankedCandidatePool(
        currentUserId,
        endIndex,
      );

    const sliced = rankedCandidates.slice(startIndex, endIndex);
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
}
