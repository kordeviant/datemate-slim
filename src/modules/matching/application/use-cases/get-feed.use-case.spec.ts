import { BadRequestException } from '@nestjs/common';
import { GetFeedUseCase } from './get-feed.use-case';
import { IMatchingRepository } from '../../domain/repositories/matching.repository.interface';
import { FeedCandidateEntity } from '../../domain/entities/feed-candidate.entity';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import { ConfigService } from '@nestjs/config';

describe('GetFeedUseCase', () => {
  let useCase: GetFeedUseCase;
  let mockMatchingRepository: jest.Mocked<IMatchingRepository>;
  const originalAssetBaseUrl = process.env.ASSET_BASE_URL;
  const originalMediaBaseUrl = process.env.MEDIA_BASE_URL;
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    process.env.ASSET_BASE_URL = 'http://localhost:3000';
    delete process.env.MEDIA_BASE_URL;
    delete process.env.APP_BASE_URL;
    process.env.APP_URL = 'http://localhost:3000';

    mockMatchingRepository = {
      findCandidateProfiles: jest.fn(),
      recordSwipe: jest.fn(),
      getUserDemographicGender: jest.fn(),
      findLikesReceived: jest.fn(),
      findTargetUserStatus: jest.fn(),
      getUserFullName: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'ASSET_BASE_URL') return 'http://localhost:3000';
        if (key === 'PORT') return 3000;
        return defaultValue;
      }),
    } as unknown as ConfigService;
    const mediaUrlResolver = new MediaUrlResolverService(mockConfigService);

    useCase = new GetFeedUseCase(mockMatchingRepository, mediaUrlResolver);
  });

  afterAll(() => {
    if (originalAssetBaseUrl !== undefined) {
      process.env.ASSET_BASE_URL = originalAssetBaseUrl;
    } else {
      delete process.env.ASSET_BASE_URL;
    }
    if (originalMediaBaseUrl !== undefined) {
      process.env.MEDIA_BASE_URL = originalMediaBaseUrl;
    } else {
      delete process.env.MEDIA_BASE_URL;
    }
    if (originalAppBaseUrl !== undefined) {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    } else {
      delete process.env.APP_BASE_URL;
    }
    if (originalAppUrl !== undefined) {
      process.env.APP_URL = originalAppUrl;
    } else {
      delete process.env.APP_URL;
    }
  });

  const sampleCandidate: FeedCandidateEntity = {
    id: 205,
    fullName: 'Sara Connor',
    city: 'Tehran',
    age: 24,
    avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
    username: 'sara_c',
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
    expect(result.candidates[0]).toEqual({
      id: 205,
      fullName: 'Sara Connor',
      city: 'Tehran',
      age: 24,
      profilePicture: 'http://localhost:3000/assets/avatars/avatar_205.webp',
      username: 'sara_c',
    });
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

  it('resolves relative avatarUrl paths into full public URLs for profilePicture', async () => {
    mockMatchingRepository.getUserDemographicGender.mockResolvedValue('MALE');
    mockMatchingRepository.findCandidateProfiles.mockResolvedValue([
      {
        ...sampleCandidate,
        avatarUrl: 'avatars/avatarbe9c29b29330.webp',
      },
    ]);

    const result = await useCase.execute(1);

    expect(result.candidates[0].profilePicture).toBe(
      'http://localhost:3000/assets/avatars/avatarbe9c29b29330.webp',
    );
  });

  it('sends url of gallery which is isProfilePicture: true for profilePicture', async () => {
    mockMatchingRepository.getUserDemographicGender.mockResolvedValue('MALE');
    mockMatchingRepository.findCandidateProfiles.mockResolvedValue([
      {
        ...sampleCandidate,
        avatarUrl: 'avatars/old_avatar.webp',
        gallery: [
          { imageUrl: 'gallery/photo1.webp', isProfilePicture: false },
          { imageUrl: 'gallery/profile_pic.webp', isProfilePicture: true },
        ],
      },
    ]);

    const result = await useCase.execute(1);

    expect(result.candidates[0].profilePicture).toBe(
      'http://localhost:3000/assets/gallery/profile_pic.webp',
    );
  });
});

