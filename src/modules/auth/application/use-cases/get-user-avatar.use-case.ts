import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { MediaUrlResolverService } from "../../../media/application/services/media-url-resolver.service";
import { UserAvatarDto } from "../dtos/user-avatar.dto";

@Injectable()
export class GetUserAvatarUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mediaUrlResolver?: MediaUrlResolverService,
  ) {}

  async execute(userId: number): Promise<UserAvatarDto> {
    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException("Invalid user ID");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profile: {
          select: {
            avatarUrl: true,
          },
        }
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const rawAvatar =
      user.profile?.avatarUrl ||
      null;

    let resolvedAvatar: string | null = null;
    if (rawAvatar && rawAvatar.trim()) {
      const resolved = this.mediaUrlResolver
        ? this.mediaUrlResolver.resolveUrl(rawAvatar)
        : rawAvatar;
      resolvedAvatar = resolved && resolved.trim() ? resolved.trim() : null;
    }

    return {
      id: user.id,
      avatarUrl: resolvedAvatar,
    };
  }
}
