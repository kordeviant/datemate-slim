import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FRIEND_REPOSITORY,
  IFriendRepository,
} from '../../domain/repositories/friend.repository.interface';

@Injectable()
export class RemoveFriendUseCase {
  constructor(
    @Inject(FRIEND_REPOSITORY)
    private readonly friendRepository: IFriendRepository,
  ) {}

  async execute(
    currentUserId: number,
    friendUserId: number,
  ): Promise<{ success: boolean; message: string }> {
    if (currentUserId === friendUserId) {
      throw new BadRequestException('Cannot remove yourself as a friend');
    }

    const removed = await this.friendRepository.deleteFriendship(
      currentUserId,
      friendUserId,
    );

    if (!removed) {
      throw new NotFoundException('Friendship not found');
    }

    return {
      success: true,
      message: 'Friend removed successfully',
    };
  }
}
