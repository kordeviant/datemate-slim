import { UnauthorizedException } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { GetQuestionsUseCase } from '../application/use-cases/get-questions.use-case';
import { CreateQuestionUseCase } from '../application/use-cases/create-question.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('QuestionsController', () => {
  let controller: QuestionsController;
  let getQuestionsUseCase: jest.Mocked<GetQuestionsUseCase>;
  let createQuestionUseCase: jest.Mocked<CreateQuestionUseCase>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    getQuestionsUseCase = {
      execute: jest.fn().mockResolvedValue({
        questions: [{ id: 1, type: 'PERSONALITY', name: 'Test?', answers: [] }],
        type: 'PERSONALITY',
        language: 'en',
      }),
    } as any;

    createQuestionUseCase = {
      execute: jest.fn().mockResolvedValue({
        id: 1,
        type: 'PERSONALITY',
        enName: 'Test?',
        faName: 'تست؟',
        answers: [],
      }),
    } as any;

    tokenService = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        sub: 1,
        email: 'admin@test.com',
        role: 'ADMIN',
      }),
    } as any;

    controller = new QuestionsController(
      getQuestionsUseCase,
      createQuestionUseCase,
      tokenService,
    );
  });

  describe('GET /questions', () => {
    it('should return questions with id, type, and language filters', async () => {
      const result = await controller.getQuestions(
        '1',
        'PERSONALITY',
        'en',
      );

      expect(getQuestionsUseCase.execute).toHaveBeenCalledWith('PERSONALITY', 'en', 1);
      expect(result.questions).toHaveLength(1);
    });

    it('should call execute without filters when not provided', async () => {
      await controller.getQuestions();

      expect(getQuestionsUseCase.execute).toHaveBeenCalledWith(undefined, undefined, undefined);
    });

    it('should throw BadRequestException when id query is not a valid number', async () => {
      await expect(
        controller.getQuestions('invalid-id'),
      ).rejects.toThrow('Query parameter "id" must be a valid number');
    });
  });

  describe('GET /questions/:id', () => {
    it('should return question by id', async () => {
      const result = await controller.getQuestionById(1, 'fa');

      expect(getQuestionsUseCase.execute).toHaveBeenCalledWith(undefined, 'fa', 1);
      expect(result.questions).toHaveLength(1);
    });
  });

  describe('GET /questions/search', () => {
    it('should search questions by type and language', async () => {
      const result = await controller.searchQuestionsByType(
        'PREFERENCES',
        'fa',
      );

      expect(getQuestionsUseCase.execute).toHaveBeenCalledWith('PREFERENCES', 'fa');
      expect(result.questions).toHaveLength(1);
    });
  });

  describe('GET /questions/type/:type', () => {
    it('should get questions by type param', async () => {
      const result = await controller.getQuestionsByType(
        'PREFERENCES',
        'en',
      );

      expect(getQuestionsUseCase.execute).toHaveBeenCalledWith('PREFERENCES', 'en');
      expect(result.questions).toHaveLength(1);
    });
  });

  describe('POST /questions', () => {
    it('should create a question when user is admin', async () => {
      const dto = {
        type: 'PERSONALITY',
        enName: 'Test?',
        faName: 'تست؟',
        answers: [{ answerEn: 'Yes', answerFa: 'بله' }],
      };

      const result = await controller.createQuestion('Bearer valid-token', dto);

      expect(createQuestionUseCase.execute).toHaveBeenCalledWith(dto);
      expect(result.id).toBe(1);
    });

    it('should throw UnauthorizedException when user is not admin', async () => {
      tokenService.verifyAccessToken.mockResolvedValue({
        sub: 2,
        email: 'user@test.com',
        role: 'USER',
      });

      await expect(
        controller.createQuestion('Bearer valid-token', {
          type: 'PERSONALITY',
          enName: 'Test?',
          faName: 'تست؟',
          answers: [{ answerEn: 'Yes', answerFa: 'بله' }],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no auth header', async () => {
      await expect(
        controller.createQuestion('', {
          type: 'PERSONALITY',
          enName: 'Test?',
          faName: 'تست؟',
          answers: [{ answerEn: 'Yes', answerFa: 'بله' }],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
