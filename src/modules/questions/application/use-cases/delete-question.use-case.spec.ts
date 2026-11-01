import { NotFoundException } from '@nestjs/common';
import { DeleteQuestionUseCase } from './delete-question.use-case';
import { IQuestionRepository } from '../../domain/repositories/question.repository.interface';
import { QuestionEntity } from '../../domain/question.entity';

describe('DeleteQuestionUseCase', () => {
  let useCase: DeleteQuestionUseCase;
  let mockRepo: jest.Mocked<IQuestionRepository>;

  const existingQuestion: QuestionEntity = {
    id: 1,
    type: 'PERSONALITY',
    answerType: 'SINGLE',
    nameEn: 'Question 1',
    nameFa: 'سوال ۱',
    enName: 'Question 1',
    faName: 'سوال ۱',
    answers: [],
  };

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn(),
      findByType: jest.fn(),
      findById: jest.fn().mockResolvedValue(existingQuestion),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(true),
      count: jest.fn(),
      countUserAnswers: jest.fn(),
    };

    useCase = new DeleteQuestionUseCase(mockRepo);
  });

  it('should delete existing question and return success message', async () => {
    const result = await useCase.execute(1);

    expect(mockRepo.findById).toHaveBeenCalledWith(1);
    expect(mockRepo.delete).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      success: true,
      message: 'Question #1 deleted successfully',
    });
  });

  it('should throw NotFoundException if question does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });
});
