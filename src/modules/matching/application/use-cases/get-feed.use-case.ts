import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IMatchingRepository,
  MATCHING_REPOSITORY,
} from '../../domain/repositories/matching.repository.interface';
import { FeedDataDto, FeedQueryDto } from '../dtos/feed.dto';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';

@Injectable()
export class GetFeedUseCase {
  private readonly mediaUrlResolver: MediaUrlResolverService;

  constructor(
    @Inject(MATCHING_REPOSITORY)
    private readonly matchingRepository: IMatchingRepository,
    @Optional()
    mediaUrlResolver?: MediaUrlResolverService,
  ) {
    this.mediaUrlResolver =
      mediaUrlResolver || new MediaUrlResolverService(new ConfigService());
  }

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
      candidates: candidates.map((c) => {
        const profilePictureGallery = c.gallery?.find(
          (g) => g.isProfilePicture,
        );
        const candidatePhoto = profilePictureGallery?.imageUrl || c.avatarUrl;

        const resolvedPhoto = candidatePhoto
          ? this.mediaUrlResolver.resolveUrl(candidatePhoto)
          : null;

        return {
          id: c.id,
          fullName: c.fullName,
          city: c.city,
          age: c.age,
          profilePicture: resolvedPhoto,
          username: c.username,
        };
      }),
      count: candidates.length,
    };

  }
}
