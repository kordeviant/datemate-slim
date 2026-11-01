import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CancelFriendRequestUseCase } from './cancel-friend-request.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

describe('CancelFriendRequestUseCase', () => {
  let useCase: CancelFriendRequestUseCase;
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

    useCase = new CancelFriendRequestUseCase(mockRepo);
  });

  it('should throw NotFoundException when request is not found', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce(null);
    mockRepo.findRequestBetweenUsers.mockResolvedValueOnce(null);

    await expect(useCase.execute(1, 99)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user is not the sender', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce({
      id: 5,
      senderId: 2, // Current user is 1, not 2
      receiverId: 1,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(useCase.execute(1, 5)).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if request has already been accepted', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce({
      id: 5,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(useCase.execute(1, 5)).rejects.toThrow(BadRequestException);
  });

  it('should return request if already CANCELLED', async () => {
    const existing = {
      id: 5,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.CANCELLED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.findRequestById.mockResolvedValueOnce(existing);

    const result = await useCase.execute(1, 5);
    expect(result.status).toBe(FriendRequestStatus.CANCELLED);
    expect(mockRepo.updateRequestStatus).not.toHaveBeenCalled();
  });

  it('should cancel pending request successfully and update status to CANCELLED', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce({
      id: 5,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockRepo.updateRequestStatus.mockResolvedValueOnce({
      id: 5,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.CANCELLED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute(1, 5);

    expect(result.status).toBe(FriendRequestStatus.CANCELLED);
    expect(mockRepo.updateRequestStatus).toHaveBeenCalledWith(5, FriendRequestStatus.CANCELLED);
  });

  it('should fallback to target receiver userId lookup if request not found by ID', async () => {
    mockRepo.findRequestById.mockResolvedValueOnce(null);
    mockRepo.findRequestBetweenUsers.mockResolvedValueOnce({
      id: 15,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepo.updateRequestStatus.mockResolvedValueOnce({
      id: 15,
      senderId: 1,
      receiverId: 2,
      status: FriendRequestStatus.CANCELLED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute(1, 2);

    expect(result.status).toBe(FriendRequestStatus.CANCELLED);
    expect(mockRepo.updateRequestStatus).toHaveBeenCalledWith(15, FriendRequestStatus.CANCELLED);
  });
});
