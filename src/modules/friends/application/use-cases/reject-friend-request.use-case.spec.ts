import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RejectFriendRequestUseCase } from './reject-friend-request.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

describe('RejectFriendRequestUseCase', () => {
  let useCase: RejectFriendRequestUseCase;
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

    useCase = new RejectFriendRequestUseCase(mockRepo);
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
      receiverId: 2,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(useCase.execute(1, 5)).rejects.toThrow(ForbiddenException);
  });

  it('should reject request successfully and update status to REJECTED', async () => {
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
      status: FriendRequestStatus.REJECTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute(1, 5);

    expect(result.status).toBe(FriendRequestStatus.REJECTED);
    expect(mockRepo.updateRequestStatus).toHaveBeenCalledWith(5, FriendRequestStatus.REJECTED);
  });
});
