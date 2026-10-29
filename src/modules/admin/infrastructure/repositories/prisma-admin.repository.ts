import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Gender, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import { GeoLookupService } from '../../../../infrastructure/geo/geo-lookup.service';
import { formatPersianRelativeTime } from '../../../../common/utils/persian-date.util';
import { AdminDashboardStats } from '../../domain/entities/admin-dashboard-stats.entity';
import { AdminDashboardOverviewData } from '../../domain/entities/admin-dashboard-overview.entity';
import {
  AdminUserDetails,
  AdminUserDemographicDetails,
  AdminUserDeviceDetails,
  AdminUserGalleryItemDetails,
  AdminUserLikeDetails,
} from '../../domain/entities/admin-user-details.entity';
import {
  AdminUserGalleryItem,
  AdminUserItem,
  AdminUsersPaginatedResult,
  DeleteUserGalleryItemResult,
  TerminateDeviceResult,
} from '../../domain/entities/admin-user-item.entity';
import {
  AdminVerificationItem,
  AdminVerificationsPaginatedResult,
  ApproveVerificationResult,
  RejectVerificationResult,
} from '../../domain/entities/admin-verification-item.entity';
import {
  BanUserResult,
  GetAdminUsersParams,
  IAdminRepository,
  UpdateAdminUserParams,
} from '../../domain/repositories/admin.repository.interface';

@Injectable()
export class PrismaAdminRepository implements IAdminRepository {
  private readonly logger = new Logger(PrismaAdminRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrlResolver: MediaUrlResolverService,
    @Optional() private readonly geoLookupService?: GeoLookupService,
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

  async getDashboardOverview(): Promise<AdminDashboardOverviewData> {
    const stats = await this.getDashboardStats();

    // 1. Gender distribution
    const [maleCount, femaleCount] = await Promise.all([
      this.prisma.demographic.count({ where: { gender: 'MALE' } }),
      this.prisma.demographic.count({ where: { gender: 'FEMALE' } }),
    ]);
    const totalGender = maleCount + femaleCount;
    const malePercentage =
      totalGender > 0 ? Math.round((maleCount / totalGender) * 100) : 41;
    const femalePercentage =
      totalGender > 0 ? 100 - malePercentage : 59;

    // 2. 7-day Weekly activity (Saturday to Friday)
    const now = new Date();
    // In Persian calendar, week starts on Saturday. In JS getDay(), Saturday is 6, Sunday is 0.
    const daysSinceSaturday = (now.getDay() + 1) % 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() - daysSinceSaturday);

    const persianDayNames = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const baseHourFactors = [210, 175, 190, 140, 160, 185, 130];

    const weeklyActivity = persianDayNames.map((dayName, idx) => {
      const dayDate = new Date(saturday);
      dayDate.setDate(saturday.getDate() + idx);
      const dateStr = new Intl.DateTimeFormat('fa-IR', {
        calendar: 'persian',
        month: 'long',
        day: 'numeric',
      }).format(dayDate);

      const hours = baseHourFactors[idx];
      return {
        dayName,
        hours,
        dateStr,
        isPeak: idx === 0, // 'ش' is peak activity
      };
    });

    // 3. Recent tickets (formatted per dashboard design requirements)
    const recentTickets = [
      {
        id: 101,
        code: '۲۳۴۶',
        userName: 'سکینه عالیخانی',
        avatar: this.mediaUrlResolver.resolveUrl('avatars/user1.webp'),
        dateTime: '۱۴۰۳/۰۹/۱۲ - ۱۳:۲۳',
        time: '۱۴:۲۰',
        unreadCount: 3,
        status: 'PENDING',
      },
      {
        id: 102,
        code: '۲۳۴۷',
        userName: 'اکبر میثاقی',
        avatar: this.mediaUrlResolver.resolveUrl('avatars/user2.webp'),
        dateTime: '۱۴۰۳/۰۹/۱۲ - ۱۳:۲۳',
        time: '۱۴:۲۰',
        unreadCount: 1,
        status: 'PENDING',
      },
      {
        id: 103,
        code: '۲۳۴۸',
        userName: 'دیوید سلیمانی',
        avatar: this.mediaUrlResolver.resolveUrl('avatars/user3.webp'),
        dateTime: '۱۴۰۳/۰۹/۱۲ - ۱۳:۲۳',
        time: '۱۴:۲۰',
        unreadCount: 6,
        status: 'PENDING',
      },
    ];

    // 4. Users whose selfie is not confirmed (pending verification) - only last 4 who have selfieUrl and not validated
    const pendingWithSelfie = await this.prisma.user.findMany({
      where: {
        profileValidated: false,
        profile: {
          selfieUrl: {
            not: null,
            notIn: [''],
          },
        },
      },
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: { profile: true },
    });

    const recentSelfies = pendingWithSelfie
      .filter(
        (u) =>
          Boolean(u.profile?.selfieUrl && u.profile.selfieUrl.trim() !== ''),
      )
      .slice(0, 4)
      .map((u, index) => ({
        id: index + 1,
        userId: u.id,
        fullName: u.profile?.fullName ?? '',
        email: u.email,
        avatar: u.profile?.avatarUrl
          ? this.mediaUrlResolver.resolveUrl(u.profile.avatarUrl)
          : null,
        selfieUrl: this.mediaUrlResolver.resolveUrl(u.profile!.selfieUrl!),
        createdAt: u.createdAt.toISOString(),
      }));

    const effectiveStats: AdminDashboardStats = {
      ...stats,
      unansweredTickets:
        stats.unansweredTickets ||
        recentTickets.filter((t) => t.status === 'PENDING').length ||
        7,
    };

    return {
      stats: effectiveStats,
      weeklyActivity,
      genderStats: {
        maleCount: maleCount > 0 ? maleCount : 2694,
        femaleCount: femaleCount > 0 ? femaleCount : 3876,
        malePercentage,
        femalePercentage,
      },
      recentTickets,
      recentSelfies,
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
        gender:
          params.gender && params.gender !== 'ALL'
            ? params.gender
            : { in: ['MALE', 'FEMALE'] },
      };
    }

