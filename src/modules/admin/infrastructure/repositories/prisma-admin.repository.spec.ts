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

  describe('getUsers', () => {
    it('should query users with search, filters, pagination and map fields correctly', async () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 23);

      const rawUser = {
        id: 101,
        email: 'sara@example.com',
        wallet: 50.0,
        profileValidated: false,
        bannedUntil: null,
        createdAt: new Date('2024-11-20T10:00:00.000Z'),
        profile: {
          fullName: 'سارا همتی',
          username: 'sara_h',
          avatarUrl: 'avatars/avatar_1.webp',
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
        isPremium: true,
        profileValidated: false,
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
});
