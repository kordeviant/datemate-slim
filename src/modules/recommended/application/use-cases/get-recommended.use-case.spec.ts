import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GetRecommendedUseCase } from './get-recommended.use-case';
import {
  CandidatePoolItem,
  IRecommendedRepository,
  UserRecommendationProfile,
} from '../../domain/repositories/recommended.repository.interface';

describe('GetRecommendedUseCase', () => {
  let useCase: GetRecommendedUseCase;
  let mockRepository: jest.Mocked<IRecommendedRepository>;

  const baseCurrentUser: UserRecommendationProfile = {
    id: 1,
    gender: 'MALE',
    birthDate: new Date('1998-05-15'),
    cityId: 10,
    cityName: 'Tehran',
    relationPreference: 'LONG',
    answerIds: [101, 102, 103],
    interestIds: [1, 2, 3],
    interestNames: ['Music', 'Art', 'Coffee'],
    bannedUntil: null,
  };

  beforeEach(() => {
    mockRepository = {
      getUserProfile: jest.fn(),
      getSwipedUserIds: jest.fn(),
      getCandidatePool: jest.fn(),
    };
    useCase = new GetRecommendedUseCase(mockRepository);
  });

  it('should throw NotFoundException if current user profile does not exist', async () => {
    mockRepository.getUserProfile.mockResolvedValue(null);

    await expect(useCase.execute(1, { limit: 20 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ForbiddenException if current user is banned', async () => {
    mockRepository.getUserProfile.mockResolvedValue({
      ...baseCurrentUser,
      bannedUntil: new Date(Date.now() + 100000),
    });

    await expect(useCase.execute(1, { limit: 20 })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw BadRequestException if gender demographic is not completed', async () => {
    mockRepository.getUserProfile.mockResolvedValue({
      ...baseCurrentUser,
      gender: null as any,
    });

    await expect(useCase.execute(1, { limit: 20 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should exclude self and already swiped candidate IDs', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([5, 8]);
    mockRepository.getCandidatePool.mockResolvedValue([]);

    await useCase.execute(1, { limit: 20 });

    expect(mockRepository.getCandidatePool).toHaveBeenCalledWith(
      'FEMALE',
      expect.arrayContaining([1, 5, 8]),
      100,
    );
  });

  it('should filter out candidates without photos or unvalidated profiles', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([]);

    const candidateNoPhoto: CandidatePoolItem = {
      id: 2,
      fullName: 'No Photo User',
      username: 'nophoto',
      gender: 'FEMALE',
      birthDate: new Date('1999-01-01'),
      bio: null,
      avatarUrl: null,
      profilePictureUrl: null,
      profileValidated: true,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: false,
      lastSeenAt: null,
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    };

    const candidateUnvalidated: CandidatePoolItem = {
      id: 3,
      fullName: 'Unvalidated User',
      username: 'unvalidated',
      gender: 'FEMALE',
      birthDate: new Date('1999-01-01'),
      bio: null,
      avatarUrl: 'https://example.com/photo.jpg',
      profilePictureUrl: 'https://example.com/photo.jpg',
      profileValidated: false,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: false,
      lastSeenAt: null,
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    };

    const validCandidate: CandidatePoolItem = {
      id: 4,
      fullName: 'Valid User',
      username: 'valid',
      gender: 'FEMALE',
      birthDate: new Date('1998-05-15'),
      bio: 'Hello world',
      avatarUrl: 'https://example.com/valid.jpg',
      profilePictureUrl: 'https://example.com/valid.jpg',
      profileValidated: true,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: true,
      lastSeenAt: new Date(),
      gallery: [{ id: 10, imageUrl: 'https://example.com/valid.jpg', isProfilePicture: true }],
      interestNames: ['Music'],
      interestIds: [1],
      answerIds: [101],
    };

    mockRepository.getCandidatePool.mockResolvedValue([
      candidateNoPhoto,
      candidateUnvalidated,
      validCandidate,
    ]);

    const result = await useCase.execute(1, { limit: 20 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
    expect(result[0].avatarUrl).toBe('https://example.com/valid.jpg');
    expect(result[0].sameCity).toBe(true);
    expect(result[0].sameRelationGoal).toBe(true);
  });

  it('should dynamically score candidates by question answers, interests, city, goal and age, ranking top candidates first', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([]);

    // Candidate 1: High match (all answers match, all interests match, same city, same goal, same age)
    const highMatch: CandidatePoolItem = {
      id: 10,
      fullName: 'High Match',
      username: 'high',
      gender: 'FEMALE',
      birthDate: new Date('1998-05-15'), // same age (28)
      bio: 'Passionate artist',
      avatarUrl: 'https://example.com/high.jpg',
      profilePictureUrl: 'https://example.com/high.jpg',
      profileValidated: true,
      cityId: 10, // same city
      cityName: 'Tehran',
      relationPreference: 'LONG', // same goal
      isOnline: true,
      lastSeenAt: new Date(),
      gallery: [{ id: 1, imageUrl: 'https://example.com/high.jpg', isProfilePicture: true }],
      interestNames: ['Music', 'Art', 'Coffee'],
      interestIds: [1, 2, 3], // 3/3 interests match
      answerIds: [101, 102, 103], // 3/3 answers match
    };

    // Candidate 2: Low match (different city, different relation goal, no shared answers, different age)
    const lowMatch: CandidatePoolItem = {
      id: 20,
      fullName: 'Low Match',
      username: 'low',
      gender: 'FEMALE',
      birthDate: new Date('1980-01-01'), // age diff > 10
      bio: 'Traveller',
      avatarUrl: 'https://example.com/low.jpg',
      profilePictureUrl: 'https://example.com/low.jpg',
      profileValidated: true,
      cityId: 99, // different city
      cityName: 'Shiraz',
      relationPreference: 'FUN', // different goal
      isOnline: false,
      lastSeenAt: null,
      gallery: [{ id: 2, imageUrl: 'https://example.com/low.jpg', isProfilePicture: true }],
      interestNames: ['Sports'],
      interestIds: [99],
      answerIds: [999],
    };

    mockRepository.getCandidatePool.mockResolvedValue([lowMatch, highMatch]);

    const result = await useCase.execute(1, { limit: 20 });

    expect(result).toHaveLength(2);
    // highMatch should be ranked first
    expect(result[0].id).toBe(10);
    expect(result[0].compatibilityScore).toBeGreaterThan(result[1].compatibilityScore);
    expect(result[0].compatibilityScore).toBe(100); // 35 (questions) + 25 (interests) + 20 (city) + 10 (relation) + 10 (age)
    expect(result[0].sharedAnswersCount).toBe(3);
    expect(result[0].sharedInterests).toEqual(['Music', 'Art', 'Coffee']);
    expect(result[0].sameCity).toBe(true);
    expect(result[0].sameRelationGoal).toBe(true);

    // lowMatch should have significantly lower score
    expect(result[1].id).toBe(20);
    expect(result[1].compatibilityScore).toBe(0);
    expect(result[1].sameCity).toBe(false);
    expect(result[1].sameRelationGoal).toBe(false);
  });

  it('should respect requested limit parameter', async () => {
    mockRepository.getUserProfile.mockResolvedValue(baseCurrentUser);
    mockRepository.getSwipedUserIds.mockResolvedValue([]);

    const pool: CandidatePoolItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: 100 + i,
      fullName: `User ${i}`,
      username: `user_${i}`,
      gender: 'FEMALE',
      birthDate: new Date('1998-01-01'),
      bio: null,
      avatarUrl: `https://example.com/user_${i}.jpg`,
      profilePictureUrl: `https://example.com/user_${i}.jpg`,
      profileValidated: true,
      cityId: 10,
      cityName: 'Tehran',
      relationPreference: 'LONG',
      isOnline: false,
      lastSeenAt: null,
      gallery: [],
      interestNames: [],
      interestIds: [],
      answerIds: [],
    }));

    mockRepository.getCandidatePool.mockResolvedValue(pool);

    const result = await useCase.execute(1, { limit: 10 });
    expect(result).toHaveLength(10);
  });
});
