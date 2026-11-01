import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateQuestionUseCase } from './update-question.use-case';
import { IQuestionRepository } from '../../domain/repositories/question.repository.interface';
import { QuestionEntity } from '../../domain/question.entity';

describe('UpdateQuestionUseCase', () => {
  let useCase: UpdateQuestionUseCase;
  let mockRepo: jest.Mocked<IQuestionRepository>;

  const existingQuestion: QuestionEntity = {
    id: 1,
    type: 'PERSONALITY',
    answerType: 'SINGLE',
    nameEn: 'Old English',
    nameFa: 'قدیمی فارسی',
    enName: 'Old English',
    faName: 'قدیمی فارسی',
    icon: 'icons/old.png',
    answers: [
      { id: 10, questionId: 1, answerEn: 'Yes', answerFa: 'بله' },
    ],
  };

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn(),
      findByType: jest.fn(),
      findById: jest.fn().mockResolvedValue(existingQuestion),
      create: jest.fn(),
      update: jest.fn().mockImplementation((id, data) =>
        Promise.resolve({
          ...existingQuestion,
          ...data,
          answers: data.answers?.map((a: any, idx: number) => ({
            id: 20 + idx,
            questionId: id,
            answerEn: a.answerEn,
            answerFa: a.answerFa,
          })) || existingQuestion.answers,
        }),
      ),
      delete: jest.fn().mockResolvedValue(true),
      count: jest.fn().mockResolvedValue(1),
      countUserAnswers: jest.fn().mockResolvedValue(0),
    };

    useCase = new UpdateQuestionUseCase(mockRepo);
  });

  it('should update question fields successfully', async () => {
    const result = await useCase.execute(1, {
      enName: 'Updated English',
      faName: 'آپدیت شده فارسی',
      icon: 'icons/new.png',
      iconAlt: 'New Icon',
    });

    expect(mockRepo.findById).toHaveBeenCalledWith(1);
    expect(mockRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({
      enName: 'Updated English',
      faName: 'آپدیت شده فارسی',
      icon: 'icons/new.png',
      iconAlt: 'New Icon',
    }));
    expect(result.enName).toBe('Updated English');
  });

  it('should throw NotFoundException if question does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(999, { enName: 'Something' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if empty answers array is passed', async () => {
    await expect(
      useCase.execute(1, { answers: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if an answer lacks English or Farsi', async () => {
    await expect(
      useCase.execute(1, {
        answers: [{ enAnswer: 'Only English', faAnswer: '' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if empty enName is passed', async () => {
    await expect(
      useCase.execute(1, { enName: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if empty faName is passed', async () => {
    await expect(
      useCase.execute(1, { faName: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });
});
