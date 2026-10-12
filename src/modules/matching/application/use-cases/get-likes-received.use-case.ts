import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IMatchingRepository,
  MATCHING_REPOSITORY,
} from '../../domain/repositories/matching.repository.interface';
import { LikedUserDto } from '../dtos/like.dto';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';

@Injectable()
export class GetLikesReceivedUseCase {
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

  async execute(currentUserId: number): Promise<LikedUserDto[]> {
    const likes = await this.matchingRepository.findLikesReceived(currentUserId);

    return likes.map((l) => ({
      id: l.id,
      fullName: l.fullName,
      username: l.username,
      avatarUrl: l.avatarUrl
        ? this.mediaUrlResolver.resolveUrl(l.avatarUrl)
        : null,
      city: l.city,
      isOnline: l.isOnline,
    }));
  }
}

