import { NotFoundException } from '@nestjs/common';
import { PrismaAdminRepository } from './prisma-admin.repository';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import {
  AdminGenderFilter,
  AdminSortOrder,
  AdminUserSortBy,
  AdminUserStatusFilter,
} from '../../application/dtos/get-admin-users.dto';

describe('PrismaAdminRepository', () => {
  let repository: PrismaAdminRepository;
  let mockPrisma: any;
  let mockMediaUrlResolver: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      profile: {
        count: jest.fn(),
        update: jest.fn(),
      },
      demographic: {
        count: jest.fn(),
      },
      userSession: {
        deleteMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (promises) => {
        return Promise.all(promises);
      }),
    };

    mockMediaUrlResolver = {
      resolveUrl: jest
        .fn()
        .mockImplementation((path) =>
          path ? `http://localhost:3000/assets/${path}` : '',
        ),
    };

    repository = new PrismaAdminRepository(
      mockPrisma as unknown as PrismaService,
      mockMediaUrlResolver as unknown as MediaUrlResolverService,
    );
  });

  describe('getDashboardStats', () => {
    it('should aggregate total users, online users, pending selfies, and tickets', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(6570) // totalUsers
        .mockResolvedValueOnce(7); // pendingSelfies
      mockPrisma.profile.count.mockResolvedValueOnce(369); // onlineUsers

      const result = await repository.getDashboardStats();

      expect(result).toEqual({
        totalUsers: 6570,
        onlineUsers: 369,
        pendingSelfies: 7,
        unansweredTickets: 0,
      });
    });
  });

  describe('getDashboardOverview', () => {
    it('should aggregate full overview data including stats, weeklyActivity, genderStats, tickets, and selfies', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(6570) // totalUsers
        .mockResolvedValueOnce(7); // pendingSelfies
      mockPrisma.profile.count.mockResolvedValueOnce(369); // onlineUsers

      mockPrisma.demographic.count
        .mockResolvedValueOnce(2694) // maleCount
        .mockResolvedValueOnce(3876); // femaleCount

      mockPrisma.user.findMany
        .mockResolvedValueOnce([
          {
            id: 45,
            email: 'chichang@gmail.com',
            createdAt: new Date('2026-03-03T11:20:00.000Z'),
            profile: {
              fullName: 'چی چانگ',
              avatarUrl: 'avatars/avatar45.webp',
              selfieUrl: 'selfies/selfie45.webp',
            },
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await repository.getDashboardOverview();

      expect(result.stats.totalUsers).toBe(6570);
      expect(result.stats.onlineUsers).toBe(369);
      expect(result.stats.pendingSelfies).toBe(7);
      expect(result.stats.unansweredTickets).toBeGreaterThanOrEqual(1);

      expect(result.weeklyActivity).toHaveLength(7);
      expect(result.weeklyActivity[0].dayName).toBe('ش');
      expect(result.weeklyActivity[0].isPeak).toBe(true);

      expect(result.genderStats).toEqual({
        maleCount: 2694,
        femaleCount: 3876,
        malePercentage: 41,
        femalePercentage: 59,
      });

      expect(result.recentTickets.length).toBeGreaterThan(0);
      expect(result.recentSelfies).toHaveLength(1);
      expect(result.recentSelfies[0]).toEqual({
        id: 1,
        userId: 45,
        fullName: 'چی چانگ',
        email: 'chichang@gmail.com',
        avatar: 'http://localhost:3000/assets/avatars/avatar45.webp',
        selfieUrl: 'http://localhost:3000/assets/selfies/selfie45.webp',
        createdAt: '2026-03-03T11:20:00.000Z',
      });
    });
  });

  describe('getUsers', () => {
    it('should query users with search, filters, pagination and map fields correctly', async () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 23);

      const rawUser = {
        id: 101,
        email: 'sara@example.com',
        wallet: 50.0,
        isPremium: true,
        profileValidated: false,
        bannedUntil: null,
        createdAt: new Date('2024-11-20T10:00:00.000Z'),
        profile: {
          fullName: 'سارا همتی',
          username: 'sara_h',
          avatarUrl: 'avatars/avatar_1.webp',
          bio: 'علاقه‌مند به هنر',
          isOnline: true,
          lastSeenAt: new Date('2026-10-04T07:15:00.000Z'),
        },
        demographic: {
          birthDate,
          gender: 'FEMALE',
          city: {
            name: 'اسلامشهر',
          },
        },
        gallery: [
          {
            id: 1,
            imageUrl: 'images/gallery_101_1.webp',
            description: 'Photo 1',
            likesCount: 5,
            isProfilePicture: true,
            createdAt: new Date('2026-10-04T12:00:00.000Z'),
          },
        ],
      };

      mockPrisma.user.count.mockResolvedValueOnce(1);
      mockPrisma.user.findMany.mockResolvedValueOnce([rawUser]);

      const result = await repository.getUsers({
        page: 1,
        limit: 10,
        search: 'sara',
        status: AdminUserStatusFilter.ALL,
        gender: AdminGenderFilter.FEMALE,
        sortBy: AdminUserSortBy.CREATED_AT,
        order: AdminSortOrder.DESC,
      });

      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.items[0]).toEqual({
        id: 101,
        email: 'sara@example.com',
        fullName: 'سارا همتی',
        username: 'sara_h',
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
        bio: 'علاقه‌مند به هنر',
        isPremium: true,
        hasPendingSelfie: false,
        profileValidated: false,
        selfieVerified: false,
        isBanned: false,
        bannedUntil: null,
        gender: 'FEMALE',
        age: 23,
        city: 'اسلامشهر',
        registrationCompleted: true,
        isOnline: true,
        lastSeenAt: '2026-10-04T07:15:00.000Z',
        createdAt: '2024-11-20T10:00:00.000Z',
      });
    });

    it('should map isPremium as false when user is not premium regardless of wallet balance', async () => {
      const rawUser = {
        id: 102,
        email: 'user2@example.com',
        wallet: 500.0,
        isPremium: false,
        profileValidated: false,
        bannedUntil: null,
        createdAt: new Date('2024-11-20T10:00:00.000Z'),
        profile: null,
        demographic: null,
        gallery: [],
      };

      mockPrisma.user.count.mockResolvedValueOnce(1);
      mockPrisma.user.findMany.mockResolvedValueOnce([rawUser]);

      const result = await repository.getUsers({
        page: 1,
        limit: 10,
        status: AdminUserStatusFilter.ALL,
        gender: AdminGenderFilter.ALL,
        sortBy: AdminUserSortBy.CREATED_AT,
        order: AdminSortOrder.DESC,
      });

      expect(result.items[0].isPremium).toBe(false);
      expect(typeof result.items[0].profileValidated).toBe('boolean');
      expect(result.items[0].profileValidated).toBe(false);
    });

    it('should correctly handle BLOCKED, PENDING_VERIFICATION, and COMPLETED status filters', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await repository.getUsers({
        page: 1,
        limit: 10,
        status: AdminUserStatusFilter.BLOCKED,
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bannedUntil: expect.any(Object),
          }),
        }),
      );

      await repository.getUsers({
        page: 1,
        limit: 10,
        status: AdminUserStatusFilter.PENDING_VERIFICATION,
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            profileValidated: false,
          }),
        }),
      );

      await repository.getUsers({
        page: 1,
        limit: 10,
        status: AdminUserStatusFilter.COMPLETED,
        sortBy: AdminUserSortBy.WALLET,
        order: AdminSortOrder.ASC,
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { wallet: 'asc' },
        }),
      );
    });
  });

  describe('banUser', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(repository.banUser(999, 24)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should ban user with duration, invalidate sessions, and return updated info', async () => {
      const user = { id: 101, email: 'user@example.com' };
      const bannedDate = new Date(Date.now() + 24 * 3600 * 1000);
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...user,
        bannedUntil: bannedDate,
      });

      const result = await repository.banUser(101, 24, 'Spamming');

      expect(mockPrisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 101 },
      });
      expect(result.id).toBe(101);
      expect(result.isBanned).toBe(true);
      expect(result.bannedUntil).toBe(bannedDate.toISOString());
      expect(result.reason).toBe('Spamming');
    });

    it('should permanently ban user when durationHours is null', async () => {
      const user = { id: 101, email: 'user@example.com' };
      const farFuture = new Date('9999-12-31T23:59:59.999Z');
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...user,
        bannedUntil: farFuture,
      });

      const result = await repository.banUser(101, null);

      expect(result.isBanned).toBe(true);
      expect(result.bannedUntil).toBe(farFuture.toISOString());
    });
  });

  describe('unbanUser', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(repository.unbanUser(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set bannedUntil to null and return unbanned status', async () => {
      const user = { id: 101, email: 'user@example.com' };
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...user,
        bannedUntil: null,
      });

      const result = await repository.unbanUser(101);

      expect(result.isBanned).toBe(false);
      expect(result.bannedUntil).toBeNull();
    });
  });

  describe('getPendingVerifications', () => {
    it('should query unverified users with selfie and map verification fields', async () => {
      const rawUser = {
        id: 101,
        email: 'sara@example.com',
        updatedAt: new Date('2026-10-04T07:15:00.000Z'),
        createdAt: new Date('2024-11-20T10:00:00.000Z'),
        profile: {
          fullName: 'سارا همتی',
          username: 'sara_h',
          avatarUrl: 'avatars/avatar_1.webp',
          selfieUrl: 'selfies/selfie_1.webp',
          updatedAt: new Date('2026-10-04T07:15:00.000Z'),
        },
        demographic: {
          birthDate: new Date('2000-01-01'),
          gender: 'FEMALE',
          city: { name: 'تهران' },
        },
      };

      mockPrisma.user.count.mockResolvedValueOnce(1);
      mockPrisma.user.findMany.mockResolvedValueOnce([rawUser]);

      const result = await repository.getPendingVerifications(1, 10);

      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual({
        userId: 101,
        fullName: 'سارا همتی',
        username: 'sara_h',
        email: 'sara@example.com',
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
        selfieUrl: 'http://localhost:3000/assets/selfies/selfie_1.webp',
        gender: 'FEMALE',
        age: expect.any(Number),
        city: 'تهران',
        submittedAt: '2026-10-04T07:15:00.000Z',
        createdAt: '2024-11-20T10:00:00.000Z',
      });
    });
  });

  describe('approveVerification', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(repository.approveVerification(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate profile and fire notification', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 101 });

      const result = await repository.approveVerification(101);

      expect(result).toEqual({ userId: 101, profileValidated: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('rejectVerification', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        repository.rejectVerification(999, 'Blurry face'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reset profileValidated, clear selfieUrl and create rejection notification', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 101,
        profile: { id: 1 },
      });

      const result = await repository.rejectVerification(101, 'Face does not match');

      expect(result).toEqual({
        userId: 101,
        profileValidated: false,
        reason: 'Face does not match',
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        repository.updateUser(999, { confirmSelfie: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user, confirm selfie verification, create notification and return mapped AdminUserItem', async () => {
      const existingUser = {
        id: 101,
        email: 'sara@example.com',
        profileValidated: false,
        profile: {
          fullName: 'سارا همتی',
          bio: 'قدیمی',
        },
      };

      const updatedUser = {
        id: 101,
        email: 'sara@example.com',
        wallet: 50.0,
        isPremium: true,
        profileValidated: true,
        bannedUntil: null,
        createdAt: new Date('2024-11-20T10:00:00.000Z'),
        profile: {
          fullName: 'سارا همتی جدید',
          username: 'sara_h',
          avatarUrl: 'avatars/avatar_1.webp',
          bio: 'بیوگرافی جدید',
          isOnline: true,
          lastSeenAt: new Date('2026-10-04T07:15:00.000Z'),
        },
        demographic: {
          birthDate: new Date('2000-01-01'),
          gender: 'FEMALE',
          city: {
            name: 'تهران',
          },
        },
        gallery: [],
      };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUser) // initial check
        .mockResolvedValueOnce(updatedUser); // after update

      const result = await repository.updateUser(101, {
        confirmSelfie: true,
        bio: 'بیوگرافی جدید',
        fullName: 'سارا همتی جدید',
        isPremium: true,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.id).toBe(101);
      expect(result.profileValidated).toBe(true);
      expect(result.selfieVerified).toBe(true);
      expect(result.bio).toBe('بیوگرافی جدید');
      expect(result.fullName).toBe('سارا همتی جدید');
      expect(result.isPremium).toBe(true);
    });
  });

  describe('getUserDetails', () => {
    it('should throw NotFoundException if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(repository.getUserDetails(999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(repository.getUserDetails(999)).rejects.toThrow(
        'کاربر مورد نظر یافت نشد',
      );
    });

    it('should return complete user details including demographics, gallery, and interests', async () => {
      const rawUser = {
        id: 12,
        email: 'sarah.smith@example.com',
        role: 'USER',
        language: 'FA',
        profileValidated: true,
        isPremium: true,
        bannedUntil: null,
        wallet: 150000,
        score: 420,
        notificationsOn: true,
        createdAt: new Date('2025-11-20T14:22:00.000Z'),
        updatedAt: new Date('2026-04-01T08:15:00.000Z'),
        profile: {
          fullName: 'سارا محمدی',
          username: 'sarah_m',
          phoneNumber: '09123456789',
          bio: 'علاقه‌مند به سفر',
          avatarUrl: 'avatars/user12.webp',
          selfieUrl: null,
          isPrivate: false,
          isOnline: false,
          lastSeenAt: new Date('2026-10-05T12:00:00.000Z'),
        },
        demographic: {
          birthDate: new Date('1997-07-05'),
          gender: 'FEMALE',
          job: 'طراح محصول',
          degree: 'MASTER_DEGREE',
          height: 168,
          weight: 58,
          religion: null,
          relationStatus: 'SINGLE',
          city: {
            name: 'تهران',
          },
        },
        gallery: [
          {
            id: 101,
            imageUrl: 'gallery/photo1.webp',
            likesCount: 24,
            createdAt: new Date('2026-01-10T12:00:00.000Z'),
          },
        ],
        interests: [
          {
            interest: {
              nameEn: 'Hiking',
              nameFa: 'کوهنوردی',
            },
          },
        ],
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(rawUser);

      const result = await repository.getUserDetails(12);

      expect(result.id).toBe(12);
      expect(result.email).toBe('sarah.smith@example.com');
      expect(result.role).toBe('USER');
      expect(result.fullName).toBe('سارا محمدی');
      expect(result.username).toBe('sarah_m');
      expect(result.avatarUrl).toBe('http://localhost:3000/assets/avatars/user12.webp');
      expect(result.profileValidated).toBe(true);
      expect(result.hasPendingSelfie).toBe(false);
      expect(result.wallet).toBe(150000);
      expect(result.score).toBe(420);
      expect(result.demographic.cityName).toBe('تهران');
      expect(result.demographic.job).toBe('طراح محصول');
      expect(result.gallery.length).toBe(1);
      expect(result.gallery[0].url).toBe('http://localhost:3000/assets/gallery/photo1.webp');
      expect(result.interests).toEqual(['Hiking']);
      expect(result.transactions).toEqual([]);
      expect(result.chatRooms).toEqual([]);
    });
  });
});
