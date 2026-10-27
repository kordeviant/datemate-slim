import { UnauthorizedException } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendRequestStatus } from '../domain/enums/friend-request-status.enum';

describe('FriendsController', () => {
  let controller: FriendsController;
  let addFriendUseCase: any;
  let getFriendRequestsUseCase: any;
  let acceptFriendRequestUseCase: any;
  let rejectFriendRequestUseCase: any;
  let cancelFriendRequestUseCase: any;
  let getFriendsUseCase: any;
  let removeFriendUseCase: any;
  let tokenService: any;

  beforeEach(() => {
    addFriendUseCase = { execute: jest.fn() };
    getFriendRequestsUseCase = { execute: jest.fn() };
    acceptFriendRequestUseCase = { execute: jest.fn() };
    rejectFriendRequestUseCase = { execute: jest.fn() };
    cancelFriendRequestUseCase = { execute: jest.fn() };
    getFriendsUseCase = { execute: jest.fn() };
    removeFriendUseCase = { execute: jest.fn() };
    tokenService = {
      verifyAccessToken: jest.fn().mockResolvedValue({ sub: 10 }),
    };

    controller = new FriendsController(
      addFriendUseCase,
      getFriendRequestsUseCase,
      acceptFriendRequestUseCase,
      rejectFriendRequestUseCase,
      cancelFriendRequestUseCase,
      getFriendsUseCase,
      removeFriendUseCase,
      tokenService,
    );
  });

  describe('addFriend', () => {
    it('should add friend / send friend request successfully and return flat item', async () => {
      addFriendUseCase.execute.mockResolvedValueOnce({
        request: {
          id: 1,
          senderId: 10,
          receiverId: 205,
          status: FriendRequestStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          receiver: {
            id: 205,
            fullName: 'Sara Connor',
            username: 'sarah_c',
            avatarUrl: 'http://avatar.webp',
          },
        },
        message: 'Friend request sent successfully',
        autoAccepted: false,
      });

      const res = await controller.addFriend(
        { userId: 205 },
        { user: { sub: 10 } },
      );

      expect(res.status).toBe('success');
      expect(res.message).toBe('Friend request sent successfully');
      expect(res.data.id).toBe(1);
      expect(res.data.fullName).toBe('Sara Connor');
      expect(res.data.username).toBe('sarah_c');
      expect(res.data.avatarUrl).toBe('http://avatar.webp');
      expect((res.data as any).senderId).toBeUndefined();
      expect((res.data as any).receiverId).toBeUndefined();
      expect((res.data as any).user).toBeUndefined();
      expect(addFriendUseCase.execute).toHaveBeenCalledWith(10, 205);
    });

    it('should extract userId from authorization header when req.user is absent', async () => {
      addFriendUseCase.execute.mockResolvedValueOnce({
        request: {
          id: 1,
          senderId: 10,
          receiverId: 205,
          status: FriendRequestStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: 'Friend request sent successfully',
        autoAccepted: false,
      });

      const res = await controller.addFriend(
        { userId: 205 },
        {},
        'Bearer valid_token',
      );

      expect(res.status).toBe('success');
      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('valid_token');
      expect(addFriendUseCase.execute).toHaveBeenCalledWith(10, 205);
    });

    it('should throw UnauthorizedException when no user info or auth header present', async () => {
      await expect(
        controller.addFriend({ userId: 205 }, {}, undefined),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getFriendRequests', () => {
    it('should return paginated friend requests', async () => {
      getFriendRequestsUseCase.execute.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const res = await controller.getFriendRequests(
        { page: 1, limit: 10, type: 'received' },
        { user: { sub: 10 } },
      );

      expect(res.status).toBe('success');
      expect(res.message).toBe('Friend requests retrieved successfully');
      expect(getFriendRequestsUseCase.execute).toHaveBeenCalledWith(10, {
        page: 1,
        limit: 10,
        type: 'received',
      });
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept friend request and return flat item', async () => {
      acceptFriendRequestUseCase.execute.mockResolvedValueOnce({
        id: 5,
        senderId: 20,
        receiverId: 10,
        status: FriendRequestStatus.ACCEPTED,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: 20,
          fullName: 'Ali Reza',
          username: 'alireza',
          avatarUrl: 'http://ali.webp',
        },
      });

      const res = await controller.acceptFriendRequest(5, { user: { sub: 10 } });

      expect(res.status).toBe('success');
      expect(res.message).toBe('Friend request accepted successfully');
      expect(res.data.id).toBe(5);
      expect(res.data.status).toBe(FriendRequestStatus.ACCEPTED);
      expect(res.data.fullName).toBe('Ali Reza');
      expect(res.data.username).toBe('alireza');
      expect(acceptFriendRequestUseCase.execute).toHaveBeenCalledWith(10, 5);
    });
  });

  describe('rejectFriendRequest', () => {
    it('should reject friend request and return flat item', async () => {
      rejectFriendRequestUseCase.execute.mockResolvedValueOnce({
        id: 5,
        senderId: 20,
        receiverId: 10,
        status: FriendRequestStatus.REJECTED,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: 20,
          fullName: 'Ali Reza',
          username: 'alireza',
          avatarUrl: 'http://ali.webp',
        },
      });

      const res = await controller.rejectFriendRequest(5, { user: { sub: 10 } });

      expect(res.status).toBe('success');
      expect(res.message).toBe('Friend request rejected successfully');
      expect(res.data.id).toBe(5);
      expect(res.data.status).toBe(FriendRequestStatus.REJECTED);
      expect(rejectFriendRequestUseCase.execute).toHaveBeenCalledWith(10, 5);
    });
  });

  describe('cancelFriendRequest', () => {
    it('should cancel friend request and return flat item', async () => {
      cancelFriendRequestUseCase.execute.mockResolvedValueOnce({
        id: 5,
        senderId: 10,
        receiverId: 20,
        status: FriendRequestStatus.CANCELLED,
        createdAt: new Date(),
        updatedAt: new Date(),
        receiver: {
          id: 20,
          fullName: 'Sara Connor',
          username: 'sarah_c',
          avatarUrl: 'http://sara.webp',
        },
      });

      const res = await controller.cancelFriendRequest(5, { user: { sub: 10 } });

      expect(res.status).toBe('success');
      expect(res.message).toBe('Friend request cancelled successfully');
      expect(res.data.id).toBe(5);
      expect(res.data.status).toBe(FriendRequestStatus.CANCELLED);
      expect(res.data.fullName).toBe('Sara Connor');
      expect(res.data.username).toBe('sarah_c');
      expect(cancelFriendRequestUseCase.execute).toHaveBeenCalledWith(10, 5);
    });
  });

  describe('getFriends', () => {
    it('should return paginated friends list', async () => {
      getFriendsUseCase.execute.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const res = await controller.getFriends(
        { page: 1, limit: 10 },
        { user: { sub: 10 } },
      );

      expect(res.status).toBe('success');
      expect(res.message).toBe('Friends retrieved successfully');
      expect(getFriendsUseCase.execute).toHaveBeenCalledWith(10, {
        page: 1,
        limit: 10,
      });
    });
  });

  describe('removeFriend', () => {
    it('should remove friend and return success message', async () => {
      removeFriendUseCase.execute.mockResolvedValueOnce({
        success: true,
        message: 'Friend removed successfully',
      });

      const res = await controller.removeFriend(205, { user: { sub: 10 } });

      expect(res.status).toBe('success');
      expect(res.message).toBe('Friend removed successfully');
      expect(removeFriendUseCase.execute).toHaveBeenCalledWith(10, 205);
    });
  });
});
