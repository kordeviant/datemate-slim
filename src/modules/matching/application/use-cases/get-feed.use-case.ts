import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  IMatchingRepository,
  MATCHING_REPOSITORY,
} from '../../domain/repositories/matching.repository.interface';
import { FeedDataDto, FeedQueryDto } from '../dtos/feed.dto';

@Injectable()
export class GetFeedUseCase {
  constructor(
    @Inject(MATCHING_REPOSITORY)
    private readonly matchingRepository: IMatchingRepository,
  ) {}

  async execute(
    currentUserId: number,
    queryDto?: FeedQueryDto,
  ): Promise<FeedDataDto> {
    const limit = Math.min(Math.max(queryDto?.limit ?? 20, 1), 50);

    // Rule 6: Get current user's gender to determine target gender
    const userGender = await this.matchingRepository.getUserDemographicGender(
      currentUserId,
    );

    if (!userGender) {
      throw new BadRequestException(
        'Please complete your profile demographic gender before viewing the feed',
      );
    }

    // Gender filter: if male -> send female; if female -> send male
    const targetGender: 'MALE' | 'FEMALE' =
      userGender === 'MALE' ? 'FEMALE' : 'MALE';

    // Fetch candidate profiles satisfying all 6 rules
    const candidates = await this.matchingRepository.findCandidateProfiles(
      currentUserId,
      targetGender,
      limit,
    );

    return {
      candidates: candidates.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        fullName: c.fullName,
        age: c.age,
        gender: c.gender,
        bio: c.bio,
        avatarUrl: c.avatarUrl,
        profileValidated: c.profileValidated,
        gallery: c.gallery,
        interests: c.interests,
        city: c.city,
        isOnline: c.isOnline,
        lastSeenAt: c.lastSeenAt,
      })),
      count: candidates.length,
    };
  }
}
