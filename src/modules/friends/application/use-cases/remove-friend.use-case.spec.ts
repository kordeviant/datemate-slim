import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RemoveFriendUseCase } from './remove-friend.use-case';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';

describe('RemoveFriendUseCase', () => {
  let useCase: RemoveFriendUseCase;
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

    useCase = new RemoveFriendUseCase(mockRepo);
  });

  it('should throw BadRequestException when trying to remove self', async () => {
    await expect(useCase.execute(1, 1)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when friendship does not exist', async () => {
    mockRepo.deleteFriendship.mockResolvedValueOnce(false);

    await expect(useCase.execute(1, 205)).rejects.toThrow(NotFoundException);
  });

  it('should remove friend successfully when friendship exists', async () => {
    mockRepo.deleteFriendship.mockResolvedValueOnce(true);

    const result = await useCase.execute(1, 205);

    expect(result.success).toBe(true);
    expect(mockRepo.deleteFriendship).toHaveBeenCalledWith(1, 205);
  });
});
