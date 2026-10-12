import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidatePoolItem,
  UserRecommendationProfile,
} from '../repositories/recommended.repository.interface';
import { calculateAge } from '../../../auth/application/validators/dob.validator';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';

export interface RecommendationWeights {
  questionOverlap: number;
  interestsOverlap: number;
  cityMatch: number;
  relationMatch: number;
  ageProximity: number;
}

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  questionOverlap: 35,
  interestsOverlap: 25,
  cityMatch: 20,
  relationMatch: 10,
  ageProximity: 10,
};

export interface RankedCandidateItem {
  id: number;
  avatarUrl: string | null;
  age: number | null;
  city: string | null;
  username: string | null;
  fullName: string | null;
  compatibilityScore: number;
  isOnline: boolean;
  lastSeenAt: Date | null;
  isSwiped: boolean;
}

@Injectable()
export class RecommendationAlgorithmService {
  private readonly mediaUrlResolver: MediaUrlResolverService;

  constructor(
    @Optional()
    mediaUrlResolver?: MediaUrlResolverService,
  ) {
    this.mediaUrlResolver =
      mediaUrlResolver || new MediaUrlResolverService(new ConfigService());
  }

  /**
   * Evaluates question answers overlap between current user and candidate.
   * Default weight: 35 points max.
   */
  calculateQuestionScore(
    currentUserAnswers: number[],
    candidateAnswers: number[],
    maxWeight: number = DEFAULT_RECOMMENDATION_WEIGHTS.questionOverlap,
  ): number {
    if (!currentUserAnswers || currentUserAnswers.length === 0) {
      // Baseline neutral score when current user has not yet answered questions
      return Math.min(15, maxWeight);
    }

    const userAnswerSet = new Set(currentUserAnswers);
    let sharedAnswersCount = 0;
    for (const ansId of candidateAnswers || []) {
      if (userAnswerSet.has(ansId)) {
        sharedAnswersCount++;
      }
    }

    const questionRatio = sharedAnswersCount / currentUserAnswers.length;
    return Math.min(maxWeight, Math.round(questionRatio * maxWeight));
  }

  /**
   * Evaluates shared interests overlap between current user and candidate.
   * Default weight: 25 points max.
   */
  calculateInterestScore(
    currentUserInterests: number[],
    candidateInterests: number[],
    maxWeight: number = DEFAULT_RECOMMENDATION_WEIGHTS.interestsOverlap,
  ): number {
    if (!currentUserInterests || currentUserInterests.length === 0) {
      // Baseline neutral score when current user has no interests configured yet
      return Math.min(10, maxWeight);
    }

    const userInterestSet = new Set(currentUserInterests);
    let sharedInterestsCount = 0;
    for (const intId of candidateInterests || []) {
      if (userInterestSet.has(intId)) {
        sharedInterestsCount++;
      }
    }

    const interestRatio = sharedInterestsCount / currentUserInterests.length;
    return Math.min(maxWeight, Math.round(interestRatio * maxWeight));
  }

  /**
   * Evaluates city match between current user and candidate.
   * Default weight: 20 points for exact city match, 0 otherwise.
   */
  calculateCityScore(
    currentCityId: number | null,
    candidateCityId: number | null,
    maxWeight: number = DEFAULT_RECOMMENDATION_WEIGHTS.cityMatch,
  ): number {
    if (
      currentCityId !== null &&
      candidateCityId !== null &&
      currentCityId === candidateCityId
    ) {
      return maxWeight;
    }
    return 0;
  }

  /**
   * Evaluates relationship goal alignment (e.g. LONG, FUN, OPEN).
   * Default weight: 10 points for exact match, 0 otherwise.
   */
  calculateRelationScore(
    currentRelation: string | null,
    candidateRelation: string | null,
    maxWeight: number = DEFAULT_RECOMMENDATION_WEIGHTS.relationMatch,
  ): number {
    if (
      currentRelation &&
      candidateRelation &&
      currentRelation === candidateRelation
    ) {
      return maxWeight;
    }
    return 0;
  }

