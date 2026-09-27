import { Injectable } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
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
    const validTypes = Object.values(QuestionType);
    const upperType = type.toUpperCase() as QuestionType;
    if (!validTypes.includes(upperType)) {
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
        nameEn: data.nameEn,
        nameFa: data.nameFa,
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

  async count(): Promise<number> {
    return this.prisma.question.count();
  }

  async countUserAnswers(userId: number): Promise<number> {
    return this.prisma.userQuestionAnswer.count({
      where: { userId },
    });
  }
}
