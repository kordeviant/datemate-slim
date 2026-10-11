import { Inject, Injectable } from '@nestjs/common';
import {
  IMatchingRepository,
  MATCHING_REPOSITORY,
} from '../../domain/repositories/matching.repository.interface';
import { LikedUserDto } from '../dtos/like.dto';

@Injectable()
export class GetLikesReceivedUseCase {
  constructor(
    @Inject(MATCHING_REPOSITORY)
    private readonly matchingRepository: IMatchingRepository,
  ) {}

  async execute(currentUserId: number): Promise<LikedUserDto[]> {
    const likes = await this.matchingRepository.findLikesReceived(currentUserId);

    return likes.map((l) => ({
      id: l.id,
      fullName: l.fullName,
      username: l.username,
      city: l.city,
      isOnline: l.isOnline,
    }));
  }
}
