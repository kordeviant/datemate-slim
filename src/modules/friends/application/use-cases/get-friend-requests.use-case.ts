import { Inject, Injectable } from '@nestjs/common';
import {
  FRIEND_REPOSITORY,
  IFriendRepository,
} from '../../domain/repositories/friend.repository.interface';
import { FriendRequestsQueryDto } from '../dtos/friend-requests-query.dto';
import { FriendItemDto, PaginatedFriendsDataDto } from '../dtos/friend-response.dto';

@Injectable()
export class GetFriendRequestsUseCase {
  constructor(
    @Inject(FRIEND_REPOSITORY)
    private readonly friendRepository: IFriendRepository,
  ) {}

  async execute(
    userId: number,
    query: FriendRequestsQueryDto,
  ): Promise<PaginatedFriendsDataDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const type = query.type || 'received';
    const status = query.status;

    let result: { items: any[]; total: number };

    if (type === 'sent') {
      result = await this.friendRepository.getSentRequests(userId, {
        page,
        limit,
        status,
      });
    } else {
      result = await this.friendRepository.getReceivedRequests(userId, {
        page,
        limit,
        status,
      });
    }

    const totalPages = Math.ceil(result.total / limit) || 1;

    const items: FriendItemDto[] = result.items.map((item) => {
      const otherUser = type === 'sent' ? item.receiver : item.sender;
      return {
        id: item.id,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        fullName: otherUser?.fullName || null,
        username: otherUser?.username || null,
        avatarUrl: otherUser?.avatarUrl || null,
      };
    });

    return {
      items,
      total: result.total,
      page,
      limit,
      totalPages,
    };
  }
}
