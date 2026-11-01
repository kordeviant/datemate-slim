import { GetFriendsUseCase } from './get-friends.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

describe('GetFriendsUseCase', () => {
  let useCase: GetFriendsUseCase;
  let mockRepo: jest.Mocked<IFriendRepository>;

  beforeEach(() => {
    mockRepo = {
      findUserById: jest.fn(),
      createRequest: jest.fn(),
      findRequestById: jest.fn(),
      findRequestBetweenUsers: jest.fn(),
      updateRequestStatus: jest.fn(),
      getReceivedRequests: jest.fn(),
      getSentRequests: jest.fn(),
      getFriends: jest.fn(),
      deleteFriendship: jest.fn(),
      createFriendRequestNotification: jest.fn(),
    };

    useCase = new GetFriendsUseCase(mockRepo);
  });

  it('should fetch friends list with pagination and flat item shape', async () => {
    mockRepo.getFriends.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          status: FriendRequestStatus.ACCEPTED,
          createdAt: new Date(),
          updatedAt: new Date(),
          fullName: 'Sara Connor',
          username: 'sarah_c',
          avatarUrl: 'http://avatar.webp',
        },
      ],
      total: 12,
    });

    const result = await useCase.execute(1, { page: 1, limit: 10, search: 'sara' });

    expect(result.total).toBe(12);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(2);
    expect(result.items[0].id).toBe(1);
    expect(result.items[0].status).toBe(FriendRequestStatus.ACCEPTED);
    expect(result.items[0].fullName).toBe('Sara Connor');
    expect(result.items[0].username).toBe('sarah_c');
    expect(result.items[0].avatarUrl).toBe('http://avatar.webp');
    expect(mockRepo.getFriends).toHaveBeenCalledWith(1, {
      page: 1,
      limit: 10,
      search: 'sara',
    });
  });
});
