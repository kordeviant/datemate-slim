import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { IMatchingRepository } from '../../domain/repositories/matching.repository.interface';
import { FeedCandidateEntity } from '../../domain/entities/feed-candidate.entity';
import { LikeReceivedEntity } from '../../domain/entities/like-received.entity';
import { calculateAge } from '../../../auth/application/validators/dob.validator';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';

@Injectable()
export class PrismaMatchingRepository implements IMatchingRepository {
  private readonly logger = new Logger(PrismaMatchingRepository.name);
  private readonly mediaUrlResolver: MediaUrlResolverService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Optional()
    mediaUrlResolver?: MediaUrlResolverService,
  ) {
    this.mediaUrlResolver =
      mediaUrlResolver || new MediaUrlResolverService(new ConfigService());
  }

  async getUserDemographicGender(
    userId: number,
  ): Promise<'MALE' | 'FEMALE' | null> {
    const demographic = await this.prisma.demographic.findUnique({
      where: { userId },
      select: { gender: true },
    });

    if (!demographic?.gender) {
      return null;
    }

    return demographic.gender as 'MALE' | 'FEMALE';
  }

  async findTargetUserStatus(
    userId: number,
  ): Promise<{ exists: boolean; isBanned: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, bannedUntil: true },
    });

    if (!user) {
      return { exists: false, isBanned: false };
    }

    const isBanned = !!user.bannedUntil && user.bannedUntil > new Date();
    return { exists: true, isBanned };
  }

  async recordSwipe(
    fromUserId: number,
    toUserId: number,
    direction: 'RIGHT' | 'LEFT',
  ): Promise<void> {
    const userPairKey = `${Math.min(fromUserId, toUserId)}:${Math.max(fromUserId, toUserId)}`;

    // 1. In-Memory fast deduplication buffer via Redis
    try {
      const redis = this.redisService.getClient();
      await redis.sadd(`swiped:${fromUserId}`, toUserId.toString());
      // Also store in user-pair hash with 30d TTL
      await redis.hset(
        `swipe:${userPairKey}`,
        fromUserId.toString(),
        JSON.stringify({ dir: direction, ts: Date.now() }),
      );
      await redis.expire(`swipe:${userPairKey}`, 2592000);
    } catch (err: any) {
      this.logger.warn(`Redis swipe caching warning: ${err?.message}`);
    }

    // 2. Persist Swipe Record to PostgreSQL
    await this.prisma.swipe.upsert({
      where: {
        fromUserId_toUserId: {
          fromUserId,
          toUserId,
        },
      },
      update: {
        direction,
        userPairKey,
      },
      create: {
        fromUserId,
        toUserId,
        direction,
        userPairKey,
      },
    });
  }

  async findCandidateProfiles(
    userId: number,
    targetGender: 'MALE' | 'FEMALE',
    limit: number,
  ): Promise<FeedCandidateEntity[]> {
    // Rule 1 & Rule 2: Exclude Self and users already swiped
    const swipedRecords = await this.prisma.swipe.findMany({
      where: { fromUserId: userId },
      select: { toUserId: true },
    });
    const swipedIds = new Set<number>(swipedRecords.map((s) => s.toUserId));

    try {
      const redis = this.redisService.getClient();
      const inMemorySwiped = await redis.smembers(`swiped:${userId}`);
      for (const idStr of inMemorySwiped) {
        const idNum = parseInt(idStr, 10);
        if (!isNaN(idNum)) {
          swipedIds.add(idNum);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Redis deduplication query warning: ${err?.message}`);
    }

    const excludedIds = Array.from(new Set([userId, ...swipedIds]));

    // Query candidates satisfying all 6 rules:
    // Rule 1: candidate.id != userId (not in excludedIds)
    // Rule 2: candidate not swiped (not in excludedIds)
    // Rule 3: Account Status: bannedUntil IS NULL or expired
    // Rule 4: Has Photo (avatarUrl/profilePictureUrl or gallery)
    // Rule 5: is profileValidated (User.profileValidated == true)
    // Rule 6: Gender match (Demographic.gender == targetGender)
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { notIn: excludedIds },
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
        gallery: {
          orderBy: { id: 'asc' },
        },
        interests: {
          include: {
            interest: true,
          },
        },
      },
      take: limit * 2,
      orderBy: [
        { profile: { isOnline: 'desc' } },
        { profile: { lastSeenAt: 'desc' } },
        { id: 'asc' },
      ],
    });

    const results: FeedCandidateEntity[] = [];

    for (const c of candidates) {
      if (results.length >= limit) {
        break;
      }

      // Rule 4: Must have an active profile picture
      const rawPrimaryPhoto =
        c.profile?.avatarUrl ||
        c.profile?.profilePictureUrl ||
        c.gallery.find((g) => g.isProfilePicture)?.imageUrl ||
        c.gallery[0]?.imageUrl ||
        null;

      if (!rawPrimaryPhoto || !rawPrimaryPhoto.trim()) {
        continue; // Skip profiles without an active picture
      }

      const primaryPhoto = this.mediaUrlResolver.resolveUrl(rawPrimaryPhoto);

      const age = c.demographic?.birthDate
        ? calculateAge(c.demographic.birthDate)
        : null;

      results.push({
        id: c.id,
        fullName: c.profile?.fullName || null,
        city: c.demographic?.city?.name || null,
        age,
        avatarUrl: primaryPhoto,
        username: c.profile?.username || null,
      });
    }

    return results;
  }

  async findLikesReceived(userId: number): Promise<LikeReceivedEntity[]> {
    const swipes = await this.prisma.swipe.findMany({
      where: {
        toUserId: userId,
        direction: 'RIGHT',
      },
      include: {
        fromUser: {
          include: {
            profile: {
              select: {
                fullName: true,
                username: true,
                isOnline: true,
              },
            },
            demographic: {
              include: {
                city: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return swipes.map((s) => {
      const isMockUser = s.fromUser?.email?.endsWith('@datemate.com') ?? false;
      const isOnline = isMockUser
        ? (s.fromUser.profile?.isOnline || false)
        : (s.fromUser.profile?.isOnline ?? true);

      return {
        id: s.fromUser.id,
        fullName: s.fromUser.profile?.fullName || null,
        username: s.fromUser.profile?.username || null,
        city: s.fromUser.demographic?.city?.name || null,
        isOnline,
      };
    });
  }
}
