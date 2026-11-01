import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  CreateQuestionData,
  UpdateQuestionData,
  IQuestionRepository,
} from '../../domain/repositories/question.repository.interface';
import { QuestionEntity } from '../../domain/question.entity';

@Injectable()
export class PrismaQuestionRepository implements IQuestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<QuestionEntity[]> {
    const questions = await this.prisma.question.findMany({
      include: { answers: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    return questions.map((q) => ({
      id: q.id,
      type: q.type,
      answerType: q.answerType,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      enName: q.nameEn,
      faName: q.nameFa,
      icon: q.icon,
      iconAlt: q.iconAlt,
      answers: q.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
        enAnswer: a.answerEn,
        faAnswer: a.answerFa,
      })),
    }));
  }

  async findByType(type: string): Promise<QuestionEntity[]> {
    const upperType = type.trim().toUpperCase().replace(/[-\s.]+/g, '_');
    if (!upperType) {
      return [];
    }

    const questions = await this.prisma.question.findMany({
      where: { type: upperType },
      include: { answers: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    return questions.map((q) => ({
      id: q.id,
      type: q.type,
      answerType: q.answerType,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      enName: q.nameEn,
      faName: q.nameFa,
      icon: q.icon,
      iconAlt: q.iconAlt,
      answers: q.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
        enAnswer: a.answerEn,
        faAnswer: a.answerFa,
      })),
    }));
  }

  async findById(id: number): Promise<QuestionEntity | null> {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: { answers: { orderBy: { id: 'asc' } } },
    });
    if (!q) return null;
    return {
      id: q.id,
      type: q.type,
      answerType: q.answerType,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      enName: q.nameEn,
      faName: q.nameFa,
      icon: q.icon,
      iconAlt: q.iconAlt,
      answers: q.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
        enAnswer: a.answerEn,
        faAnswer: a.answerFa,
      })),
    };
  }

  async create(data: CreateQuestionData): Promise<QuestionEntity> {
    const q = await this.prisma.question.create({
      data: {
        type: data.type as any,
        answerType: (data.answerType as any) || 'SINGLE',
        nameEn: data.enName || data.nameEn || '',
        nameFa: data.faName || data.nameFa || '',
        icon: data.icon,
        iconAlt: data.iconAlt,
        answers: {
          create: data.answers.map((a) => ({
            answerEn: a.answerEn,
            answerFa: a.answerFa,
          })),
        },
      },
      include: { answers: { orderBy: { id: 'asc' } } },
    });
    return {
      id: q.id,
      type: q.type,
      answerType: q.answerType,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      enName: q.nameEn,
      faName: q.nameFa,
      icon: q.icon,
      iconAlt: q.iconAlt,
      answers: q.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
        enAnswer: a.answerEn,
        faAnswer: a.answerFa,
      })),
    };
  }

  async update(id: number, data: UpdateQuestionData): Promise<QuestionEntity> {
    const updateData: any = {};
    if (data.type) updateData.type = data.type as any;
    if (data.answerType) updateData.answerType = data.answerType as any;
    if (data.enName !== undefined || data.nameEn !== undefined) {
      updateData.nameEn = data.enName ?? data.nameEn;
    }
    if (data.faName !== undefined || data.nameFa !== undefined) {
      updateData.nameFa = data.faName ?? data.nameFa;
    }
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.iconAlt !== undefined) updateData.iconAlt = data.iconAlt;

    if (data.answers && data.answers.length > 0) {
      return this.prisma.$transaction(async (tx) => {
        await tx.questionAnswer.deleteMany({ where: { questionId: id } });
        const q = await tx.question.update({
          where: { id },
          data: {
            ...updateData,
            answers: {
              create: data.answers!.map((a) => ({
                answerEn: a.enAnswer || a.answerEn || '',
                answerFa: a.faAnswer || a.answerFa || '',
              })),
            },
          },
          include: { answers: { orderBy: { id: 'asc' } } },
        });
        return this.mapToEntity(q);
      });
    }

    const q = await this.prisma.question.update({
      where: { id },
      data: updateData,
      include: { answers: { orderBy: { id: 'asc' } } },
    });
    return this.mapToEntity(q);
  }

  async delete(id: number): Promise<boolean> {
    await this.prisma.question.delete({
      where: { id },
    });
    return true;
  }

  async count(): Promise<number> {
    return this.prisma.question.count();
  }

  async countUserAnswers(userId: number): Promise<number> {
    return this.prisma.userQuestionAnswer.count({
      where: { userId },
    });
  }

  private mapToEntity(q: any): QuestionEntity {
    return {
      id: q.id,
      type: q.type,
      answerType: q.answerType,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      enName: q.nameEn,
      faName: q.nameFa,
      icon: q.icon,
      iconAlt: q.iconAlt,
      answers: (q.answers || []).map((a: any) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
        enAnswer: a.answerEn,
        faAnswer: a.answerFa,
      })),
    };
  }
}
