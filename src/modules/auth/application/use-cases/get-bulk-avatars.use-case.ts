import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { MediaUrlResolverService } from "../../../media/application/services/media-url-resolver.service";
import { UserAvatarDto } from "../dtos/user-avatar.dto";

@Injectable()
export class GetBulkAvatarsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mediaUrlResolver?: MediaUrlResolverService,
  ) {}

  async execute(ids: number[]): Promise<UserAvatarDto[]> {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(
      new Set(
        ids
          .map((id) => (typeof id === "string" ? parseInt(id, 10) : Number(id)))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    if (uniqueIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        profile: {
          select: {
            avatarUrl: true,
            profilePictureUrl: true,
          },
        },
        gallery: {
          select: {
            imageUrl: true,
            isProfilePicture: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const userMap = new Map<number, UserAvatarDto>();
    for (const user of users) {
      const profilePicGallery = user.gallery?.find((g) => g.isProfilePicture);
      const rawAvatar =
        profilePicGallery?.imageUrl ||
        user.profile?.profilePictureUrl ||
        user.profile?.avatarUrl ||
        user.gallery?.[0]?.imageUrl ||
        null;

      let resolvedAvatar: string | null = null;
      if (rawAvatar && rawAvatar.trim()) {
        const resolved = this.mediaUrlResolver
          ? this.mediaUrlResolver.resolveUrl(rawAvatar)
          : rawAvatar;
        resolvedAvatar = resolved && resolved.trim() ? resolved.trim() : null;
      }

      userMap.set(user.id, {
        id: user.id,
        avatarUrl: resolvedAvatar,
      });
    }

    const result: UserAvatarDto[] = [];
    for (const id of uniqueIds) {
      const item = userMap.get(id);
      if (item) {
        result.push(item);
      }
    }

    return result;
  }
}
