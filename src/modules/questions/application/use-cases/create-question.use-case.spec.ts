import { BadRequestException, Logger } from '@nestjs/common';
import { CreateQuestionUseCase } from './create-question.use-case';
import { IQuestionRepository } from '../../domain/repositories/question.repository.interface';
import { CreateQuestionDto } from '../dtos/create-question.dto';

describe('CreateQuestionUseCase', () => {
  let useCase: CreateQuestionUseCase;
  let mockRepo: jest.Mocked<IQuestionRepository>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    mockRepo = {
      findAll: jest.fn(),
      findByType: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockImplementation(async (data) => ({
        id: 1,
        type: data.type,
        answerType: data.answerType || 'SINGLE',
        enName: data.enName || data.nameEn,
        faName: data.faName || data.nameFa,
        answers: data.answers.map((a: any, i: number) => ({
          id: i + 1,
          questionId: 1,
          answerEn: a.answerEn,
          answerFa: a.answerFa,
        })),
      })),
      count: jest.fn(),
      countUserAnswers: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new CreateQuestionUseCase(mockRepo);
  });

  it('should create a question with bilingual content', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      enName: 'What makes you happy?',
      faName: 'چه چیزی شما را خوشحال می‌کند؟',
      answers: [
        { answerEn: 'Spending time outdoors', answerFa: 'گذراندن وقت در فضای باز' },
        { answerEn: 'Reading books', answerFa: 'خواندن کتاب' },
      ],
    };

    const result = await useCase.execute(dto);

    expect(mockRepo.create).toHaveBeenCalledWith({
      type: 'PERSONALITY',
      answerType: 'SINGLE',
      enName: 'What makes you happy?',
      faName: 'چه چیزی شما را خوشحال می‌کند؟',
      answers: [
        { answerEn: 'Spending time outdoors', answerFa: 'گذراندن وقت در فضای باز' },
        { answerEn: 'Reading books', answerFa: 'خواندن کتاب' },
      ],
    });
    expect(result.id).toBe(1);
    expect(result.answerType).toBe('SINGLE');
    expect(result.answers).toHaveLength(2);
  });

  it('should create a question using new enName/faName and enAnswer/faAnswer keys', async () => {
    const dto: CreateQuestionDto = {
      type: 'PREFERENCES',
      enName: 'What is your communication style?',
      faName: 'سبک ارتباطی شما چگونه است؟',
      answers: [
        { enAnswer: 'Direct and honest', faAnswer: 'مستقیم و صادقانه' },
        { enAnswer: 'Thoughtful and gentle', faAnswer: 'سنجیده و ملایم' },
      ],
    };

    const result = await useCase.execute(dto);

    expect(mockRepo.create).toHaveBeenCalledWith({
      type: 'PREFERENCES',
      answerType: 'SINGLE',
      enName: 'What is your communication style?',
      faName: 'سبک ارتباطی شما چگونه است؟',
      answers: [
        { answerEn: 'Direct and honest', answerFa: 'مستقیم و صادقانه' },
        { answerEn: 'Thoughtful and gentle', answerFa: 'سنجیده و ملایم' },
      ],
    });
    expect(result.id).toBe(1);
    expect(result.answers).toHaveLength(2);
  });

  it('should throw BadRequestException when answers array is empty', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      enName: 'Test?',
      faName: 'تست؟',
      answers: [],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(dto)).rejects.toThrow('At least one answer option is required');
  });

  it('should throw BadRequestException when answer is missing English text', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      enName: 'Test?',
      faName: 'تست؟',
      answers: [
        { answerEn: '', answerFa: 'پاسخ فارسی' },
      ],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(dto)).rejects.toThrow(
      'Each answer must have both English (enAnswer) and Farsi (faAnswer) text',
    );
  });

  it('should throw BadRequestException when answer is missing Farsi text', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      enName: 'Test?',
      faName: 'تست؟',
      answers: [
        { enAnswer: 'English answer', faAnswer: '' },
      ],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when question enName is missing', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      enName: '',
      faName: 'تست؟',
      answers: [
        { enAnswer: 'Answer', faAnswer: 'پاسخ' },
      ],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(dto)).rejects.toThrow(
      'Question must have both English (enName) and Farsi (faName) text',
    );
  });

  it('should throw BadRequestException when question faName is missing', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      enName: 'Test?',
      faName: '',
      answers: [
        { answerEn: 'Answer', answerFa: 'پاسخ' },
      ],
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
  });

  it('should trim whitespace from question and answer texts', async () => {
    const dto: CreateQuestionDto = {
      type: 'PERSONALITY',
      enName: '  Spaced question?  ',
      faName: '  سوال با فاصله؟  ',
      answers: [
        { answerEn: '  Spaced answer  ', answerFa: '  پاسخ با فاصله  ' },
      ],
    };

    await useCase.execute(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        enName: 'Spaced question?',
        faName: 'سوال با فاصله؟',
        answers: [{ answerEn: 'Spaced answer', answerFa: 'پاسخ با فاصله' }],
      }),
    );
  });
});
