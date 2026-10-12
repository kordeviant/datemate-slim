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

  it('supports candidateId parameter as cursor pagination', async () => {
    // candidateId: 4 -> starts from candidate 4 (index 3)
    const result = await useCase.execute(100, { candidateId: 4, limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(4);
    expect(result[1].id).toBe(5);
  });

  it('resolves start as candidate ID when it matches an existing candidate ID out of bounds', async () => {
    // Candidate pool with large IDs
    mockGetRecommendedUseCase.getRankedCandidatePool.mockResolvedValueOnce([
      { id: 216, fullName: 'User 216' },
      { id: 217, fullName: 'User 217' },
    ] as any);

    // start: 216 exceeds pool length (2), so it is matched as candidate ID
    const result = await useCase.execute(100, { start: 216, limit: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(216);
  });

  describe('Anchor-based window pagination (anchorUserId, before, after)', () => {
    it('returns window around anchorUserId with before and after counts', async () => {
      // mockRankedPool has IDs: 1, 2, 3, 4, 5
      // Anchor: 3, before: 1, after: 1 -> IDs [2, 3, 4]
      const result = await useCase.execute(100, {
        anchorUserId: 3,
        before: 1,
        after: 1,
      });

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual([2, 3, 4]);
      expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith(2);
      expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith(3);
      expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith(4);
    });

    it('clamps before and after correctly at pool boundaries (e.g. before: 10, after: 10)', async () => {
      // Anchor: 3 with before: 10 and after: 10 -> all 5 candidates [1, 2, 3, 4, 5]
      const result = await useCase.execute(100, {
        anchorUserId: 3,
        before: 10,
        after: 10,
      });

      expect(result).toHaveLength(5);
      expect(result.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    });

    it('handles anchor at start of pool (index 0)', async () => {
      // Anchor: 1, before: 5, after: 2 -> IDs [1, 2, 3]
      const result = await useCase.execute(100, {
        anchorUserId: 1,
        before: 5,
        after: 2,
      });

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual([1, 2, 3]);
    });

    it('handles anchor at end of pool', async () => {
      // Anchor: 5, before: 2, after: 5 -> IDs [3, 4, 5]
      const result = await useCase.execute(100, {
        anchorUserId: 5,
        before: 2,
        after: 5,
      });

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual([3, 4, 5]);
    });

    it('supports anchorUserId without before/after by defaulting to anchorIndex with limit', async () => {
      // Anchor: 2, limit: 2 -> IDs [2, 3]
      const result = await useCase.execute(100, {
        anchorUserId: 2,
        limit: 2,
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual([2, 3]);
    });

    it('returns empty array when anchorUserId is not found in pool', async () => {
      const result = await useCase.execute(100, {
        anchorUserId: 999,
        before: 10,
        after: 10,
      });

      expect(result).toEqual([]);
      expect(mockGetProfileUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
