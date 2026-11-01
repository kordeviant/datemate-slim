import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  CreateInterestCategoryData,
  IInterestRepository,
} from '../../domain/repositories/interest.repository.interface';
import {
  InterestCategoryEntity,
  InterestEntity,
} from '../../domain/interest.entity';

@Injectable()
export class PrismaInterestRepository implements IInterestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllCategories(): Promise<InterestCategoryEntity[]> {
    const categories = await this.prisma.interestCategory.findMany({
      include: { interests: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    });

    return categories.map((c) => this.mapCategory(c));
  }

  async findCategoryById(id: number): Promise<InterestCategoryEntity | null> {
    const category = await this.prisma.interestCategory.findUnique({
      where: { id },
      include: { interests: { orderBy: { id: 'asc' } } },
    });

    if (!category) return null;
    return this.mapCategory(category);
  }

  async createCategory(
    data: CreateInterestCategoryData,
  ): Promise<InterestCategoryEntity> {
    const category = await this.prisma.interestCategory.create({
      data: {
        nameEn: data.enName,
        nameFa: data.faName,
        media: data.icon,
        interests: {
          create: data.interests.map((i) => ({
            nameEn: i.enName,
            nameFa: i.faName,
            media: i.icon,
          })),
        },
      },
      include: { interests: { orderBy: { id: 'asc' } } },
    });

    return this.mapCategory(category);
  }

  async countCategories(): Promise<number> {
    return this.prisma.interestCategory.count();
  }

  private mapCategory(c: any): InterestCategoryEntity {
    return {
      id: c.id,
      enName: c.nameEn,
      faName: c.nameFa,
      icon: c.media,
      iconAlt: null,
      interests: (c.interests || []).map(
        (i: any): InterestEntity => ({
          id: i.id,
          categoryId: i.categoryId,
          enName: i.nameEn,
          faName: i.nameFa,
          icon: i.media,
          iconAlt: null,
        }),
      ),
    };
  }
}
