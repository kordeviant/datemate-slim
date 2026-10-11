import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IRecommendedRepository,
  RECOMMENDED_REPOSITORY,
  CandidatePoolItem,
} from '../../domain/repositories/recommended.repository.interface';
import { RecommendedCandidateEntity } from '../../domain/entities/recommended-candidate.entity';
import {
  RecommendedCandidateDto,
  RecommendedQueryDto,
} from '../dtos/recommended.dto';
import { calculateAge } from '../../../auth/application/validators/dob.validator';

@Injectable()
export class GetRecommendedUseCase {
  constructor(
    @Inject(RECOMMENDED_REPOSITORY)
    private readonly recommendedRepository: IRecommendedRepository,
  ) {}

  async execute(
    currentUserId: number,
    query: RecommendedQueryDto,
  ): Promise<RecommendedCandidateDto[]> {
    const limit = query?.limit ? Math.min(Math.max(query.limit, 1), 50) : 20;

    // 1. Fetch current user recommendation profile
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
    if (!currentUser.gender || (currentUser.gender !== 'MALE' && currentUser.gender !== 'FEMALE')) {
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

    // Fetch candidate pool (fetch enough candidates to score and rank)
    const poolFetchLimit = Math.max(limit * 5, 100);
    const candidates = await this.recommendedRepository.getCandidatePool(
      targetGender,
      excludedIds,
      poolFetchLimit,
    );

    const scoredCandidates: RecommendedCandidateEntity[] = [];

    const currentUserAge = currentUser.birthDate
      ? calculateAge(currentUser.birthDate)
      : null;
    const userAnswerSet = new Set(currentUser.answerIds);
    const userInterestSet = new Set(currentUser.interestIds);

    for (const c of candidates) {
      // Rule 4: Must have an active photo
      const primaryPhoto =
        c.profilePictureUrl ||
        c.avatarUrl ||
        c.gallery.find((g) => g.isProfilePicture)?.imageUrl ||
        c.gallery[0]?.imageUrl ||
        null;

      if (!primaryPhoto || !primaryPhoto.trim()) {
        continue;
      }

      // Rule 5: Profile must be validated
      if (!c.profileValidated) {
        continue;
      }

      const candidateAge = c.birthDate ? calculateAge(c.birthDate) : null;

      // 1. Dynamic Question & Lifestyle Answers Overlap (Weight: 35)
      let sharedAnswersCount = 0;
      for (const ansId of c.answerIds) {
        if (userAnswerSet.has(ansId)) {
          sharedAnswersCount++;
        }
      }
      let questionScore = 15; // baseline when current user has not answered questions yet
      if (currentUser.answerIds.length > 0) {
        const questionRatio = sharedAnswersCount / currentUser.answerIds.length;
        questionScore = Math.min(35, Math.round(questionRatio * 35));
      }

      // 2. Shared Interests Overlap (Weight: 25)
      const sharedInterests: string[] = [];
      let sharedInterestsCount = 0;
      for (let i = 0; i < c.interestIds.length; i++) {
        const intId = c.interestIds[i];
        if (userInterestSet.has(intId)) {
          sharedInterestsCount++;
          if (c.interestNames[i]) {
            sharedInterests.push(c.interestNames[i]);
          }
        }
      }
      let interestScore = 10; // baseline when current user has no interests yet
      if (currentUser.interestIds.length > 0) {
        const interestRatio =
          sharedInterestsCount / currentUser.interestIds.length;
        interestScore = Math.min(25, Math.round(interestRatio * 25));
      }

      // 3. City Match (Weight: 20)
      const sameCity = Boolean(
        currentUser.cityId && c.cityId && currentUser.cityId === c.cityId,
      );
      const cityScore = sameCity ? 20 : 0;

      // 4. Relationship Goal Match (Weight: 10)
      const sameRelationGoal = Boolean(
        currentUser.relationPreference &&
          c.relationPreference &&
          currentUser.relationPreference === c.relationPreference,
      );
      const relationScore = sameRelationGoal ? 10 : 0;

      // 5. Age Proximity (Weight: 10)
      let ageScore = 5; // neutral baseline if age unavailable
      if (currentUserAge !== null && candidateAge !== null) {
        const diff = Math.abs(currentUserAge - candidateAge);
        if (diff <= 3) {
          ageScore = 10;
        } else if (diff <= 6) {
          ageScore = 6;
        } else if (diff <= 10) {
          ageScore = 3;
        } else {
          ageScore = 0;
        }
      }

      // Final Combined Compatibility Score (0 - 100)
      const compatibilityScore = Math.min(
        100,
        Math.max(
          0,
          questionScore + interestScore + cityScore + relationScore + ageScore,
        ),
      );

      const galleryUrls = c.gallery
        .map((g) => g.imageUrl)
        .filter((url) => !!url && url.trim().length > 0);

      const firstName = c.fullName ? c.fullName.split(' ')[0] : null;

      scoredCandidates.push({
        id: c.id,
        firstName,
        fullName: c.fullName,
        username: c.username,
        age: candidateAge,
        gender: c.gender,
        bio: c.bio,
        avatarUrl: primaryPhoto,
        profileValidated: c.profileValidated,
        gallery: galleryUrls,
        interests: c.interestNames,
        city: c.cityName,
        isOnline: c.isOnline,
        lastSeenAt: c.lastSeenAt,
        compatibilityScore,
        sharedInterests,
        sharedAnswersCount,
        sameCity,
        sameRelationGoal,
      });
    }

    // Rank candidates by compatibility score descending, then activity, then id
    scoredCandidates.sort((a, b) => {
      if (b.compatibilityScore !== a.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      if (b.isOnline !== a.isOnline) {
        return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
      }
      const aTime = a.lastSeenAt ? a.lastSeenAt.getTime() : 0;
      const bTime = b.lastSeenAt ? b.lastSeenAt.getTime() : 0;
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      return a.id - b.id;
    });

    return scoredCandidates.slice(0, limit);
  }
}