  /**
   * Evaluates age proximity between current user and candidate.
   * <= 3 yrs: 10 pts, <= 6 yrs: 6 pts, <= 10 yrs: 3 pts, > 10 yrs: 0 pts.
   * Neutral baseline: 5 pts if age unavailable.
   */
  calculateAgeScore(
    currentUserAge: number | null,
    candidateAge: number | null,
    maxWeight: number = DEFAULT_RECOMMENDATION_WEIGHTS.ageProximity,
  ): number {
    if (currentUserAge === null || candidateAge === null) {
      return Math.min(5, maxWeight);
    }

    const diff = Math.abs(currentUserAge - candidateAge);
    if (diff <= 3) {
      return maxWeight;
    }
    if (diff <= 6) {
      return Math.min(6, maxWeight);
    }
    if (diff <= 10) {
      return Math.min(3, maxWeight);
    }
    return 0;
  }

  /**
   * Computes overall compatibility score (0 - 100) for a candidate.
   */
  calculateCandidateScore(
    currentUser: UserRecommendationProfile,
    candidate: CandidatePoolItem,
    weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
  ): number {
    const currentUserAge = currentUser.birthDate
      ? calculateAge(currentUser.birthDate)
      : null;
    const candidateAge = candidate.birthDate
      ? calculateAge(candidate.birthDate)
      : null;

    const questionScore = this.calculateQuestionScore(
      currentUser.answerIds,
      candidate.answerIds,
      weights.questionOverlap,
    );
    const interestScore = this.calculateInterestScore(
      currentUser.interestIds,
      candidate.interestIds,
      weights.interestsOverlap,
    );
    const cityScore = this.calculateCityScore(
      currentUser.cityId,
      candidate.cityId,
      weights.cityMatch,
    );
    const relationScore = this.calculateRelationScore(
      currentUser.relationPreference,
      candidate.relationPreference,
      weights.relationMatch,
    );
    const ageScore = this.calculateAgeScore(
      currentUserAge,
      candidateAge,
      weights.ageProximity,
    );

    return Math.min(
      100,
      Math.max(
        0,
        questionScore + interestScore + cityScore + relationScore + ageScore,
      ),
    );
  }

  /**
   * Resolves the primary photo URL for a candidate.
   */
  resolveCandidatePhoto(candidate: CandidatePoolItem): string | null {
    return (
      candidate.avatarUrl ||
      candidate.profilePictureUrl ||
      candidate.gallery?.find((g) => g.isProfilePicture)?.imageUrl ||
      candidate.gallery?.[0]?.imageUrl ||
      null
    );
  }

  /**
   * Filters and ranks candidate pool by the recommendation algorithm.
   */
  rankCandidates(
    currentUser: UserRecommendationProfile,
    candidates: CandidatePoolItem[],
    swipedIds: number[],
    weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
  ): RankedCandidateItem[] {
    const scoredCandidates: RankedCandidateItem[] = [];

    for (const candidate of candidates) {
      // Hygiene Rule 4: Candidate must have an active photo
      const rawPhoto = this.resolveCandidatePhoto(candidate);
      if (!rawPhoto || !rawPhoto.trim()) {
        continue;
      }

      // Hygiene Rule 5: Candidate profile must be validated
      if (!candidate.profileValidated) {
        continue;
      }

      const compatibilityScore = this.calculateCandidateScore(
        currentUser,
        candidate,
        weights,
      );
      const candidateAge = candidate.birthDate
        ? calculateAge(candidate.birthDate)
        : null;
      const resolvedAvatarUrl = this.mediaUrlResolver.resolveUrl(rawPhoto);
      const isCandidateSwiped = swipedIds.includes(candidate.id);

      scoredCandidates.push({
        id: candidate.id,
        avatarUrl: resolvedAvatarUrl,
        age: candidateAge,
        city: candidate.cityName,
        username: candidate.username,
        fullName: candidate.fullName,
        compatibilityScore,
        isOnline: candidate.isOnline,
        lastSeenAt: candidate.lastSeenAt,
        isSwiped: isCandidateSwiped,
      });
    }

    // Rank candidates:
    // 1. Unswiped candidates prioritized over swiped fallback
    // 2. Compatibility score descending
    // 3. Online status descending
    // 4. Activity (lastSeenAt) descending
    // 5. User ID ascending
    scoredCandidates.sort((a, b) => {
      if (a.isSwiped !== b.isSwiped) {
        return a.isSwiped ? 1 : -1;
      }
      if (b.compatibilityScore !== a.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      if (b.isOnline !== a.isOnline) {
        return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
      }
      const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      return a.id - b.id;
    });

    return scoredCandidates;
  }
}
