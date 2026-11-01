import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { IUserRepository } from "../../domain/repositories/user.repository.interface";
import { UserEntity } from "../../domain/user.entity";

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  private readonly logger = new Logger(PrismaUserRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user ? new UserEntity(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    if (!email) return null;
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalized,
          mode: 'insensitive',
        },
      },
    });
    return user ? new UserEntity(user) : null;
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    if (!username) return null;
    const normalized = username.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: {
        profile: {
          username: {
            equals: normalized,
            mode: 'insensitive',
          },
        },
      },
    });
    return user ? new UserEntity(user) : null;
  }

  async findByEmailOrUsername(identifier: string): Promise<UserEntity | null> {
    if (!identifier) return null;
    const normalized = identifier.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            email: {
              equals: normalized,
              mode: 'insensitive',
            },
          },
          {
            profile: {
              username: {
                equals: normalized,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
    });
    return user ? new UserEntity(user) : null;
  }

  async create(data: {
    email: string;
    passwordHash: string;
    role?: "USER" | "ADMIN";
    language?: "EN" | "FA";
  }): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        role: data.role || "USER",
        language: data.language || "EN",
      },
    });
    return new UserEntity(user);
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async hasCompletedProfile(userId: number): Promise<boolean> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        username: true,
        languages: true,
        relationType: true,
      },
    });
    if (
      !profile ||
      !profile.fullName ||
      !profile.avatarUrl ||
      !profile.username ||
      !profile.languages ||
      !Array.isArray(profile.languages) ||
      profile.languages.length === 0
    ) {
      return false;
    }

    const demographic = await this.prisma.demographic.findUnique({
      where: { userId },
      select: {
        id: true,
        birthDate: true,
        gender: true,
        height: true,
        degree: true,
        job: true,
        relationStatus: true,
      },
    });
    if (
      !demographic ||
      !demographic.birthDate ||
      !demographic.gender ||
      demographic.height == null ||
      !demographic.degree ||
      !demographic.job ||
      !demographic.relationStatus
    ) {
      return false;
    }

    const hasRelation = !!(profile as any)?.relationType;
    if (!hasRelation) {
      const preferences = await this.prisma.preferences.findUnique({
        where: { userId },
        select: { id: true, relation: true },
      });
      if (!preferences || !preferences.relation) {
        return false;
      }
    }

    const EXCLUDED_QUESTION_TYPES = ['PREFERENCES', 'INTERESTS'];

    const questionsCount = await this.prisma.question.count({
      where: {
        type: {
          notIn: EXCLUDED_QUESTION_TYPES as any,
        },
      },
    });
    if (questionsCount > 0) {
      const userAnswers = await this.prisma.userQuestionAnswer.findMany({
        where: { userId },
        include: {
          questionAnswer: {
            include: { question: true },
          },
        },
      });
      const distinctQuestionsAnswered = new Set(
        userAnswers
          .filter((ua: any) => {
            const qType = ua.questionAnswer?.question?.type;
            return (
              !qType ||
              !EXCLUDED_QUESTION_TYPES.includes(String(qType).toUpperCase())
            );
          })
          .map((ua) => ua.questionAnswer.questionId),
      );
      if (distinctQuestionsAnswered.size < questionsCount) {
        return false;
      }
    }

    return true;
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
      throw new NotFoundException(`User with ID ${userId} not found`);
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

    this.logger.log(`User ${userId} deleted successfully`);

    return { userId, deleted: true };
  }

  async deleteGalleryItem(
    userId: number,
    galleryId: number,
  ): Promise<{ userId: number; galleryId: number; deleted: boolean }> {
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
      const cleanRel = galleryItem.imageUrl.startsWith('/')
        ? galleryItem.imageUrl.slice(1)
        : galleryItem.imageUrl;
      const fullPath = cleanRel.startsWith('uploads/')
        ? path.join(process.cwd(), cleanRel)
        : path.join(process.cwd(), 'uploads', cleanRel);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to unlink physical gallery image file for user ${userId} (${galleryItem.imageUrl}): ${err.message}`,
      );
    }

    this.logger.log(`User ${userId} deleted gallery image ${galleryId}`);

    return {
      userId,
      galleryId,
      deleted: true,
    };
  }
}

