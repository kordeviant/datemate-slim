import { PrismaMatchingRepository } from './prisma-matching.repository';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';

describe('PrismaMatchingRepository', () => {
  let repository: PrismaMatchingRepository;
  let mockPrisma: any;
  let mockRedisService: any;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      sadd: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      hset: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    mockPrisma = {
      demographic: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      swipe: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    repository = new PrismaMatchingRepository(
      mockPrisma as PrismaService,
      mockRedisService as RedisService,
    );
  });

  describe('getUserDemographicGender', () => {
    it('returns gender when demographic exists', async () => {
      mockPrisma.demographic.findUnique.mockResolvedValue({ gender: 'MALE' });
      const result = await repository.getUserDemographicGender(1);
      expect(result).toBe('MALE');
    });

    it('returns null when demographic does not exist', async () => {
      mockPrisma.demographic.findUnique.mockResolvedValue(null);
      const result = await repository.getUserDemographicGender(1);
      expect(result).toBeNull();
    });
  });

  describe('findTargetUserStatus', () => {
    it('returns exists: false when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await repository.findTargetUserStatus(999);
      expect(result).toEqual({ exists: false, isBanned: false });
    });

    it('returns isBanned: true when bannedUntil is in the future', async () => {
      const futureDate = new Date(Date.now() + 1000000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 2,
        bannedUntil: futureDate,
      });
      const result = await repository.findTargetUserStatus(2);
      expect(result).toEqual({ exists: true, isBanned: true });
    });

    it('returns isBanned: false when bannedUntil is null', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 2,
        bannedUntil: null,
      });
      const result = await repository.findTargetUserStatus(2);
      expect(result).toEqual({ exists: true, isBanned: false });
    });
  });

  describe('recordSwipe', () => {
    it('records swipe to Redis and PostgreSQL upsert without match calculation', async () => {
      await repository.recordSwipe(1, 2, 'RIGHT');

      expect(mockRedisClient.sadd).toHaveBeenCalledWith('swiped:1', '2');
      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        'swipe:1:2',
        '1',
        expect.any(String),
      );
      expect(mockPrisma.swipe.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fromUserId_toUserId: { fromUserId: 1, toUserId: 2 } },
          create: expect.objectContaining({
            fromUserId: 1,
            toUserId: 2,
            direction: 'RIGHT',
            userPairKey: '1:2',
          }),
        }),
      );
    });
  });

  describe('findCandidateProfiles', () => {
    it('filters candidates based on all 6 rules', async () => {
      mockPrisma.swipe.findMany.mockResolvedValue([{ toUserId: 3 }]);
      mockRedisClient.smembers.mockResolvedValue(['4']);

      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 5,
          profileValidated: true,
          profile: {
            fullName: 'Sara Connor',
            avatarUrl: 'http://cdn/avatar.webp',
            isOnline: true,
            lastSeenAt: new Date(),
          },
          demographic: {
            gender: 'FEMALE',
            birthDate: new Date('1998-05-10'),
            city: { name: 'Tehran' },
          },
          gallery: [{ imageUrl: 'http://cdn/gallery.webp', isProfilePicture: true }],
          interests: [{ interest: { nameEn: 'Music' } }],
        },
        {
          id: 6,
          profileValidated: true,
          profile: {
            fullName: 'NoPhoto',
            avatarUrl: null,
          },
          demographic: { gender: 'FEMALE' },
          gallery: [],
          interests: [],
        },
      ]);

      const result = await repository.findCandidateProfiles(1, 'FEMALE', 20);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: expect.arrayContaining([1, 3, 4]) },
            profileValidated: true,
            demographic: { gender: 'FEMALE' },
          }),
        }),
      );

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(5);
      expect(result[0].avatarUrl).toBe('http://cdn/avatar.webp');
      expect(result[0].city).toBe('Tehran');
      expect(result[0].interests).toEqual(['Music']);
    });

    it('resolves relative avatarUrl and gallery images into full public URLs', async () => {
      mockPrisma.swipe.findMany.mockResolvedValue([]);
      mockRedisClient.smembers.mockResolvedValue([]);

      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 10,
          profileValidated: true,
          profile: {
            fullName: 'Relative Candidate',
            avatarUrl: 'avatars/avatarbe9c29b29330.webp',
            isOnline: true,
            lastSeenAt: new Date(),
          },
          demographic: {
            gender: 'FEMALE',
            birthDate: new Date('1998-05-10'),
            city: { name: 'Tehran' },
          },
          gallery: [{ imageUrl: 'images/gal1.webp', isProfilePicture: true }],
          interests: [],
        },
      ]);

      const result = await repository.findCandidateProfiles(1, 'FEMALE', 20);

      expect(result.length).toBe(1);
      expect(result[0].avatarUrl).toBe(
        'http://localhost:3000/assets/avatars/avatarbe9c29b29330.webp',
      );
      expect(result[0].gallery).toEqual([
        'http://localhost:3000/assets/images/gal1.webp',
      ]);
    });
  });

  describe('findLikesReceived', () => {
    it('retrieves all users who liked current user with direction RIGHT', async () => {
      mockPrisma.swipe.findMany.mockResolvedValue([
        {
          id: 77,
          fromUserId: 205,
          toUserId: 1,
          direction: 'RIGHT',
          createdAt: new Date('2026-10-11T12:00:00Z'),
          fromUser: {
            id: 205,
            profile: {
              fullName: 'Sara Connor',
              username: 'sarah_c',
              isOnline: true,
            },
            demographic: {
              city: { name: 'Tehran' },
            },
          },
        },
      ]);

      const result = await repository.findLikesReceived(1);

      expect(mockPrisma.swipe.findMany).toHaveBeenCalledWith({
        where: { toUserId: 1, direction: 'RIGHT' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(result.length).toBe(1);
      expect(result[0]).toEqual({
        id: 205,
        fullName: 'Sara Connor',
        username: 'sarah_c',
        city: 'Tehran',
        isOnline: true,
      });
    });
  });
});
