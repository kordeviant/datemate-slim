import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import { IFriendRepository } from '../../domain/repositories/friend.repository.interface';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';
import { FriendRequestEntity } from '../../domain/entities/friend-request.entity';
import { FriendUserEntity } from '../../domain/entities/friend-user.entity';
import { FriendItemEntity } from '../../domain/entities/friend-item.entity';

@Injectable()
export class PrismaFriendRepository implements IFriendRepository {
  private readonly logger = new Logger(PrismaFriendRepository.name);
  private readonly mediaUrlResolver: MediaUrlResolverService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    mediaUrlResolver?: MediaUrlResolverService,
  ) {
    this.mediaUrlResolver =
      mediaUrlResolver || new MediaUrlResolverService(new ConfigService());
  }

  async findUserById(
    userId: number,
  ): Promise<{ id: number; isBanned: boolean; fullName?: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        bannedUntil: true,
        profile: { select: { fullName: true } },
      },
    });

    if (!user) {
      return null;
    }

    const isBanned = !!user.bannedUntil && user.bannedUntil > new Date();
    return {
      id: user.id,
      isBanned,
      fullName: user.profile?.fullName || 'Unknown name',
    };
  }

  async createRequest(
    senderId: number,
    receiverId: number,
  ): Promise<FriendRequestEntity> {
    const created = await this.prisma.friendRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId,
        },
      },
      update: {
        status: FriendRequestStatus.PENDING,
        updatedAt: new Date(),
      },
      create: {
        senderId,
        receiverId,
        status: FriendRequestStatus.PENDING,
      },
      include: {
        sender: {
          include: {
            profile: true,
            demographic: { include: { city: true } },
            gallery: { orderBy: { id: 'asc' } },
          },
        },
        receiver: {
          include: {
            profile: true,
            demographic: { include: { city: true } },
            gallery: { orderBy: { id: 'asc' } },
          },
        },
      },
    });

    return this.mapRequestToEntity(created);
  }

  async findRequestById(id: number): Promise<FriendRequestEntity | null> {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id },
      include: {
        sender: {
          include: {
            profile: true,
            demographic: { include: { city: true } },
            gallery: { orderBy: { id: 'asc' } },
          },
        },
        receiver: {
          include: {
            profile: true,
            demographic: { include: { city: true } },
            gallery: { orderBy: { id: 'asc' } },
          },
        },
      },
    });

    if (!request) {
      return null;
    }

    return this.mapRequestToEntity(request);
  }

  async findRequestBetweenUsers(
    userAId: number,
    userBId: number,
  ): Promise<FriendRequestEntity | null> {
    const request = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: userAId, receiverId: userBId },
          { senderId: userBId, receiverId: userAId },
        ],
      },
      include: {
        sender: {
          include: {
            profile: true,
            demographic: { include: { city: true } },
            gallery: { orderBy: { id: 'asc' } },
          },
        },
        receiver: {
          include: {
            profile: true,
            demographic: { include: { city: true } },
            gallery: { orderBy: { id: 'asc' } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!request) {
      return null;
    }

    return this.mapRequestToEntity(request);
  }

  async updateRequestStatus(
    id: number,
    status: FriendRequestStatus,
  ): Promise<FriendRequestEntity> {
    const updated = await this.prisma.friendRequest.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: {
        sender: {
          include: {
            profile: true,
            demographic: { include: { city: true } },
            gallery: { orderBy: { id: 'asc' } },
          },
        },
        receiver: {
          include: {
            profile: true,
            demographic: { include: { city: true } },
            gallery: { orderBy: { id: 'asc' } },
          },
        },
      },
    });

    return this.mapRequestToEntity(updated);
  }

  async getReceivedRequests(
    userId: number,
    options: { page: number; limit: number; status?: FriendRequestStatus },
  ): Promise<{ items: FriendRequestEntity[]; total: number }> {
    const skip = (options.page - 1) * options.limit;
    const where: any = {
      receiverId: userId,
    };
    if (options.status) {
      where.status = options.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.friendRequest.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            include: {
              profile: true,
              demographic: { include: { city: true } },
              gallery: { orderBy: { id: 'asc' } },
            },
          },
        },
      }),
      this.prisma.friendRequest.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapRequestToEntity(item)),
      total,
    };
  }

  async getSentRequests(
    userId: number,
    options: { page: number; limit: number; status?: FriendRequestStatus },
  ): Promise<{ items: FriendRequestEntity[]; total: number }> {
    const skip = (options.page - 1) * options.limit;
    const where: any = {
      senderId: userId,
    };
    if (options.status) {
      where.status = options.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.friendRequest.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          receiver: {
            include: {
              profile: true,
              demographic: { include: { city: true } },
              gallery: { orderBy: { id: 'asc' } },
            },
          },
        },
      }),
      this.prisma.friendRequest.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapRequestToEntity(item)),
      total,
    };
  }

  async getFriends(
    userId: number,
    options: { page: number; limit: number; search?: string },
  ): Promise<{ items: FriendItemEntity[]; total: number }> {
    const skip = (options.page - 1) * options.limit;

    // Conditions: accepted requests where current user is either sender or receiver
    const baseWhere: any = {
      status: FriendRequestStatus.ACCEPTED,
      OR: [{ senderId: userId }, { receiverId: userId }],
    };

    if (options.search) {
      const search = options.search;
      baseWhere.AND = [
        {
          OR: [
            {
              sender: {
                profile: {
                  OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { username: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              receiver: {
                profile: {
                  OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { username: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        },
      ];
    }

    const [requests, total] = await Promise.all([
      this.prisma.friendRequest.findMany({
        where: baseWhere,
        skip,
        take: options.limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          sender: {
            include: {
              profile: true,
              demographic: { include: { city: true } },
              gallery: { orderBy: { id: 'asc' } },
            },
          },
          receiver: {
            include: {
              profile: true,
              demographic: { include: { city: true } },
              gallery: { orderBy: { id: 'asc' } },
            },
          },
        },
      }),
      this.prisma.friendRequest.count({ where: baseWhere }),
    ]);

    const items: FriendItemEntity[] = requests.map((req) => {
      // The friend is the other party in the friend request
      const friendUser = req.senderId === userId ? req.receiver : req.sender;
      return {
        id: req.id,
        status: req.status as FriendRequestStatus,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        fullName: friendUser?.profile?.fullName || null,
        username: friendUser?.profile?.username || null,
        avatarUrl: this.resolveAvatarUrl(friendUser),
      };
    });

    return { items, total };
  }

  async deleteFriendship(userAId: number, targetId: number): Promise<boolean> {
    // 1. Try finding by friend_requests ID where status = ACCEPTED and user is participant
    let request = await this.prisma.friendRequest.findFirst({
      where: {
        id: targetId,
        status: FriendRequestStatus.ACCEPTED,
        OR: [{ senderId: userAId }, { receiverId: userAId }],
      },
    });

    // 2. If not found by request ID, try finding by other user's ID
    if (!request) {
      request = await this.prisma.friendRequest.findFirst({
        where: {
          status: FriendRequestStatus.ACCEPTED,
          OR: [
            { senderId: userAId, receiverId: targetId },
            { senderId: targetId, receiverId: userAId },
          ],
        },
      });
    }

    if (!request) {
      return false;
    }

    await this.prisma.friendRequest.delete({
      where: { id: request.id },
    });

    return true;
  }

  async createFriendRequestNotification(
    receiverId: number,
    senderId: number,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: receiverId,
        type: NotificationType.FRIEND_REQUEST,
        metadata: {
          senderId,
          type: 'FRIEND_REQUEST',
          createdAt: new Date().toISOString(),
        },
      },
    });
  }

  private mapRequestToEntity(raw: any): FriendRequestEntity {
    return {
      id: raw.id,
      senderId: raw.senderId,
      receiverId: raw.receiverId,
      status: raw.status as FriendRequestStatus,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      sender: raw.sender ? this.mapUserToFriendEntity(raw.sender) : undefined,
      receiver: raw.receiver ? this.mapUserToFriendEntity(raw.receiver) : undefined,
    };
  }

  private mapUserToFriendEntity(user: any): FriendUserEntity {
    const isMockUser = user?.email?.endsWith('@datemate.com') ?? false;
    const isOnline = isMockUser
      ? (user?.profile?.isOnline || false)
      : (user?.profile?.isOnline ?? true);

    const avatarUrl = this.resolveAvatarUrl(user);

    // Strict canonical city: string | null (no duplicate aliases per Rule 6)
    const city =
      user?.demographic?.city?.name ||
      user?.demographic?.cityName ||
      null;

    return {
      id: user.id,
      fullName: user.profile?.fullName || null,
      username: user.profile?.username || null,
      avatarUrl,
      city,
      isOnline,
    };
  }

  private resolveAvatarUrl(user: any): string | null {
    const profilePicGallery = user?.gallery?.find(
      (g: any) => g.isProfilePicture,
    );
    const rawPrimaryPhoto =
      profilePicGallery?.imageUrl ||
      user?.gallery?.[0]?.imageUrl ||
      user?.profile?.profilePictureUrl ||
      user?.profile?.avatarUrl ||
      null;

    return rawPrimaryPhoto
      ? this.mediaUrlResolver.resolveUrl(rawPrimaryPhoto)
      : null;
  }
}
