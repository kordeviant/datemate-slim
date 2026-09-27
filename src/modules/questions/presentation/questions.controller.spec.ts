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
        nameEn: 'Test?',
        nameFa: 'تست؟',
        answers: [],
      }),
    } as any;

    tokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({
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
        'Bearer valid-token',
        '1',
        'PERSONALITY',
        'en',
      );

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(getQuestionsUseCase.execute).toHaveBeenCalledWith('PERSONALITY', 'en', 1);
      expect(result.questions).toHaveLength(1);
    });

    it('should call execute without filters when not provided', async () => {
      await controller.getQuestions('Bearer valid-token');

      expect(getQuestionsUseCase.execute).toHaveBeenCalledWith(undefined, undefined, undefined);
    });

    it('should throw BadRequestException when id query is not a valid number', async () => {
      await expect(
        controller.getQuestions('Bearer valid-token', 'invalid-id'),
      ).rejects.toThrow('Query parameter "id" must be a valid number');
    });

    it('should throw UnauthorizedException when no auth header', async () => {
      await expect(
        controller.getQuestions(''),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /questions/:id', () => {
    it('should return question by id', async () => {
      const result = await controller.getQuestionById('Bearer valid-token', 1, 'fa');

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(getQuestionsUseCase.execute).toHaveBeenCalledWith(undefined, 'fa', 1);
      expect(result.questions).toHaveLength(1);
    });

    it('should throw UnauthorizedException when no auth header', async () => {
      await expect(
        controller.getQuestionById('', 1),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /questions', () => {
    it('should create a question when user is admin', async () => {
      const dto = {
        type: 'PERSONALITY',
        nameEn: 'Test?',
        nameFa: 'تست؟',
        answers: [{ answerEn: 'Yes', answerFa: 'بله' }],
      };

      const result = await controller.createQuestion('Bearer valid-token', dto);

      expect(createQuestionUseCase.execute).toHaveBeenCalledWith(dto);
      expect(result.id).toBe(1);
    });

    it('should throw UnauthorizedException when user is not admin', async () => {
      tokenService.verifyAccessToken.mockReturnValue({
        sub: 2,
        email: 'user@test.com',
        role: 'USER',
      });

      await expect(
        controller.createQuestion('Bearer valid-token', {
          type: 'PERSONALITY',
          nameEn: 'Test?',
          nameFa: 'تست؟',
          answers: [{ answerEn: 'Yes', answerFa: 'بله' }],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no auth header', async () => {
      await expect(
        controller.createQuestion('', {
          type: 'PERSONALITY',
          nameEn: 'Test?',
          nameFa: 'تست؟',
          answers: [{ answerEn: 'Yes', answerFa: 'بله' }],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
