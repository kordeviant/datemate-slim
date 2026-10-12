import { GetRecommendedDetailUseCase } from './get-recommended-detail.use-case';
import { GetRecommendedUseCase } from './get-recommended.use-case';
import { GetProfileUseCase } from '../../../auth/application/use-cases/get-profile.use-case';
import { ProfileResponseDto } from '../../../auth/application/dtos/profile-response.dto';

describe('GetRecommendedDetailUseCase', () => {
  let useCase: GetRecommendedDetailUseCase;
  let mockGetRecommendedUseCase: jest.Mocked<GetRecommendedUseCase>;
  let mockGetProfileUseCase: jest.Mocked<GetProfileUseCase>;

  const mockRankedPool = [
    {
      id: 1,
      avatarUrl: 'https://cdn/1.webp',
      age: 24,
      city: 'Tehran',
      username: 'user1',
      fullName: 'User One',
      compatibilityScore: 90,
      isOnline: true,
      lastSeenAt: null,
      isSwiped: false,
    },
    {
      id: 2,
      avatarUrl: 'https://cdn/2.webp',
      age: 25,
      city: 'Tehran',
      username: 'user2',
      fullName: 'User Two',
      compatibilityScore: 85,
      isOnline: true,
      lastSeenAt: null,
      isSwiped: false,
    },
    {
      id: 3,
      avatarUrl: 'https://cdn/3.webp',
      age: 26,
      city: 'Tehran',
      username: 'user3',
      fullName: 'User Three',
      compatibilityScore: 80,
      isOnline: false,
      lastSeenAt: null,
      isSwiped: false,
    },
    {
      id: 4,
      avatarUrl: 'https://cdn/4.webp',
      age: 27,
      city: 'Tehran',
      username: 'user4',
      fullName: 'User Four',
      compatibilityScore: 75,
      isOnline: false,
      lastSeenAt: null,
      isSwiped: false,
    },
    {
      id: 5,
      avatarUrl: 'https://cdn/5.webp',
      age: 28,
      city: 'Shiraz',
      username: 'user5',
      fullName: 'User Five',
      compatibilityScore: 70,
      isOnline: false,
      lastSeenAt: null,
      isSwiped: false,
    },
  ];

  const createMockDetailedProfile = (id: number): ProfileResponseDto => ({
    id,
    email: `user${id}@example.com`,
    language: 'EN',
    lat: 35.6892,
    lon: 51.389,
    profileValidated: true,
    isPremium: false,
    Profile: {
      fullName: `User ${id}`,
      username: `user${id}`,
      phoneNumber: `+123456789${id}`,
      bio: `Bio for user ${id}`,
      languages: ['en'],
      avatar: `https://cdn/${id}.webp`,
      profilePicture: `https://cdn/${id}.webp`,
      profilePictureId: 10 + id,
      profileCompleted: true,
      isPremium: false,
      Demographic: {
        birthDate: '1998-01-01',
        gender: 'FEMALE',
        height: 170,
        degree: 'BACHELOR',
        profession: 'Engineer',
        relationStatus: 'SINGLE',
        City: { id: 10, name: 'Tehran', state: 'Tehran Province', country: 'Iran' },
      },
      RelationType: 'LONG',
      Answers: { '1': 0 },
      LikedActivities: { '1': 10 },
    },
    gallery: [
      {
        id: 10 + id,
        url: `https://cdn/${id}.webp`,
        description: 'Photo',
        isProfilePicture: true,
      },
    ],
  });

  beforeEach(() => {
    mockGetRecommendedUseCase = {
      getRankedCandidatePool: jest.fn().mockResolvedValue(mockRankedPool),
    } as any;

    mockGetProfileUseCase = {
      execute: jest.fn().mockImplementation((id: number) =>
        Promise.resolve(createMockDetailedProfile(id)),
      ),
    } as any;

    useCase = new GetRecommendedDetailUseCase(
      mockGetRecommendedUseCase,
      mockGetProfileUseCase,
    );
  });

  it('retrieves detailed profiles starting from numeric offset and respecting limit', async () => {
    // start: 3, limit: 2 -> items at index 3 and 4 (id 4 and id 5)
    const result = await useCase.execute(100, { start: 3, limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(4);
    expect(result[1].id).toBe(5);
    expect(result[0].Profile.fullName).toBe('User 4');
    expect(result[1].Profile.fullName).toBe('User 5');
    expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith(4);
    expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith(5);
  });

  it('supports start and end pagination parameters', async () => {
    // start: 1, end: 3 -> items at index 1 and 2 (id 2 and id 3)
    const result = await useCase.execute(100, { start: 1, end: 3 });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(3);
  });

  it('supports offset parameter as alias for start', async () => {
    const result = await useCase.execute(100, { offset: 2, limit: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('returns empty array when start index is beyond the candidate pool', async () => {
    const result = await useCase.execute(100, { start: 10, limit: 5 });

    expect(result).toEqual([]);
    expect(mockGetProfileUseCase.execute).not.toHaveBeenCalled();
  });

  it('handles individual candidate profile loading errors gracefully', async () => {
    mockGetProfileUseCase.execute
      .mockResolvedValueOnce(createMockDetailedProfile(1))
      .mockRejectedValueOnce(new Error('User account not found'));

    const result = await useCase.execute(100, { start: 0, limit: 2 });

    // Candidate 1 succeeds, candidate 2 fails and is filtered out
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
