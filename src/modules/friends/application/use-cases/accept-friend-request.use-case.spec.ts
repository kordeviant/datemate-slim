import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AcceptFriendRequestUseCase } from './accept-friend-request.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';
import { IPushNotificationService } from '../../../../infrastructure/notification/push-notification.service.interface';

describe('AcceptFriendRequestUseCase', () => {
  let useCase: AcceptFriendRequestUseCase;
  let mockRepo: jest.Mocked<IFriendRepository>;
  let mockPushNotificationService: jest.Mocked<IPushNotificationService>;

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

    mockPushNotificationService = {
      sendPush: jest.fn(),
      sendFriendRequestNotification: jest.fn(),
      sendFriendRequestAcceptedNotification: jest.fn(),
      sendLikeUserNotification: jest.fn(),
      sendSelfieAcceptedNotification: jest.fn(),
      sendSelfieRejectedNotification: jest.fn(),
    };

    useCase = new AcceptFriendRequestUseCase(
      mockRepo,
      mockPushNotificationService,
    );
  });

  it('should throw NotFoundException when request is not found', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce(null);
    mockRepo.findRequestBetweenUsers.mockResolvedValueOnce(null);

    await expect(useCase.execute(1, 99)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user is not the receiver', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce({
      id: 5,
      senderId: 10,
      receiverId: 2, // Current user is 1, not 2
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(useCase.execute(1, 5)).rejects.toThrow(ForbiddenException);
  });

  it('should return request if already ACCEPTED', async () => {
    const existing = {
      id: 5,
      senderId: 10,
      receiverId: 1,
      status: FriendRequestStatus.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.findRequestById.mockResolvedValueOnce(existing);

    const result = await useCase.execute(1, 5);
    expect(result.status).toBe(FriendRequestStatus.ACCEPTED);
    expect(mockRepo.updateRequestStatus).not.toHaveBeenCalled();
    expect(
      mockPushNotificationService.sendFriendRequestAcceptedNotification,
    ).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException if request was CANCELLED', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce({
      id: 5,
      senderId: 10,
      receiverId: 1,
      status: FriendRequestStatus.CANCELLED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(useCase.execute(1, 5)).rejects.toThrow(BadRequestException);
  });

  it('should accept request successfully, update status to ACCEPTED and fire push notifications to both users', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce({
      id: 5,
      senderId: 10,
      receiverId: 1,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockRepo.updateRequestStatus.mockResolvedValueOnce({
      id: 5,
      senderId: 10,
      receiverId: 1,
      status: FriendRequestStatus.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 10, isBanned: false, fullName: 'Sender User' })
      .mockResolvedValueOnce({ id: 1, isBanned: false, fullName: 'Receiver User' });

    const result = await useCase.execute(1, 5);

    expect(result.status).toBe(FriendRequestStatus.ACCEPTED);
    expect(mockRepo.updateRequestStatus).toHaveBeenCalledWith(
      5,
      FriendRequestStatus.ACCEPTED,
    );
    expect(
      mockPushNotificationService.sendFriendRequestAcceptedNotification,
    ).toHaveBeenCalledTimes(2);
    expect(
      mockPushNotificationService.sendFriendRequestAcceptedNotification,
    ).toHaveBeenCalledWith({
      recipientUserId: 10,
      otherUserFullName: 'Receiver User',
    });
    expect(
      mockPushNotificationService.sendFriendRequestAcceptedNotification,
    ).toHaveBeenCalledWith({
      recipientUserId: 1,
      otherUserFullName: 'Sender User',
    });
  });

  it('should fallback to lookup by sender userId if request not found by ID', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce(null);
    mockRepo.findRequestBetweenUsers.mockResolvedValueOnce({
      id: 12,
      senderId: 10,
      receiverId: 1,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.updateRequestStatus.mockResolvedValueOnce({
      id: 12,
      senderId: 10,
      receiverId: 1,
      status: FriendRequestStatus.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 10, isBanned: false, fullName: 'Sender User' })
      .mockResolvedValueOnce({ id: 1, isBanned: false, fullName: 'Receiver User' });

    const result = await useCase.execute(1, 10);

    expect(result.status).toBe(FriendRequestStatus.ACCEPTED);
    expect(mockRepo.updateRequestStatus).toHaveBeenCalledWith(
      12,
      FriendRequestStatus.ACCEPTED,
    );
    expect(
      mockPushNotificationService.sendFriendRequestAcceptedNotification,
    ).toHaveBeenCalledTimes(2);
  });
});
