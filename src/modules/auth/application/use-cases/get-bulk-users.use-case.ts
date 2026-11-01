import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { MediaUrlResolverService } from "../../../media/application/services/media-url-resolver.service";
import { BulkUserItemDto } from "../dtos/bulk-user-item.dto";

@Injectable()
export class GetBulkUsersUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mediaUrlResolver?: MediaUrlResolverService,
  ) {}

  async execute(ids: number[]): Promise<BulkUserItemDto[]> {
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
            fullName: true,
            username: true,
            avatarUrl: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    const userMap = new Map<number, BulkUserItemDto>();
    for (const user of users) {
      const profile = user.profile;
      const rawAvatar = profile?.avatarUrl || profile?.profilePictureUrl || null;
      let resolvedAvatar: string | null = null;
      if (rawAvatar) {
        const resolved = this.mediaUrlResolver
          ? this.mediaUrlResolver.resolveUrl(rawAvatar)
          : rawAvatar;
        resolvedAvatar = resolved && resolved.trim() ? resolved.trim() : null;
      }

      userMap.set(user.id, {
        id: user.id,
        avatar: resolvedAvatar,
        username: profile?.username || null,
        fullName: profile?.fullName || (profile as any)?.firstName || null,
      });
    }

    const result: BulkUserItemDto[] = [];
    for (const id of uniqueIds) {
      const item = userMap.get(id);
      if (item) {
        result.push(item);
      }
    }

    return result;
  }
}
