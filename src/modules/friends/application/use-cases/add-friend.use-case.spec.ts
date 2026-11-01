import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AddFriendUseCase } from './add-friend.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';
import { IPushNotificationService } from '../../../../infrastructure/notification/push-notification.service.interface';

describe('AddFriendUseCase', () => {
  let useCase: AddFriendUseCase;
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

    useCase = new AddFriendUseCase(mockRepo, mockPushNotificationService);
  });

  it('should throw BadRequestException when trying to add self', async () => {
    await expect(useCase.execute(1, 1)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when target user does not exist', async () => {
    mockRepo.findUserById.mockResolvedValueOnce(null);

    await expect(useCase.execute(1, 2)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when target user is banned', async () => {
    mockRepo.findUserById.mockResolvedValueOnce({ id: 2, isBanned: true, fullName: 'Target' });

    await expect(useCase.execute(1, 2)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when current user is banned', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false, fullName: 'Target' })
      .mockResolvedValueOnce({ id: 1, isBanned: true, fullName: 'Current' });

    await expect(useCase.execute(1, 2)).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException when users are already friends', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false, fullName: 'Target' })
      .mockResolvedValueOnce({ id: 1, isBanned: false, fullName: 'Current' });
    mockRepo.findRequestBetweenUsers.mockResolvedValueOnce({
      id: 10,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(useCase.execute(1, 2)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when request is already pending from current user', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false, fullName: 'Target' })
      .mockResolvedValueOnce({ id: 1, isBanned: false, fullName: 'Current' });
    mockRepo.findRequestBetweenUsers.mockResolvedValueOnce({
      id: 10,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(useCase.execute(1, 2)).rejects.toThrow(BadRequestException);
  });

  it('should auto-accept and fire push notifications to both users if a reciprocal pending request exists', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false, fullName: 'Bob Builder' })
      .mockResolvedValueOnce({ id: 1, isBanned: false, fullName: 'Alice Wonder' });
    mockRepo.findRequestBetweenUsers.mockResolvedValueOnce({
      id: 10,
      senderId: 2,
      receiverId: 1,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.updateRequestStatus.mockResolvedValueOnce({
      id: 10,
      senderId: 2,
      receiverId: 1,
      status: FriendRequestStatus.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute(1, 2);

    expect(result.autoAccepted).toBe(true);
    expect(result.request.status).toBe(FriendRequestStatus.ACCEPTED);
    expect(mockRepo.updateRequestStatus).toHaveBeenCalledWith(10, FriendRequestStatus.ACCEPTED);
    expect(mockPushNotificationService.sendFriendRequestAcceptedNotification).toHaveBeenCalledTimes(2);
    expect(mockPushNotificationService.sendFriendRequestAcceptedNotification).toHaveBeenCalledWith({
      recipientUserId: 1,
      otherUserFullName: 'Bob Builder',
    });
    expect(mockPushNotificationService.sendFriendRequestAcceptedNotification).toHaveBeenCalledWith({
      recipientUserId: 2,
      otherUserFullName: 'Alice Wonder',
    });
  });

  it('should create new friend request and fire push notification on success', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false, fullName: 'Bob Builder' })
      .mockResolvedValueOnce({ id: 1, isBanned: false, fullName: 'Parsa Moloudie' });
    mockRepo.findRequestBetweenUsers.mockResolvedValueOnce(null);
    mockRepo.createRequest.mockResolvedValueOnce({
      id: 15,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute(1, 2);

    expect(result.autoAccepted).toBe(false);
    expect(result.request.id).toBe(15);
    expect(mockRepo.createRequest).toHaveBeenCalledWith(1, 2);
    expect(mockRepo.createFriendRequestNotification).toHaveBeenCalledWith(2, 1);
    expect(mockPushNotificationService.sendFriendRequestNotification).toHaveBeenCalledWith({
      recipientUserId: 2,
      senderFullName: 'Parsa Moloudie',
    });
  });
});
