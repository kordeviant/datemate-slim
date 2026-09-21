import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { UserEntity } from '../../domain/user.entity';

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
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return user ? new UserEntity(user) : null;
  }

  async create(data: {
    email: string;
    passwordHash: string;
    role?: 'USER' | 'ADMIN';
    language?: 'EN' | 'FA';
  }): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        role: data.role || 'USER',
        language: data.language || 'EN',
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
      select: { id: true, firstName: true, avatarUrl: true },
    });
    return !!(profile && profile.firstName && profile.avatarUrl);
  }
}
