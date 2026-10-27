import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AddFriendUseCase } from './add-friend.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

describe('AddFriendUseCase', () => {
  let useCase: AddFriendUseCase;
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

    useCase = new AddFriendUseCase(mockRepo);
  });

  it('should throw BadRequestException when trying to add self', async () => {
    await expect(useCase.execute(1, 1)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when target user does not exist', async () => {
    mockRepo.findUserById.mockResolvedValueOnce(null);

    await expect(useCase.execute(1, 2)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when target user is banned', async () => {
    mockRepo.findUserById.mockResolvedValueOnce({ id: 2, isBanned: true });

    await expect(useCase.execute(1, 2)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when current user is banned', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false })
      .mockResolvedValueOnce({ id: 1, isBanned: true });

    await expect(useCase.execute(1, 2)).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException when users are already friends', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false })
      .mockResolvedValueOnce({ id: 1, isBanned: false });
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
      .mockResolvedValueOnce({ id: 2, isBanned: false })
      .mockResolvedValueOnce({ id: 1, isBanned: false });
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

  it('should auto-accept if a reciprocal pending request already exists from target user', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false })
      .mockResolvedValueOnce({ id: 1, isBanned: false });
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
  });

  it('should create new friend request and fire notification on success', async () => {
    mockRepo.findUserById
      .mockResolvedValueOnce({ id: 2, isBanned: false })
      .mockResolvedValueOnce({ id: 1, isBanned: false });
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
  });
});
