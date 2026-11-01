import { Logger } from '@nestjs/common';
import { GetQuestionsUseCase } from './get-questions.use-case';
import { IQuestionRepository } from '../../domain/repositories/question.repository.interface';
import { QuestionEntity } from '../../domain/question.entity';

describe('GetQuestionsUseCase', () => {
  let useCase: GetQuestionsUseCase;
  let mockRepo: jest.Mocked<IQuestionRepository>;

  const sampleQuestions: QuestionEntity[] = [
    {
      id: 1,
      type: 'PERSONALITY',
      answerType: 'SINGLE',
      enName: 'How do you take care of yourself?',
      faName: 'چگونه از خود مراقبت می‌کنید؟',
      answers: [
        { id: 1, questionId: 1, answerEn: 'Meditation', answerFa: 'مراقبه' },
        { id: 2, questionId: 1, answerEn: 'Spending time with loved ones', answerFa: 'وقت گذراندن با عزیزان' },
      ],
    },
    {
      id: 2,
      type: 'PERSONALITY',
      answerType: 'MULTI',
      enName: 'What are you seeking?',
      faName: 'به دنبال چه چیزی هستید؟',
      answers: [
        { id: 3, questionId: 2, answerEn: 'New adventures', answerFa: 'ماجراجویی‌های جدید' },
        { id: 4, questionId: 2, answerEn: 'Meaningful connections', answerFa: 'ارتباطات معنادار' },
      ],
    },
  ];

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    mockRepo = {
      findAll: jest.fn().mockResolvedValue(sampleQuestions),
      findByType: jest.fn().mockResolvedValue(sampleQuestions),
      findById: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      countUserAnswers: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new GetQuestionsUseCase(mockRepo);
  });

  it('should return questions in English when language=en', async () => {
    const result = await useCase.execute(undefined, 'en');

    expect(mockRepo.findAll).toHaveBeenCalled();
    expect(result.language).toBe('en');
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].name).toBe('How do you take care of yourself?');
    expect(result.questions[0].answers[0].answer).toBe('Meditation');
    expect(result.questions[1].name).toBe('What are you seeking?');
  });

  it('should return questions in Farsi when language=fa', async () => {
    const result = await useCase.execute(undefined, 'fa');

    expect(result.language).toBe('fa');
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].name).toBe('چگونه از خود مراقبت می‌کنید؟');
    expect(result.questions[0].answers[0].answer).toBe('مراقبه');
  });

  it('should return all questions with bilingual fields and IDs when language is not specified', async () => {
    const result = await useCase.execute();

    expect(result.questions).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.language).toBeUndefined();
    expect(result.questions[0].id).toBe(1);
    expect(result.questions[0].enName).toBe('How do you take care of yourself?');
    expect(result.questions[0].faName).toBe('چگونه از خود مراقبت می‌کنید؟');
    expect((result.questions[0] as any).nameEn).toBeUndefined();
    expect((result.questions[0] as any).nameFa).toBeUndefined();
    expect(result.questions[0].answers[0].id).toBe(0);
    expect(result.questions[0].answers[0].questionId).toBe(1);
    expect(result.questions[0].answers[0].enAnswer).toBe('Meditation');
    expect(result.questions[0].answers[0].faAnswer).toBe('مراقبه');
    expect(result.questions[0].answers[0].answerEn).toBe('Meditation');
    expect(result.questions[0].answers[0].answerFa).toBe('مراقبه');
    expect(result.questions[0].answers[1].id).toBe(1);
    expect(result.questions[1].answers[0].id).toBe(0);
  });

  it('should return single question when id is specified', async () => {
    mockRepo.findById.mockResolvedValue(sampleQuestions[0]);

    const result = await useCase.execute(undefined, undefined, 1);

    expect(mockRepo.findById).toHaveBeenCalledWith(1);
    expect(result.total).toBe(1);
    expect(result.id).toBe(1);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].id).toBe(1);
    expect(result.question?.id).toBe(1);
    expect(result.question?.enName).toBe('How do you take care of yourself?');
    expect(result.question?.faName).toBe('چگونه از خود مراقبت می‌کنید؟');
    expect((result.question as any)?.nameEn).toBeUndefined();
    expect((result.question as any)?.nameFa).toBeUndefined();
  });

  it('should throw NotFoundException when question by id does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(undefined, undefined, 999)).rejects.toThrow(
      'Question with ID 999 not found',
    );
  });

  it('should filter by type when provided', async () => {
    await useCase.execute('PERSONALITY', 'en');

    expect(mockRepo.findByType).toHaveBeenCalledWith('PERSONALITY');
    expect(mockRepo.findAll).not.toHaveBeenCalled();
  });

  it('should call findAll when no type provided', async () => {
    await useCase.execute(undefined, 'en');

    expect(mockRepo.findAll).toHaveBeenCalled();
    expect(mockRepo.findByType).not.toHaveBeenCalled();
  });

  it('should normalize type to uppercase', async () => {
    await useCase.execute('personality', 'en');

    expect(mockRepo.findByType).toHaveBeenCalledWith('PERSONALITY');
  });

  it('should normalize language to lowercase', async () => {
    const result = await useCase.execute(undefined, 'EN');

    expect(result.language).toBe('en');
    expect(result.questions[0].name).toBe('How do you take care of yourself?');
  });

  it('should handle empty questions list', async () => {
    mockRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute(undefined, 'en');

    expect(result.questions).toHaveLength(0);
  });

  it('should resolve question icon object using MediaUrlResolverService and not send iconUrl', async () => {
    const questionWithIcon: QuestionEntity = {
      ...sampleQuestions[0],
      icon: 'icons/drink.png',
    };
    mockRepo.findAll.mockResolvedValue([questionWithIcon]);

    const mockResolver: any = {
      resolveUrl: jest.fn().mockReturnValue('http://localhost:3000/assets/icons/drink.png'),
    };
    const useCaseWithResolver = new GetQuestionsUseCase(mockRepo, mockResolver);

    const result = await useCaseWithResolver.execute();

    expect(mockResolver.resolveUrl).toHaveBeenCalledWith('icons/drink.png');
    expect(result.questions[0].icon).toEqual({
      type: 'IMAGE',
      url: 'http://localhost:3000/assets/icons/drink.png',
      alt: '',
    });
    expect((result.questions[0] as any).iconUrl).toBeUndefined();
  });

  it('should return icon: null and no iconUrl when question has no icon', async () => {
    const questionWithoutIcon: QuestionEntity = {
      ...sampleQuestions[0],
      icon: null,
    };
    mockRepo.findAll.mockResolvedValue([questionWithoutIcon]);

    const useCaseNoIcon = new GetQuestionsUseCase(mockRepo);
    const result = await useCaseNoIcon.execute();

    expect(result.questions[0].icon).toBeNull();
    expect((result.questions[0] as any).iconUrl).toBeUndefined();
  });

  it('should return alt text in icon object when iconAlt is set', async () => {
    const questionWithAlt: QuestionEntity = {
      ...sampleQuestions[0],
      icon: 'icons/self-care.png',
      iconAlt: 'Self care',
    };
    mockRepo.findAll.mockResolvedValue([questionWithAlt]);

    const mockResolver: any = {
      resolveUrl: jest.fn().mockReturnValue('https://cdn.example.com/icons/self-care.png'),
    };
    const useCaseWithResolver = new GetQuestionsUseCase(mockRepo, mockResolver);

    const result = await useCaseWithResolver.execute();

    expect(result.questions[0].icon).toEqual({
      type: 'IMAGE',
      url: 'https://cdn.example.com/icons/self-care.png',
      alt: 'Self care',
    });
  });
});
