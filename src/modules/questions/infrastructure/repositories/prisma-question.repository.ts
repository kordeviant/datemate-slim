import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  CreateQuestionData,
  IQuestionRepository,
} from '../../domain/repositories/question.repository.interface';
import { QuestionEntity } from '../../domain/question.entity';

@Injectable()
export class PrismaQuestionRepository implements IQuestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<QuestionEntity[]> {
    const questions = await this.prisma.question.findMany({
      include: { answers: true },
      orderBy: { id: 'asc' },
    });
    return questions.map((q) => ({
      id: q.id,
      type: q.type,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      answers: q.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
      })),
    }));
  }

  async findByType(type: string): Promise<QuestionEntity[]> {
    const questions = await this.prisma.question.findMany({
      where: { type: type as any },
      include: { answers: true },
      orderBy: { id: 'asc' },
    });
    return questions.map((q) => ({
      id: q.id,
      type: q.type,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      answers: q.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
      })),
    }));
  }

  async findById(id: number): Promise<QuestionEntity | null> {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: { answers: true },
    });
    if (!q) return null;
    return {
      id: q.id,
      type: q.type,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      answers: q.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
      })),
    };
  }

  async create(data: CreateQuestionData): Promise<QuestionEntity> {
    const q = await this.prisma.question.create({
      data: {
        type: data.type as any,
        nameEn: data.nameEn,
        nameFa: data.nameFa,
        answers: {
          create: data.answers.map((a) => ({
            answerEn: a.answerEn,
            answerFa: a.answerFa,
          })),
        },
      },
      include: { answers: true },
    });
    return {
      id: q.id,
      type: q.type,
      nameEn: q.nameEn,
      nameFa: q.nameFa,
      answers: q.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        answerEn: a.answerEn,
        answerFa: a.answerFa,
      })),
    };
  }

  async count(): Promise<number> {
    return this.prisma.question.count();
  }

  async countUserAnswers(userId: number): Promise<number> {
    return this.prisma.userQuestionAnswer.count({
      where: { userId },
    });
  }
}
