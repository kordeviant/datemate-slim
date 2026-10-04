import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import { AdminDashboardStats } from '../../domain/entities/admin-dashboard-stats.entity';
import {
  AdminUserGalleryItem,
  AdminUserItem,
  AdminUsersPaginatedResult,
} from '../../domain/entities/admin-user-item.entity';
import {
  AdminVerificationItem,
  AdminVerificationsPaginatedResult,
} from '../../domain/entities/admin-verification-item.entity';
import {
  BanUserResult,
  GetAdminUsersParams,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

@Injectable()
export class PrismaAdminRepository implements IAdminRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrlResolver: MediaUrlResolverService,
  ) {}

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const [totalUsers, onlineUsers, pendingSelfies] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.profile.count({
        where: { isOnline: true },
      }),
      this.prisma.user.count({
        where: {
          profileValidated: false,
          profile: {
            selfieUrl: {
              not: null,
              notIn: [''],
            },
          },
        },
      }),
    ]);

    // Unanswered support tickets count (defaults to 0 until support ticket system is integrated)
    const unansweredTickets = 0;

    return {
      totalUsers,
      onlineUsers,
      pendingSelfies,
      unansweredTickets,
    };
  }

  async getUsers(
    params: GetAdminUsersParams,
  ): Promise<AdminUsersPaginatedResult> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (params.search && params.search.trim()) {
      const search = params.search.trim();
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { fullName: { contains: search, mode: 'insensitive' } } },
        { profile: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (params.gender && params.gender !== 'ALL') {
      where.demographic = {
        gender: params.gender,
      };
    }

    const now = new Date();

    if (params.status === 'BLOCKED') {
      where.bannedUntil = { gt: now };
    } else if (params.status === 'PENDING_VERIFICATION') {
      where.profileValidated = false;
      where.profile = {
        ...(where.profile as Prisma.ProfileWhereInput),
        selfieUrl: {
          not: null,
          notIn: [''],
        },
      };
    } else if (params.status === 'COMPLETED') {
      where.profile = {
        ...(where.profile as Prisma.ProfileWhereInput),
        fullName: { not: '' },
        username: { not: null },
        avatarUrl: { not: '' },
      };
      where.demographic = {
        ...(where.demographic as Prisma.DemographicWhereInput),
        birthDate: { not: null },
        gender: { in: ['MALE', 'FEMALE'] },
      };
    }

    const order = params.order?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    let orderBy: Prisma.UserOrderByWithRelationInput;

    if (params.sortBy === 'lastSeenAt') {
      orderBy = { profile: { lastSeenAt: order } };
    } else if (params.sortBy === 'wallet') {
      orderBy = { wallet: order };
    } else {
      orderBy = { createdAt: order };
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          profile: true,
          demographic: {
            include: {
              city: true,
            },
          },
          gallery: {
            orderBy: { id: 'asc' },
          },
        },
      }),
    ]);

    const items: AdminUserItem[] = users.map((user) => {
      let age: number | null = null;
      if (user.demographic?.birthDate) {
        const birth = new Date(user.demographic.birthDate);
        age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
          age--;
        }
      }

      const isBanned = Boolean(user.bannedUntil && user.bannedUntil > now);
      const isOnline = Boolean(user.profile?.isOnline);
      const registrationCompleted = Boolean(
        user.profile?.fullName &&
          user.profile?.username &&
          user.profile?.avatarUrl &&
          user.demographic?.birthDate &&
          user.demographic?.gender,
      );

      const gallery: AdminUserGalleryItem[] = (user.gallery || []).map((g) => ({
        id: g.id,
        url: this.mediaUrlResolver.resolveUrl(g.imageUrl),
        description: g.description ?? null,
        likesCount: g.likesCount || 0,
        isProfilePicture: Boolean(g.isProfilePicture),
        createdAt: g.createdAt ? g.createdAt.toISOString() : undefined,
      }));

      return {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName ?? '',
        username: user.profile?.username ?? null,
        avatarUrl: user.profile?.avatarUrl
          ? this.mediaUrlResolver.resolveUrl(user.profile.avatarUrl)
          : null,
        isPremium: user.wallet > 0,
        profileValidated: user.profileValidated,
        isBanned,
        bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
        gender: user.demographic?.gender ?? null,
        age,
        city: user.demographic?.city?.name ?? null,
        registrationCompleted,
        isOnline,
        lastSeenAt: user.profile?.lastSeenAt
          ? user.profile.lastSeenAt.toISOString()
          : null,
        createdAt: user.createdAt.toISOString(),
        gallery,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      totalPages,
    };
  }

  async banUser(
    userId: number,
    durationHours?: number | null,
    reason?: string,
  ): Promise<BanUserResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    let bannedUntil: Date;
    if (durationHours === null || durationHours === undefined) {
      bannedUntil = new Date('9999-12-31T23:59:59.999Z');
    } else if (durationHours > 0) {
      bannedUntil = new Date(Date.now() + durationHours * 3600 * 1000);
    } else {
      bannedUntil = new Date('9999-12-31T23:59:59.999Z');
    }

    // Invalidate user active sessions immediately on ban
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannedUntil },
    });

    return {
      id: updated.id,
      email: updated.email,
      isBanned: true,
      bannedUntil: updated.bannedUntil?.toISOString() ?? null,
      reason: reason ?? null,
    };
  }

  async unbanUser(userId: number): Promise<BanUserResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannedUntil: null },
    });

    return {
      id: updated.id,
      email: updated.email,
      isBanned: false,
      bannedUntil: null,
    };
  }

  async getPendingVerifications(
    page: number = 1,
    limit: number = 10,
  ): Promise<AdminVerificationsPaginatedResult> {
    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.max(1, Math.min(100, limit || 10));
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.UserWhereInput = {
      profileValidated: false,
      profile: {
        selfieUrl: {
          not: null,
          notIn: [''],
        },
      },
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: {
          profile: {
            updatedAt: 'desc',
          },
        },
        include: {
          profile: true,
          demographic: {
            include: {
              city: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();
    const items: AdminVerificationItem[] = users.map((user) => {
      let age: number | null = null;
      if (user.demographic?.birthDate) {
        const birth = new Date(user.demographic.birthDate);
        age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
          age--;
        }
      }

      return {
        userId: user.id,
        fullName: user.profile?.fullName ?? '',
        username: user.profile?.username ?? null,
        email: user.email,
        avatarUrl: user.profile?.avatarUrl
          ? this.mediaUrlResolver.resolveUrl(user.profile.avatarUrl)
          : null,
        selfieUrl: user.profile?.selfieUrl
          ? this.mediaUrlResolver.resolveUrl(user.profile.selfieUrl)
          : null,
        gender: user.demographic?.gender ?? null,
        age,
        city: user.demographic?.city?.name ?? null,
        submittedAt: (user.profile?.updatedAt ?? user.updatedAt).toISOString(),
        createdAt: user.createdAt.toISOString(),
      };
    });

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      items,
      total,
      page: safePage,
      totalPages,
    };
  }

  async approveVerification(
    userId: number,
  ): Promise<{ userId: number; profileValidated: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { profileValidated: true },
      }),
      this.prisma.notification.create({
        data: {
          userId,
          type: NotificationType.PROFILE_VERIFIED,
          metadata: {
            message: 'Your profile has been verified successfully.',
            verifiedAt: new Date().toISOString(),
          },
          isRead: false,
        },
      }),
    ]);

    return {
      userId,
      profileValidated: true,
    };
  }

  async rejectVerification(
    userId: number,
    reason?: string,
  ): Promise<{ userId: number; profileValidated: boolean; reason: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const rejectionReason = reason?.trim() || 'Blurry face or does not match profile picture';

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { profileValidated: false },
      }),
      this.prisma.profile.update({
        where: { userId },
        data: { selfieUrl: null },
      }),
      this.prisma.notification.create({
        data: {
          userId,
          type: NotificationType.PROFILE_VERIFIED,
          metadata: {
            status: 'REJECTED',
            reason: rejectionReason,
            rejectedAt: new Date().toISOString(),
          },
          isRead: false,
        },
      }),
    ]);

    return {
      userId,
      profileValidated: false,
      reason: rejectionReason,
    };
  }
}
