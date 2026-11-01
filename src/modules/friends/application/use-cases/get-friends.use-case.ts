import { Inject, Injectable } from '@nestjs/common';
import {
  FRIEND_REPOSITORY,
  IFriendRepository,
} from '../../domain/repositories/friend.repository.interface';
import { FriendsQueryDto } from '../dtos/friends-query.dto';
import { PaginatedFriendsDataDto } from '../dtos/friend-response.dto';

@Injectable()
export class GetFriendsUseCase {
  constructor(
    @Inject(FRIEND_REPOSITORY)
    private readonly friendRepository: IFriendRepository,
  ) {}

  async execute(
    userId: number,
    query: FriendsQueryDto,
  ): Promise<PaginatedFriendsDataDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const search = query.search?.trim();

    const result = await this.friendRepository.getFriends(userId, {
      page,
      limit,
      search,
    });

    const totalPages = Math.ceil(result.total / limit) || 1;

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
      totalPages,
    };
  }
}
