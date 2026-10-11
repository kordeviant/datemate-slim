import { BadRequestException } from '@nestjs/common';
import { GetFeedUseCase } from './get-feed.use-case';
import { IMatchingRepository } from '../../domain/repositories/matching.repository.interface';
import { FeedCandidateEntity } from '../../domain/entities/feed-candidate.entity';

describe('GetFeedUseCase', () => {
  let useCase: GetFeedUseCase;
  let mockMatchingRepository: jest.Mocked<IMatchingRepository>;

  beforeEach(() => {
    mockMatchingRepository = {
      findCandidateProfiles: jest.fn(),
      recordSwipe: jest.fn(),
      getUserDemographicGender: jest.fn(),
      findLikesReceived: jest.fn(),
      findTargetUserStatus: jest.fn(),
    };
    useCase = new GetFeedUseCase(mockMatchingRepository);
  });

  const sampleCandidate: FeedCandidateEntity = {
    id: 205,
    firstName: 'Sara',
    fullName: 'Sara Connor',
    age: 24,
    gender: 'FEMALE',
    bio: 'Love hiking and photography',
    avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
    profileValidated: true,
    gallery: ['http://localhost:3000/assets/images/gallery_1.webp'],
    interests: ['Hiking', 'Photography'],
    city: 'Tehran',
    isOnline: true,
    lastSeenAt: new Date('2026-10-11T12:00:00Z'),
  };

  it('throws BadRequestException if user has no demographic gender configured', async () => {
    mockMatchingRepository.getUserDemographicGender.mockResolvedValue(null);

    await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
  });

  it('queries FEMALE candidates when current user is MALE', async () => {
    mockMatchingRepository.getUserDemographicGender.mockResolvedValue('MALE');
    mockMatchingRepository.findCandidateProfiles.mockResolvedValue([
      sampleCandidate,
    ]);

    const result = await useCase.execute(1, { limit: 20 });

    expect(mockMatchingRepository.findCandidateProfiles).toHaveBeenCalledWith(
      1,
      'FEMALE',
      20,
    );
    expect(result.count).toBe(1);
    expect(result.candidates[0].id).toBe(205);
    expect(result.candidates[0].gender).toBe('FEMALE');
  });

  it('queries MALE candidates when current user is FEMALE', async () => {
    mockMatchingRepository.getUserDemographicGender.mockResolvedValue('FEMALE');
    mockMatchingRepository.findCandidateProfiles.mockResolvedValue([]);

    await useCase.execute(2, { limit: 15 });

    expect(mockMatchingRepository.findCandidateProfiles).toHaveBeenCalledWith(
      2,
      'MALE',
      15,
    );
  });

  it('defaults to limit 20 when limit is not provided', async () => {
    mockMatchingRepository.getUserDemographicGender.mockResolvedValue('MALE');
    mockMatchingRepository.findCandidateProfiles.mockResolvedValue([]);

    await useCase.execute(1);

    expect(mockMatchingRepository.findCandidateProfiles).toHaveBeenCalledWith(
      1,
      'FEMALE',
      20,
    );
  });
});