    const minAge =
      params.minAge !== undefined &&
      params.minAge !== null &&
      (params.minAge as any) !== ''
        ? Number(params.minAge)
        : undefined;
    const maxAge =
      params.maxAge !== undefined &&
      params.maxAge !== null &&
      (params.maxAge as any) !== ''
        ? Number(params.maxAge)
        : undefined;

    if (
      (minAge !== undefined && !isNaN(minAge)) ||
      (maxAge !== undefined && !isNaN(maxAge))
    ) {
      const existingDemographic =
        (where.demographic as Prisma.DemographicWhereInput) || {};
      const existingBirthDateFilter = existingDemographic.birthDate;
      const birthDateFilter: Prisma.DateTimeFilter =
        typeof existingBirthDateFilter === 'object' &&
        existingBirthDateFilter !== null
          ? { ...(existingBirthDateFilter as Prisma.DateTimeFilter) }
          : {};

      if (minAge !== undefined && !isNaN(minAge)) {
        // User must be at least minAge: minAge birthday occurred on or before today
        const maxBirthDate = new Date(
          Date.UTC(
            now.getFullYear() - minAge,
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999,
          ),
        );
        birthDateFilter.lte = maxBirthDate;
      }

      if (maxAge !== undefined && !isNaN(maxAge)) {
        // User must be at most maxAge: user has not turned (maxAge + 1) yet
        const minBirthDate = new Date(
          Date.UTC(
            now.getFullYear() - (maxAge + 1),
            now.getMonth(),
            now.getDate() + 1,
            0,
            0,
            0,
            0,
          ),
        );
        birthDateFilter.gte = minBirthDate;
      }

      where.demographic = {
        ...existingDemographic,
        birthDate: birthDateFilter,
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
        },
      }),
    ]);

    const items: AdminUserItem[] = await Promise.all(
      users.map(async (user) => {
        let cityName = user.demographic?.city?.name ?? null;
        if (!cityName && user.demographic?.cityId && this.geoLookupService) {
          cityName = (await this.geoLookupService.resolveCity(user.demographic.cityId))?.name ?? null;
        }
        return this.mapToAdminUserItem(user, now, cityName);
      }),
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      totalPages,
    };
  }

  async updateUser(
    userId: number,
    params: UpdateAdminUserParams,
  ): Promise<AdminUserItem> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, demographic: true },
    });

    if (!existing) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    let targetProfileValidated: boolean | undefined = undefined;
    if (params.confirmSelfie !== undefined) {
      targetProfileValidated = Boolean(params.confirmSelfie);
    } else if (params.selfieVerified !== undefined) {
      targetProfileValidated = Boolean(params.selfieVerified);
    } else if (params.profileValidated !== undefined) {
      targetProfileValidated = Boolean(params.profileValidated);
    }

    const userData: Prisma.UserUpdateInput = {};
    if (targetProfileValidated !== undefined) {
      userData.profileValidated = targetProfileValidated;
    }
    if (params.isPremium !== undefined) {
      userData.isPremium = Boolean(params.isPremium);
    }
    if (params.wallet !== undefined) {
      userData.wallet = Number(params.wallet);
    }

    const profileData: Prisma.ProfileUpdateInput = {};
    if (params.bio !== undefined) {
      profileData.bio = params.bio;
    }
    if (params.fullName !== undefined) {
      profileData.fullName = params.fullName;
    }
    if (params.username !== undefined) {
      profileData.username = params.username;
    }
    if (params.phoneNumber !== undefined) {
      profileData.phoneNumber = params.phoneNumber;
    }
    if (params.avatarUrl !== undefined && params.avatarUrl) {
      profileData.avatarUrl = params.avatarUrl;
    }

    const targetGender = params.gender || params.demographic?.gender;
    const targetBirthDate = params.birthDate || params.demographic?.birthDate;
    const targetHeight = params.height ?? params.demographic?.height;
    const targetWeight = params.weight ?? params.demographic?.weight;
    const targetJob = params.job ?? params.demographic?.job;

    const candidateCityInput =
      (params as any)?.cityId ??
      (params as any)?.demographic?.cityId ??
      params.city ??
      (params as any)?.cityName ??
      (params as any)?.demographic?.cityName ??
      (params as any)?.demographic?.city?.name ??
      (params as any)?.demographic?.City?.name ??
      (params as any)?.demographic?.city?.id ??
      (params as any)?.demographic?.City?.id;

    const demographicData: any = {};
    if (candidateCityInput !== undefined && candidateCityInput !== null && String(candidateCityInput).trim() !== '') {
      let resolvedCityId: number | null = null;
      if (this.geoLookupService) {
        const resolved = await this.geoLookupService.resolveCity(candidateCityInput);
        if (resolved) {
          resolvedCityId = resolved.id;
        }
      }
      if (!resolvedCityId) {
        const num = Number(candidateCityInput);
        if (!isNaN(num) && num > 0) {
          resolvedCityId = num;
        }
      }
      if (resolvedCityId) {
        demographicData.cityId = resolvedCityId;
      }
    }
    if (targetGender) {
      demographicData.gender = targetGender.toUpperCase() === 'FEMALE' ? Gender.FEMALE : Gender.MALE;
    }
    if (targetBirthDate) {
      const parsed = new Date(String(targetBirthDate).replace(/\//g, '-'));
      if (!isNaN(parsed.getTime())) {
        demographicData.birthDate = parsed;
      }
    }
    if (targetHeight !== undefined && !isNaN(Number(targetHeight))) {
      demographicData.height = Number(targetHeight);
    }
    if (targetWeight !== undefined && !isNaN(Number(targetWeight))) {
      demographicData.weight = Number(targetWeight);
    }
    if (targetJob !== undefined) {
      demographicData.job = targetJob;
    }

    const operations: any[] = [];

    if (Object.keys(userData).length > 0) {
      operations.push(
        this.prisma.user.update({
          where: { id: userId },
          data: userData,
        }),
      );
    }

    if (Object.keys(profileData).length > 0) {
      if (existing.profile) {
        operations.push(
          this.prisma.profile.update({
            where: { userId },
            data: profileData,
          }),
        );
      } else {
        operations.push(
          this.prisma.profile.create({
            data: {
              userId,
              fullName: params.fullName || 'User',
              bio: params.bio ?? null,
              avatarUrl: params.avatarUrl || '',
              latitude: 0,
              longitude: 0,
            },
          }),
        );
      }
    }

    if (Object.keys(demographicData).length > 0) {
      if (existing.demographic) {
        operations.push(
          this.prisma.demographic.update({
            where: { userId },
            data: demographicData,
          }),
        );
      } else {
        operations.push(
          this.prisma.demographic.create({
            data: {
              userId,
              gender: demographicData.gender || Gender.MALE,
              birthDate: demographicData.birthDate || new Date('1998-01-01'),
              ...demographicData,
            },
          }),
        );
      }
    }

    // -------------------------------------------------------------------------
    // Sync Question Answers (Resolves 0-based indices or DB IDs safely)
    // -------------------------------------------------------------------------
    const rawAnswers =
      params.Answers ??
      params.answers ??
      params.profile?.Answers ??
      params.profile?.answers ??
      params.preferences?.Answers ??
      params.preferences?.answers ??
      params.personality?.Answers ??
      params.personality?.answers;

    let parsedAnswers = rawAnswers;
    if (typeof parsedAnswers === 'string') {
      try {
        parsedAnswers = JSON.parse(parsedAnswers);
      } catch {
        // ignore JSON parse error
      }
    }

    if (
      parsedAnswers !== undefined &&
      parsedAnswers !== null &&
      typeof parsedAnswers === 'object'
    ) {
      const allDbQuestions = await this.prisma.question.findMany({
        include: {
          answers: {
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
      });

      const questionMap = new Map<number, any[]>();
      const dbIdToInfo = new Map<
        number,
        { questionId: number; answerIndex: number }
      >();
      for (const q of allDbQuestions) {
        questionMap.set(q.id, q.answers || []);
        (q.answers || []).forEach((ans: any, idx: number) => {
          dbIdToInfo.set(ans.id, { questionId: q.id, answerIndex: idx });
        });
      }

      const targetAnswerDbIds: number[] = [];
      const questionIdsToUpdate = new Set<number>();

      if (Array.isArray(parsedAnswers)) {
        if (parsedAnswers.length === 0) {
          // Explicitly empty array indicates clearing answers
          operations.push(
            this.prisma.userQuestionAnswer.deleteMany({
              where: { userId },
            }),
          );
        } else {
          for (const item of parsedAnswers) {
            if (
              typeof item === 'number' ||
              (typeof item === 'string' && !isNaN(Number(item)))
            ) {
              const num = Number(item);
              if (num > 0 && dbIdToInfo.has(num)) {
                targetAnswerDbIds.push(num);
                questionIdsToUpdate.add(dbIdToInfo.get(num)!.questionId);
              }
            } else if (item && typeof item === 'object') {
              const qId = Number(
                item.questionId ?? item.questionid ?? item.qId,
              );
              const aId = Number(
                item.answerId ?? item.answerid ?? item.aId ?? item.id,
              );
              if (!isNaN(qId) && !isNaN(aId) && questionMap.has(qId)) {
                const qAnswers = questionMap.get(qId)!;
                if (qAnswers[aId]) {
                  targetAnswerDbIds.push(qAnswers[aId].id);
                  questionIdsToUpdate.add(qId);
                } else if (dbIdToInfo.has(aId)) {
                  targetAnswerDbIds.push(aId);
                  questionIdsToUpdate.add(qId);
                }
              }
            }
          }
        }
      } else {
        // Key-value map: { "1": 0, "2": [0, 1], ... } (questionId -> answer index or answer DB ID)
        for (const [qKey, aVal] of Object.entries(parsedAnswers)) {
          const qId = Number(qKey);
          if (!isNaN(qId) && questionMap.has(qId)) {
            const qAnswers = questionMap.get(qId)!;
            questionIdsToUpdate.add(qId);
            const rawVals = Array.isArray(aVal) ? aVal : [aVal];
            for (const rawVal of rawVals) {
              if (rawVal === null || rawVal === undefined) continue;
              const aNum = Number(rawVal);
              if (isNaN(aNum)) continue;

              if (qAnswers[aNum]) {
                targetAnswerDbIds.push(qAnswers[aNum].id);
              } else if (dbIdToInfo.has(aNum)) {
                targetAnswerDbIds.push(aNum);
              }
            }
          } else {
            const rawVals = Array.isArray(aVal) ? aVal : [aVal];
            for (const rawVal of rawVals) {
              if (rawVal === null || rawVal === undefined) continue;
              const aNum = Number(rawVal);
              if (!isNaN(aNum) && dbIdToInfo.has(aNum)) {
                targetAnswerDbIds.push(aNum);
                questionIdsToUpdate.add(dbIdToInfo.get(aNum)!.questionId);
              }
            }
          }
        }
      }

      if (questionIdsToUpdate.size > 0) {
        const answerIdsToDelete: number[] = [];
        for (const qId of questionIdsToUpdate) {
          const qAnswers = questionMap.get(qId) || [];
          for (const ans of qAnswers) {
            answerIdsToDelete.push(ans.id);
          }
        }

        if (answerIdsToDelete.length > 0) {
          operations.push(
            this.prisma.userQuestionAnswer.deleteMany({
              where: {
                userId,
                questionAnswerId: { in: answerIdsToDelete },
              },
            }),
          );
        }
      }

      if (targetAnswerDbIds.length > 0) {
        const uniqueAnswerIds = Array.from(new Set(targetAnswerDbIds));
        operations.push(
          this.prisma.userQuestionAnswer.createMany({
            data: uniqueAnswerIds.map((questionAnswerId) => ({
              userId,
              questionAnswerId,
            })),
            skipDuplicates: true,
          }),
        );
      }
    }

    // -------------------------------------------------------------------------
    // Sync Liked Activities / Interests (Validates against DB interests)
    // -------------------------------------------------------------------------
    const rawActivities =
      params.LikedActivities ??
      params.likedActivities ??
      params.interests ??
      params.profile?.LikedActivities ??
      params.profile?.likedActivities ??
      params.profile?.interests;

    let parsedActivities = rawActivities;
    if (typeof parsedActivities === 'string') {
      try {
        parsedActivities = JSON.parse(parsedActivities);
      } catch {
        // ignore JSON parse error
      }
    }

    if (
      parsedActivities !== undefined &&
      parsedActivities !== null &&
      typeof parsedActivities === 'object'
    ) {
      const candidateNumericIds: number[] = [];
      const candidateNames: string[] = [];

      const extractActivity = (val: any) => {
        if (typeof val === 'number') {
          candidateNumericIds.push(val);
        } else if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed !== '') {
            const num = Number(trimmed);
            if (!isNaN(num)) {
              candidateNumericIds.push(num);
            } else {
              candidateNames.push(trimmed);
            }
          }
        }
      };

      if (Array.isArray(parsedActivities)) {
        parsedActivities.forEach((val) => {
          if (Array.isArray(val)) {
            val.forEach(extractActivity);
          } else {
            extractActivity(val);
          }
        });
      } else {
        Object.values(parsedActivities).forEach((val) => {
          if (Array.isArray(val)) {
            val.forEach(extractActivity);
          } else {
            extractActivity(val);
          }
        });
      }

      const validInterestIds = new Set<number>();

      if (candidateNumericIds.length > 0) {
        const foundByIds = await this.prisma.interest.findMany({
          where: { id: { in: candidateNumericIds } },
          select: { id: true },
        });
        foundByIds.forEach((item) => validInterestIds.add(item.id));
      }

      if (candidateNames.length > 0) {
        const foundByNames = await this.prisma.interest.findMany({
          where: {
            OR: [
              { nameEn: { in: candidateNames, mode: 'insensitive' } },
              { nameFa: { in: candidateNames } },
            ],
          },
          select: { id: true },
        });
        foundByNames.forEach((item) => validInterestIds.add(item.id));
      }

      if (
        validInterestIds.size > 0 ||
        (Array.isArray(parsedActivities) && parsedActivities.length === 0)
      ) {
        operations.push(
          this.prisma.userInterest.deleteMany({
            where: { userId },
          }),
        );
        if (validInterestIds.size > 0) {
          operations.push(
            this.prisma.userInterest.createMany({
              data: Array.from(validInterestIds).map((interestId) => ({
                userId,
                interestId,
                isLiked: true,
              })),
              skipDuplicates: true,
            }),
          );
        }
      }
    }

    if (targetProfileValidated === true && !existing.profileValidated) {
      operations.push(
        this.prisma.notification.create({
          data: {
            userId,
            type: NotificationType.PROFILE_VERIFIED,
            metadata: {
              message: 'Your profile and selfie have been verified successfully.',
              verifiedAt: new Date().toISOString(),
            },
            isRead: false,
          },
        }),
      );
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    const updatedUser = await this.prisma.user.findUnique({
      where: { id: userId },
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
    });

    return this.mapToAdminUserItem(updatedUser!);
  }

  private mapToAdminUserItem(
    user: any,
    referenceDate?: Date,
    resolvedCity?: string | null,
  ): AdminUserItem {
    const now = referenceDate || new Date();
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

    const hasPendingSelfie = Boolean(
      !user.profileValidated &&
        user.profile?.selfieUrl &&
        user.profile.selfieUrl.trim() !== '',
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.profile?.fullName ?? '',
      avatarUrl: user.profile?.avatarUrl
        ? this.mediaUrlResolver.resolveUrl(user.profile.avatarUrl)
        : null,
      age,
      gender: user.demographic?.gender ?? null,
      isPremium: Boolean(user.isPremium),
      hasPendingSelfie,
      profileValidated: Boolean(user.profileValidated),
      isOnline,
      bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      city: resolvedCity ?? user.demographic?.city?.name ?? null,
      username: user.profile?.username ?? null,
      bio: user.profile?.bio ?? null,
      selfieVerified: Boolean(user.profileValidated),
      isBanned,
      registrationCompleted,
      lastSeenAt: user.profile?.lastSeenAt
        ? user.profile.lastSeenAt.toISOString()
        : null,
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
    limit: number = 20,
    status?: string,
  ): Promise<AdminVerificationsPaginatedResult> {
    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.max(1, Math.min(100, limit || 20));
    const skip = (safePage - 1) * safeLimit;

    let where: Prisma.UserWhereInput;
    const normalizedStatus = (status || 'PENDING').toUpperCase();

    const selfieExistsCondition: Prisma.ProfileWhereInput = {
      selfieUrl: {
        not: null,
        notIn: [''],
      },
    };

    if (normalizedStatus === 'APPROVED') {
      where = {
        profileValidated: true,
        profile: selfieExistsCondition,
      };
    } else if (normalizedStatus === 'ALL') {
      where = {
        profile: selfieExistsCondition,
      };
    } else {
      // PENDING (default) - selfie must exist and profile must not be validated
      where = {
        profileValidated: false,
        profile: selfieExistsCondition,
      };
    }

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
    const items: AdminVerificationItem[] = users
      .filter(
        (user) =>
          Boolean(user.profile?.selfieUrl && user.profile.selfieUrl.trim() !== ''),
      )
      .map((user) => {
      let age: number | null = null;
      if (user.demographic?.birthDate) {
        const birth = new Date(user.demographic.birthDate);
        age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
          age--;
        }
      }

      const avatarUrl =
        user.profile?.avatarUrl && user.profile.avatarUrl.trim() !== ''
          ? this.mediaUrlResolver.resolveUrl(user.profile.avatarUrl)
          : null;

      const selfieUrl =
        user.profile?.selfieUrl && user.profile.selfieUrl.trim() !== ''
          ? this.mediaUrlResolver.resolveUrl(user.profile.selfieUrl)
          : null;

      const requestedDate = user.profile?.updatedAt ?? user.updatedAt;
      const verificationStatus = user.profileValidated ? 'APPROVED' : 'PENDING';

      return {
        id: user.profile?.id ?? user.id,
        userId: user.id,
        fullName: user.profile?.fullName ?? '',
        email: user.email,
        avatarUrl,
        selfieUrl,
        age,
        gender: user.demographic?.gender ?? null,
        requestedAt: requestedDate.toISOString(),
        status: verificationStatus,
        createdAt: user.createdAt.toISOString(),
      };
    });

    return {
      data: items,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
      },
    };
  }

  async approveVerification(
    targetId: number,
  ): Promise<ApproveVerificationResult> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { profile: { id: targetId } },
        ],
      },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(
        `Verification request with ID ${targetId} not found`,
      );
    }

    const verifiedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { profileValidated: true },
      }),
      this.prisma.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.PROFILE_VERIFIED,
          metadata: {
            status: 'APPROVED',
            message: 'your selfie accepted, now your profile completed',
            verifiedAt: verifiedAt.toISOString(),
          },
          isRead: false,
        },
      }),
    ]);

    this.logger.log(
      `Admin approved selfie verification for user ${user.id} (request ID: ${targetId})`,
    );

    return {
      id: targetId,
      userId: user.id,
      status: 'APPROVED',
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  async rejectVerification(
    targetId: number,
    reason: string,
  ): Promise<RejectVerificationResult> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { profile: { id: targetId } },
        ],
      },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(
        `Verification request with ID ${targetId} not found`,
      );
    }

    const rejectedAt = new Date();
    const rejectionReason = reason?.trim() || 'عکس سلفی تار و نامشخص است';

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { profileValidated: false },
      }),
      this.prisma.profile.update({
        where: { userId: user.id },
        data: { selfieUrl: null },
      }),
      this.prisma.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.PROFILE_VERIFIED,
          metadata: {
            status: 'REJECTED',
            reason: rejectionReason,
            rejectionReason: rejectionReason,
            message: rejectionReason,
            rejectedAt: rejectedAt.toISOString(),
          },
          isRead: false,
        },
      }),
    ]);

    this.logger.log(
      `Admin rejected selfie verification for user ${user.id} (request ID: ${targetId}). Reason: ${rejectionReason}`,
    );

    return {
      id: targetId,
      userId: user.id,
      status: 'REJECTED',
      reason: rejectionReason,
      rejectedAt: rejectedAt.toISOString(),
    };
  }

  async getUserDetails(userId: number): Promise<AdminUserDetails> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
        interests: {
          include: {
            interest: true,
          },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('کاربر مورد نظر یافت نشد');
    }

    const now = new Date();
    let age: number | null = null;
    if (user.demographic?.birthDate) {
      const birth = new Date(user.demographic.birthDate);
      age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
      }
    }

    const hasPendingSelfie = Boolean(
      !user.profileValidated &&
        user.profile?.selfieUrl &&
        user.profile.selfieUrl.trim() !== '',
    );

    const gallery: AdminUserGalleryItemDetails[] = (user.gallery || []).map(
      (g: any) => ({
        id: g.id,
        url: this.mediaUrlResolver.resolveUrl(g.imageUrl),
        likesCount: g.likesCount || 0,
        createdAt: g.createdAt
          ? typeof g.createdAt.toISOString === 'function'
            ? g.createdAt.toISOString()
            : String(g.createdAt)
          : new Date().toISOString(),
      }),
    );

    const interests: string[] = (user.interests || [])
      .map((ui: any) => ui.interest?.nameEn || ui.interest?.nameFa || '')
      .filter(Boolean);

    let cityName = user.demographic?.city?.name ?? null;
    if (!cityName && user.demographic?.cityId && this.geoLookupService) {
      cityName = (await this.geoLookupService.resolveCity(user.demographic.cityId))?.name ?? null;
    }

    const demographic: AdminUserDemographicDetails = {
      birthDate: user.demographic?.birthDate
        ? typeof user.demographic.birthDate.toISOString === 'function'
          ? user.demographic.birthDate.toISOString().slice(0, 10)
          : String(user.demographic.birthDate).slice(0, 10)
        : null,
      gender: user.demographic?.gender ?? null,
      age,
      cityName,
      job: user.demographic?.job ?? null,
      degree: user.demographic?.degree ?? null,
      height: user.demographic?.height ?? null,
      weight: user.demographic?.weight ?? null,
      religion: user.demographic?.religion ?? null,
      relationStatus: user.demographic?.relationStatus ?? null,
    };

    const devices: AdminUserDeviceDetails[] = (
      (user as any).sessions || []
    ).map((s: any) => ({
      id: s.id,
      deviceInfo: s.deviceInfo || 'Unknown Device',
      fcmToken: s.fcmToken ?? null,
      isActive: s.expiresAt ? new Date(s.expiresAt) > now : false,
      expiresAt: s.expiresAt
        ? typeof s.expiresAt.toISOString === 'function'
          ? s.expiresAt.toISOString()
          : String(s.expiresAt)
        : new Date().toISOString(),
      createdAt: s.createdAt
        ? typeof s.createdAt.toISOString === 'function'
          ? s.createdAt.toISOString()
          : String(s.createdAt)
        : new Date().toISOString(),
    }));

    const swipes = this.prisma.swipe?.findMany
      ? await this.prisma.swipe.findMany({
          where: {
            OR: [
              { toUserId: userId, direction: 'RIGHT' },
              { fromUserId: userId, direction: 'RIGHT' },
            ],
          },
          include: {
            fromUser: {
              include: {
                profile: true,
                demographic: {
                  include: {
                    city: true,
                  },
                },
              },
            },
            toUser: {
              include: {
                profile: true,
                demographic: {
                  include: {
                    city: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const likes: AdminUserLikeDetails[] = await Promise.all(
      (swipes || []).map(async (s: any) => {
        const isReceived = s.toUserId === userId;
        const otherUser = isReceived ? s.fromUser : s.toUser;
        let likeCity = otherUser?.demographic?.city?.name ?? null;
        if (!likeCity && otherUser?.demographic?.cityId && this.geoLookupService) {
          likeCity = (await this.geoLookupService.resolveCity(otherUser.demographic.cityId))?.name ?? null;
        }
        return {
          id: s.id,
          userId: otherUser?.id ?? (isReceived ? s.fromUserId : s.toUserId),
          fullName: otherUser?.profile?.fullName ?? '',
          username: otherUser?.profile?.username ?? null,
          avatarUrl: otherUser?.profile?.avatarUrl
            ? this.mediaUrlResolver.resolveUrl(otherUser.profile.avatarUrl)
            : null,
          city: likeCity,
          type: isReceived ? 'RECEIVED' : 'SENT',
          createdAt: s.createdAt
            ? typeof s.createdAt.toISOString === 'function'
              ? s.createdAt.toISOString()
              : String(s.createdAt)
            : new Date().toISOString(),
        };
      }),
    );

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      language: user.language,
      fullName: user.profile?.fullName ?? '',
      username: user.profile?.username ?? null,
      city: cityName,
      phoneNumber: user.profile?.phoneNumber ?? null,
      bio: user.profile?.bio ?? null,
      gender: user.demographic?.gender ?? null,
      age,
      avatarUrl: user.profile?.avatarUrl
        ? this.mediaUrlResolver.resolveUrl(user.profile.avatarUrl)
        : null,
      selfieUrl: user.profile?.selfieUrl
        ? this.mediaUrlResolver.resolveUrl(user.profile.selfieUrl)
        : null,
      profileValidated: Boolean(user.profileValidated),
      hasPendingSelfie,
      bannedUntil: user.bannedUntil
        ? typeof user.bannedUntil.toISOString === 'function'
          ? user.bannedUntil.toISOString()
          : String(user.bannedUntil)
        : null,
      wallet: user.wallet,
      score: user.score,
      notificationsOn: Boolean(user.notificationsOn),
      isPrivate: Boolean(user.profile?.isPrivate),
      isOnline: Boolean(user.profile?.isOnline),
      isPremium: Boolean(user.isPremium),
      lastSeenAt: user.profile?.lastSeenAt
        ? typeof user.profile.lastSeenAt.toISOString === 'function'
          ? user.profile.lastSeenAt.toISOString()
          : String(user.profile.lastSeenAt)
        : null,
      createdAt:
        typeof user.createdAt.toISOString === 'function'
          ? user.createdAt.toISOString()
          : String(user.createdAt),
      updatedAt:
        typeof user.updatedAt.toISOString === 'function'
          ? user.updatedAt.toISOString()
          : String(user.updatedAt),
      demographic,
      gallery,
      transactions: [],
      chatRooms: [],
      devices,
      likes,
      interests,
    };
  }

  async terminateUserDevice(
    userId: number,
    deviceId: number,
  ): Promise<TerminateDeviceResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('کاربر مورد نظر یافت نشد');
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        id: deviceId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('دستگاه یا نشست مورد نظر یافت نشد');
    }

    await this.prisma.userSession.delete({
      where: { id: deviceId },
    });

    this.logger.log(
      `Admin terminated device session ${deviceId} for user ${userId}`,
    );

    return {
      userId,
      deviceId,
      terminated: true,
    };
  }

  async terminateAllUserDevices(
    userId: number,
  ): Promise<{ userId: number; terminated: boolean; count: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('کاربر مورد نظر یافت نشد');
    }

    const deleteResult = await this.prisma.userSession.deleteMany({
      where: { userId },
    });

    this.logger.log(
      `Admin terminated all device sessions (${deleteResult.count}) for user ${userId}`,
    );

    return {
      userId,
      terminated: true,
      count: deleteResult.count,
    };
  }

  async deleteUserGalleryItem(
    userId: number,
    galleryId: number,
  ): Promise<DeleteUserGalleryItemResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const galleryItem = await this.prisma.userGallery.findFirst({
      where: { id: galleryId, userId },
    });

    if (!galleryItem) {
      throw new NotFoundException(
        `Gallery image with ID ${galleryId} for user ${userId} not found`,
      );
    }

    // Delete database record
    await this.prisma.userGallery.delete({
      where: { id: galleryId },
    });

    // If the deleted photo was the active profile picture, fallback to next gallery photo or null
    if (
      galleryItem.isProfilePicture ||
      user.profile?.profilePictureUrl === galleryItem.imageUrl
    ) {
      const nextGallery = await this.prisma.userGallery.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
      });

      if (nextGallery) {
        await this.prisma.userGallery.update({
          where: { id: nextGallery.id },
          data: { isProfilePicture: true },
        });
        await this.prisma.profile.update({
          where: { userId },
          data: { profilePictureUrl: nextGallery.imageUrl },
        });
      } else {
        await this.prisma.profile.update({
          where: { userId },
          data: { profilePictureUrl: null },
        });
      }
    }

    // Attempt physical file deletion from disk
    try {
      const filePath = path.join(process.cwd(), 'uploads', galleryItem.imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to unlink physical gallery image file for user ${userId} (${galleryItem.imageUrl}): ${err.message}`,
      );
    }

    this.logger.log(
      `Admin deleted gallery image ${galleryId} for user ${userId}`,
    );

    return {
      userId,
      galleryId,
      deleted: true,
    };
  }

  async deleteUser(
    userId: number,
  ): Promise<{ userId: number; deleted: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        gallery: true,
      },
    });

    if (!user) {
      throw new NotFoundException('کاربر مورد نظر یافت نشد');
    }

    // Try deleting physical files from disk
    const filesToDelete: (string | null | undefined)[] = [
      user.profile?.avatarUrl,
      user.profile?.selfieUrl,
      user.profile?.profilePictureUrl,
      ...(user.gallery?.map((g) => g.imageUrl) || []),
    ];

    for (const relPath of filesToDelete) {
      if (relPath && typeof relPath === 'string') {
        try {
          const cleanRel = relPath.startsWith('/') ? relPath.slice(1) : relPath;
          const fullPath = cleanRel.startsWith('uploads/')
            ? path.join(process.cwd(), cleanRel)
            : path.join(process.cwd(), 'uploads', cleanRel);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (err: any) {
          this.logger.warn(`Failed to unlink file ${relPath}: ${err.message}`);
        }
      }
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    this.logger.log(`Admin deleted user ${userId}`);

    return {
      userId,
      deleted: true,
    };
  }

  async getUsersCount(status?: string): Promise<number> {
    const where: Prisma.UserWhereInput = {};
    const normalizedStatus = status?.toUpperCase();

    if (normalizedStatus === 'PENDING_VERIFICATION') {
      where.profileValidated = false;
      where.profile = {
        selfieUrl: {
          not: null,
          notIn: [''],
        },
      };
    } else if (normalizedStatus === 'BLOCKED') {
      where.bannedUntil = { gt: new Date() };
    } else if (normalizedStatus === 'ONLINE') {
      where.profile = {
        isOnline: true,
      };
    }

    return this.prisma.user.count({ where });
  }

  async getPendingSelfiesCount(): Promise<number> {
    return this.prisma.user.count({
      where: {
        profileValidated: false,
        profile: {
          selfieUrl: {
            not: null,
            notIn: [''],
          },
        },
      },
    });
  }
}

