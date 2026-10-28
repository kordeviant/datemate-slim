import { UnauthorizedException } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { GetQuestionsUseCase } from '../application/use-cases/get-questions.use-case';
import { CreateQuestionUseCase } from '../application/use-cases/create-question.use-case';
import { UpdateQuestionUseCase } from '../application/use-cases/update-question.use-case';
import { DeleteQuestionUseCase } from '../application/use-cases/delete-question.use-case';
import { TokenService } from '../../auth/application/services/token.service';
import { UploadMediaUseCase } from '../../media/application/use-cases/upload-media.use-case';

describe('QuestionsController', () => {
  let controller: QuestionsController;
  let getQuestionsUseCase: jest.Mocked<GetQuestionsUseCase>;
  let createQuestionUseCase: jest.Mocked<CreateQuestionUseCase>;
  let updateQuestionUseCase: jest.Mocked<UpdateQuestionUseCase>;
  let deleteQuestionUseCase: jest.Mocked<DeleteQuestionUseCase>;
  let uploadMediaUseCase: jest.Mocked<UploadMediaUseCase>;
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

    updateQuestionUseCase = {
      execute: jest.fn().mockResolvedValue({
        id: 1,
        type: 'PERSONALITY',
        enName: 'Updated?',
        faName: 'تست آپدیت؟',
        answers: [],
      }),
    } as any;

    deleteQuestionUseCase = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        message: 'Question #1 deleted successfully',
      }),
    } as any;

    uploadMediaUseCase = {
      execute: jest.fn().mockResolvedValue({
        filename: 'icons_test_123.png',
        assetType: 'icons',
        publicUrl: 'http://localhost:3000/assets/icons/icons_test_123.png',
        relativePath: 'icons/icons_test_123.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        createdAt: '2026-10-27T00:00:00Z',
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
      updateQuestionUseCase,
      deleteQuestionUseCase,
      uploadMediaUseCase,
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

    it('should upload icon and set dto.icon when iconFile is provided in createQuestion', async () => {
      const dto: any = {
        type: 'PERSONALITY',
        enName: 'Test?',
        faName: 'تست؟',
        answers: [{ answerEn: 'Yes', answerFa: 'بله' }],
      };
      const mockFile = { originalname: 'icon.png' } as any;

      await controller.createQuestion('Bearer valid-token', dto, mockFile);

      expect(uploadMediaUseCase.execute).toHaveBeenCalledWith('icons', mockFile);
      expect(dto.icon).toBe('icons/icons_test_123.png');
      expect(createQuestionUseCase.execute).toHaveBeenCalledWith(dto);
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

  describe('PUT /questions/:id', () => {
    it('should update question when user is admin', async () => {
      const dto = { enName: 'Updated English' };

      const result = await controller.updateQuestion('Bearer valid-token', 1, dto);

      expect(updateQuestionUseCase.execute).toHaveBeenCalledWith(1, dto);
      expect(result.id).toBe(1);
    });

    it('should upload new icon file and set dto.icon when iconFile is provided in updateQuestion', async () => {
      const dto: any = { enName: 'Updated English' };
      const mockFile = { originalname: 'new-icon.png' } as any;

      await controller.updateQuestion('Bearer valid-token', 1, dto, mockFile);

      expect(uploadMediaUseCase.execute).toHaveBeenCalledWith('icons', mockFile);
      expect(dto.icon).toBe('icons/icons_test_123.png');
      expect(updateQuestionUseCase.execute).toHaveBeenCalledWith(1, dto);
    });

    it('should throw UnauthorizedException when user is not admin', async () => {
      tokenService.verifyAccessToken.mockResolvedValue({
        sub: 2,
        email: 'user@test.com',
        role: 'USER',
      });

      await expect(
        controller.updateQuestion('Bearer valid-token', 1, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no auth header is provided', async () => {
      await expect(
        controller.updateQuestion('', 1, {}),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('DELETE /questions/:id', () => {
    it('should delete question when user is admin', async () => {
      const result = await controller.deleteQuestion('Bearer valid-token', 1);

      expect(deleteQuestionUseCase.execute).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it('should throw UnauthorizedException when user is not admin', async () => {
      tokenService.verifyAccessToken.mockResolvedValue({
        sub: 2,
        email: 'user@test.com',
        role: 'USER',
      });

      await expect(
        controller.deleteQuestion('Bearer valid-token', 1),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no auth header is provided', async () => {
      await expect(
        controller.deleteQuestion('', 1),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
