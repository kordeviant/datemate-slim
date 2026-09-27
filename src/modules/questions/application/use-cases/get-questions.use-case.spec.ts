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
      nameEn: 'How do you take care of yourself?',
      nameFa: 'چگونه از خود مراقبت می‌کنید؟',
      answers: [
        { id: 1, questionId: 1, answerEn: 'Meditation', answerFa: 'مراقبه' },
        { id: 2, questionId: 1, answerEn: 'Spending time with loved ones', answerFa: 'وقت گذراندن با عزیزان' },
      ],
    },
    {
      id: 2,
      type: 'PERSONALITY',
      nameEn: 'What are you seeking?',
      nameFa: 'به دنبال چه چیزی هستید؟',
      answers: [
        { id: 3, questionId: 2, answerEn: 'New adventures', answerFa: 'ماجراجویی‌های جدید' },
        { id: 4, questionId: 2, answerEn: 'Meaningful connections', answerFa: 'ارتباطات معنادار' },
      ],
    },
  ];

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn().mockResolvedValue(sampleQuestions),
      findByType: jest.fn().mockResolvedValue(sampleQuestions),
      findById: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      countUserAnswers: jest.fn(),
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

  it('should return both languages when language is not specified', async () => {
    const result = await useCase.execute();

    expect(result.questions).toHaveLength(4); // 2 questions x 2 languages
    expect(result.language).toBeUndefined();
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
});
