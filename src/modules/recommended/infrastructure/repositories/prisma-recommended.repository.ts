import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import {
  CandidatePoolItem,
  IRecommendedRepository,
  UserRecommendationProfile,
} from '../../domain/repositories/recommended.repository.interface';

@Injectable()
export class PrismaRecommendedRepository implements IRecommendedRepository {
  private readonly logger = new Logger(PrismaRecommendedRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getUserProfile(
    userId: number,
  ): Promise<UserRecommendationProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        demographic: {
          include: {
            city: true,
          },
        },
        preferences: true,
        interests: {
          include: {
            interest: true,
          },
        },
        questionAnswers: true,
      },
    });

    if (!user) {
      return null;
    }

    const answerIds = user.questionAnswers.map((qa) => qa.questionAnswerId);
    const interestIds = user.interests.map((ui) => ui.interestId);
    const interestNames = user.interests
      .map((ui) => ui.interest?.nameEn || ui.interest?.nameFa || '')
      .filter((name) => Boolean(name && name.trim().length > 0));

    return {
      id: user.id,
      gender: user.demographic?.gender as 'MALE' | 'FEMALE',
      birthDate: user.demographic?.birthDate || null,
      cityId: user.demographic?.cityId || null,
      cityName: user.demographic?.city?.name || null,
      relationPreference: user.preferences?.relation || null,
      answerIds,
      interestIds,
      interestNames,
      bannedUntil: user.bannedUntil,
    };
  }

  async getSwipedUserIds(userId: number): Promise<number[]> {
    const swipedSet = new Set<number>();

    // 1. Fetch from database
    try {
      const records = await this.prisma.swipe.findMany({
        where: { fromUserId: userId },
        select: { toUserId: true },
      });
      for (const r of records) {
        swipedSet.add(r.toUserId);
      }
    } catch (err: any) {
      this.logger.error(`Error querying database swiped users: ${err?.message}`);
    }

    // 2. Fetch from Redis buffer
    try {
      const redis = this.redisService.getClient();
      const inMemorySwiped = await redis.smembers(`swiped:${userId}`);
      for (const idStr of inMemorySwiped) {
        const idNum = parseInt(idStr, 10);
        if (!isNaN(idNum)) {
          swipedSet.add(idNum);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Redis swiped query warning: ${err?.message}`);
    }

    return Array.from(swipedSet);
  }

  async getCandidatePool(
    targetGender: 'MALE' | 'FEMALE',
    excludedUserIds: number[],
    fetchLimit: number,
  ): Promise<CandidatePoolItem[]> {
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { notIn: excludedUserIds },
        profileValidated: true,
        OR: [
          { bannedUntil: null },
          { bannedUntil: { lt: new Date() } },
        ],
        demographic: {
          gender: targetGender,
        },
        profile: {
          isNot: null,
        },
      },
      include: {
        profile: true,
        demographic: {
          include: {
            city: true,
          },
        },
        preferences: true,
        gallery: {
          orderBy: { id: 'asc' },
        },
        interests: {
          include: {
            interest: true,
          },
        },
        questionAnswers: true,
      },
      take: fetchLimit,
      orderBy: [
        { profile: { isOnline: 'desc' } },
        { profile: { lastSeenAt: 'desc' } },
        { id: 'asc' },
      ],
    });

    return candidates.map((c) => {
      const interestNames = c.interests
        .map((ui) => ui.interest?.nameEn || ui.interest?.nameFa || '')
        .filter((name) => Boolean(name && name.trim().length > 0));

      const interestIds = c.interests.map((ui) => ui.interestId);
      const answerIds = c.questionAnswers.map((qa) => qa.questionAnswerId);

      return {
        id: c.id,
        fullName: c.profile?.fullName || null,
        username: c.profile?.username || null,
        gender: c.demographic?.gender || null,
        birthDate: c.demographic?.birthDate || null,
        bio: c.profile?.bio || null,
        avatarUrl: c.profile?.avatarUrl || null,
        profilePictureUrl: c.profile?.profilePictureUrl || null,
        profileValidated: c.profileValidated,
        cityId: c.demographic?.cityId || null,
        cityName: c.demographic?.city?.name || null,
        relationPreference: c.preferences?.relation || null,
        isOnline: c.profile?.isOnline || false,
        lastSeenAt: c.profile?.lastSeenAt || null,
        gallery: c.gallery.map((g) => ({
          id: g.id,
          imageUrl: g.imageUrl,
          isProfilePicture: g.isProfilePicture,
        })),
        interestNames,
        interestIds,
        answerIds,
      };
    });
  }
}
