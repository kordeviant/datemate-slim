import { GetFriendRequestsUseCase } from './get-friend-requests.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

describe('GetFriendRequestsUseCase', () => {
  let useCase: GetFriendRequestsUseCase;
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

    useCase = new GetFriendRequestsUseCase(mockRepo);
  });

  it('should fetch received requests with pagination and map user fields to root of item', async () => {
    mockRepo.getReceivedRequests.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          senderId: 10,
          receiverId: 5,
          status: FriendRequestStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          sender: {
            id: 10,
            fullName: 'Ali Reza',
            username: 'alireza',
            avatarUrl: 'http://avatar.webp',
            city: 'Tehran',
            isOnline: true,
          },
        },
      ],
      total: 1,
    });

    const result = await useCase.execute(5, { page: 1, limit: 10, type: 'received' });

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
    expect(result.items[0].id).toBe(1);
    expect(result.items[0].fullName).toBe('Ali Reza');
    expect(result.items[0].username).toBe('alireza');
    expect(result.items[0].avatarUrl).toBe('http://avatar.webp');
    expect((result.items[0] as any).user).toBeUndefined();
    expect((result.items[0] as any).senderId).toBeUndefined();
    expect((result.items[0] as any).receiverId).toBeUndefined();
    expect(mockRepo.getReceivedRequests).toHaveBeenCalledWith(5, {
      page: 1,
      limit: 10,
      status: undefined,
    });
  });

  it('should fetch sent requests with pagination and map user fields to root of item', async () => {
    mockRepo.getSentRequests.mockResolvedValueOnce({
      items: [
        {
          id: 2,
          senderId: 5,
          receiverId: 20,
          status: FriendRequestStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          receiver: {
            id: 20,
            fullName: 'Sara Connor',
            username: 'sarah_c',
            avatarUrl: 'http://sara.webp',
            city: 'Shiraz',
            isOnline: false,
          },
        },
      ],
      total: 25,
    });

    const result = await useCase.execute(5, { page: 2, limit: 10, type: 'sent' });

    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3);
    expect(result.items[0].id).toBe(2);
    expect(result.items[0].fullName).toBe('Sara Connor');
    expect(result.items[0].username).toBe('sarah_c');
    expect(result.items[0].avatarUrl).toBe('http://sara.webp');
    expect((result.items[0] as any).user).toBeUndefined();
    expect(mockRepo.getSentRequests).toHaveBeenCalledWith(5, {
      page: 2,
      limit: 10,
      status: undefined,
    });
  });
});
