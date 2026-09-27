import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { IUserRepository } from "../../domain/repositories/user.repository.interface";
import { UserEntity } from "../../domain/user.entity";

@Injectable()
export class PrismaUserRepository implements IUserRepository {
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

    const preferences = await this.prisma.preferences.findUnique({
      where: { userId },
      select: { id: true, relation: true },
    });
    if (!preferences || !preferences.relation) {
      return false;
    }

    const questionsCount = await this.prisma.question.count();
    if (questionsCount > 0) {
      const userAnswers = await this.prisma.userQuestionAnswer.findMany({
        where: { userId },
        include: {
          questionAnswer: {
            select: { questionId: true },
          },
        },
      });
      const distinctQuestionsAnswered = new Set(
        userAnswers.map((ua) => ua.questionAnswer.questionId),
      );
      if (distinctQuestionsAnswered.size < questionsCount) {
        return false;
      }
    }

    return true;
  }
}
