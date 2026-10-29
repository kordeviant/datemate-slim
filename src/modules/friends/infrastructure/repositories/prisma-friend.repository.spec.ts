import { PrismaFriendRepository } from './prisma-friend.repository';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

describe('PrismaFriendRepository', () => {
  let repository: PrismaFriendRepository;
  let mockPrisma: any;
  let mockMediaResolver: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      friendRequest: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
    };

    mockMediaResolver = {
      resolveUrl: jest.fn((url: string) => `http://resolved/${url}`),
    };

    repository = new PrismaFriendRepository(mockPrisma, mockMediaResolver);
  });

  describe('findUserById', () => {
    it('should return null when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await repository.findUserById(99);
      expect(result).toBeNull();
    });

    it('should return user status with isBanned true if bannedUntil in the future', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 10,
        bannedUntil: new Date(Date.now() + 100000),
      });

      const result = await repository.findUserById(10);
      expect(result).toEqual({ id: 10, isBanned: true, fullName: 'Unknown name' });
    });

    it('should return user status with isBanned false if bannedUntil is null', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 10,
        bannedUntil: null,
      });

      const result = await repository.findUserById(10);
      expect(result).toEqual({ id: 10, isBanned: false, fullName: 'Unknown name' });
    });
  });

  describe('createRequest', () => {
    it('should upsert friend request with PENDING status', async () => {
      mockPrisma.friendRequest.upsert.mockResolvedValueOnce({
        id: 1,
        senderId: 10,
        receiverId: 20,
        status: FriendRequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.createRequest(10, 20);
      expect(result.id).toBe(1);
      expect(result.status).toBe(FriendRequestStatus.PENDING);
      expect(mockPrisma.friendRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            senderId_receiverId: { senderId: 10, receiverId: 20 },
          },
        }),
      );
    });
  });

  describe('findRequestById', () => {
    it('should return null if request does not exist', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValueOnce(null);

      const result = await repository.findRequestById(123);
      expect(result).toBeNull();
    });

    it('should return mapped entity if request exists', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValueOnce({
        id: 123,
        senderId: 10,
        receiverId: 20,
        status: FriendRequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.findRequestById(123);
      expect(result?.id).toBe(123);
    });
  });

  describe('getReceivedRequests', () => {
    it('should return paginated received requests', async () => {
      mockPrisma.friendRequest.findMany.mockResolvedValueOnce([
        {
          id: 1,
          senderId: 10,
          receiverId: 20,
          status: FriendRequestStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          sender: {
            id: 10,
            profile: { fullName: 'Ali', username: 'ali', avatarUrl: 'avatar.png' },
            demographic: { city: { name: 'Tehran' } },
            gallery: [],
          },
        },
      ]);
      mockPrisma.friendRequest.count.mockResolvedValueOnce(1);

      const result = await repository.getReceivedRequests(20, { page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.items[0].sender?.city).toBe('Tehran');
    });
  });

  describe('getFriends', () => {
    it('should return paginated accepted friends list with flat item shape', async () => {
      mockPrisma.friendRequest.findMany.mockResolvedValueOnce([
        {
          id: 1,
          senderId: 10,
          receiverId: 20,
          status: FriendRequestStatus.ACCEPTED,
          createdAt: new Date(),
          updatedAt: new Date(),
          sender: {
            id: 10,
            profile: { fullName: 'User 10' },
            demographic: { city: { name: 'Tehran' } },
            gallery: [],
          },
          receiver: {
            id: 20,
            profile: { fullName: 'User 20', username: 'user_20' },
            demographic: { city: { name: 'Isfahan' } },
            gallery: [],
          },
        },
      ]);
      mockPrisma.friendRequest.count.mockResolvedValueOnce(1);

      // When querying for user 10, the friend returned is User 20
      const result = await repository.getFriends(10, { page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe(1);
      expect(result.items[0].status).toBe(FriendRequestStatus.ACCEPTED);
      expect(result.items[0].fullName).toBe('User 20');
      expect(result.items[0].username).toBe('user_20');
    });
  });

  describe('deleteFriendship', () => {
    it('should return false if friendship is not found', async () => {
      mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const result = await repository.deleteFriendship(10, 20);
      expect(result).toBe(false);
    });

    it('should delete friendship and return true when found', async () => {
      mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({ id: 5 });
      mockPrisma.friendRequest.delete.mockResolvedValueOnce({ id: 5 });

      const result = await repository.deleteFriendship(10, 20);
      expect(result).toBe(true);
      expect(mockPrisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });
});
