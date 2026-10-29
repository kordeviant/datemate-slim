import { GetLikesReceivedUseCase } from './get-likes-received.use-case';
import { IMatchingRepository } from '../../domain/repositories/matching.repository.interface';
import { LikeReceivedEntity } from '../../domain/entities/like-received.entity';

describe('GetLikesReceivedUseCase', () => {
  let useCase: GetLikesReceivedUseCase;
  let mockMatchingRepository: jest.Mocked<IMatchingRepository>;

  beforeEach(() => {
    mockMatchingRepository = {
      findCandidateProfiles: jest.fn(),
      recordSwipe: jest.fn(),
      getUserDemographicGender: jest.fn(),
      findLikesReceived: jest.fn(),
      findTargetUserStatus: jest.fn(),
      getUserFullName: jest.fn(),
    };
    useCase = new GetLikesReceivedUseCase(mockMatchingRepository);
  });

  it('retrieves users who liked current user with strictly requested fields', async () => {
    const mockLikes: LikeReceivedEntity[] = [
      {
        id: 205,
        fullName: 'Sara Connor',
        username: 'sarah_c',
        city: 'Tehran',
        isOnline: true,
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
      },
    ];

    mockMatchingRepository.findLikesReceived.mockResolvedValue(mockLikes);

    const result = await useCase.execute(1);

    expect(mockMatchingRepository.findLikesReceived).toHaveBeenCalledWith(1);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      id: 205,
      fullName: 'Sara Connor',
      username: 'sarah_c',
      city: 'Tehran',
      isOnline: true,
      avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
    });
    // Ensure no additional fields
    expect(result[0]).not.toHaveProperty('bio');
    expect(result[0]).not.toHaveProperty('age');
    expect(result[0]).not.toHaveProperty('gender');
    expect(result[0]).not.toHaveProperty('swipeId');
    expect(result[0]).not.toHaveProperty('likedAt');
  });

  it('returns empty list when no one has liked the user yet', async () => {
    mockMatchingRepository.findLikesReceived.mockResolvedValue([]);

    const result = await useCase.execute(1);

    expect(result).toEqual([]);
  });
});
