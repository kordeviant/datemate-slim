import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AcceptFriendRequestUseCase } from './accept-friend-request.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

describe('AcceptFriendRequestUseCase', () => {
  let useCase: AcceptFriendRequestUseCase;
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

    useCase = new AcceptFriendRequestUseCase(mockRepo);
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

  it('should accept request successfully and update status to ACCEPTED', async () => {
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

    const result = await useCase.execute(1, 5);

    expect(result.status).toBe(FriendRequestStatus.ACCEPTED);
    expect(mockRepo.updateRequestStatus).toHaveBeenCalledWith(5, FriendRequestStatus.ACCEPTED);
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

    const result = await useCase.execute(1, 10);

    expect(result.status).toBe(FriendRequestStatus.ACCEPTED);
    expect(mockRepo.updateRequestStatus).toHaveBeenCalledWith(12, FriendRequestStatus.ACCEPTED);
  });
});
