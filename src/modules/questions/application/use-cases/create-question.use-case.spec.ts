import { BadRequestException } from '@nestjs/common';
import { CreateQuestionUseCase } from './create-question.use-case';
import { IQuestionRepository } from '../../domain/repositories/question.repository.interface';
import { CreateQuestionDto } from '../dtos/create-question.dto';

describe('CreateQuestionUseCase', () => {
  let useCase: CreateQuestionUseCase;
  let mockRepo: jest.Mocked<IQuestionRepository>;

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn(),
      findByType: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockImplementation(async (data) => ({
        id: 1,
        type: data.type,
        nameEn: data.nameEn,
        nameFa: data.nameFa,
        answers: data.answers.map((a: any, i: number) => ({
          id: i + 1,
          questionId: 1,
          answerEn: a.answerEn,
          answerFa: a.answerFa,
        })),
      })),
      count: jest.fn(),
      countUserAnswers: jest.fn(),
    };

    useCase = new CreateQuestionUseCase(mockRepo);
  });

  it('should create a question with bilingual content', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      nameEn: 'What makes you happy?',
      nameFa: 'چه چیزی شما را خوشحال می‌کند؟',
      answers: [
        { answerEn: 'Spending time outdoors', answerFa: 'گذراندن وقت در فضای باز' },
        { answerEn: 'Reading books', answerFa: 'خواندن کتاب' },
      ],
    };

    const result = await useCase.execute(dto);

    expect(mockRepo.create).toHaveBeenCalledWith({
      type: 'PERSONALITY',
      nameEn: 'What makes you happy?',
      nameFa: 'چه چیزی شما را خوشحال می‌کند؟',
      answers: [
        { answerEn: 'Spending time outdoors', answerFa: 'گذراندن وقت در فضای باز' },
        { answerEn: 'Reading books', answerFa: 'خواندن کتاب' },
      ],
    });
    expect(result.id).toBe(1);
    expect(result.answers).toHaveLength(2);
  });

  it('should throw BadRequestException when answers array is empty', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      nameEn: 'Test?',
      nameFa: 'تست؟',
      answers: [],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(dto)).rejects.toThrow('At least one answer option is required');
  });

  it('should throw BadRequestException when answer is missing English text', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      nameEn: 'Test?',
      nameFa: 'تست؟',
      answers: [
        { answerEn: '', answerFa: 'پاسخ فارسی' },
      ],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(dto)).rejects.toThrow(
      'Each answer must have both English (answerEn) and Farsi (answerFa) text',
    );
  });

  it('should throw BadRequestException when answer is missing Farsi text', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      nameEn: 'Test?',
      nameFa: 'تست؟',
      answers: [
        { answerEn: 'English answer', answerFa: '' },
      ],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when question nameEn is missing', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      nameEn: '',
      nameFa: 'تست؟',
      answers: [
        { answerEn: 'Answer', answerFa: 'پاسخ' },
      ],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(dto)).rejects.toThrow(
      'Question must have both English (nameEn) and Farsi (nameFa) text',
    );
  });

  it('should throw BadRequestException when question nameFa is missing', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      nameEn: 'Test?',
      nameFa: '',
      answers: [
        { answerEn: 'Answer', answerFa: 'پاسخ' },
      ],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
  });

  it('should trim whitespace from question and answer texts', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      nameEn: '  Spaced question?  ',
      nameFa: '  سوال با فاصله؟  ',
      answers: [
        { answerEn: '  Spaced answer  ', answerFa: '  پاسخ با فاصله  ' },
      ],
    };

    await useCase.execute(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nameEn: 'Spaced question?',
        nameFa: 'سوال با فاصله؟',
        answers: [{ answerEn: 'Spaced answer', answerFa: 'پاسخ با فاصله' }],
      }),
    );
  });
});
