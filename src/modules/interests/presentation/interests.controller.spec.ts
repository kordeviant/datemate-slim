import { UnauthorizedException } from '@nestjs/common';
import { InterestsController } from './interests.controller';
import { GetInterestsUseCase } from '../application/use-cases/get-interests.use-case';
import { CreateInterestUseCase } from '../application/use-cases/create-interest.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('InterestsController', () => {
  let controller: InterestsController;
  let getInterestsUseCase: jest.Mocked<GetInterestsUseCase>;
  let createInterestUseCase: jest.Mocked<CreateInterestUseCase>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    const mockCategory = {
      id: 1,
      en: 'Food',
      fa: 'غذا',
      name: 'Food',
      enName: 'Food',
      faName: 'غذا',
      icon: null,
      Interest: [{ id: 1, en: 'Gaming', fa: 'بازی' }],
      interests: [{ id: 1, name: 'Gaming', enName: 'Gaming', faName: 'بازی' }],
    };
    const mockList: any = [mockCategory];
    mockList.total = 1;
    mockList.categories = [mockCategory];
    mockList.language = 'en';

    getInterestsUseCase = {
      execute: jest.fn().mockResolvedValue(mockList),
    } as any;

    createInterestUseCase = {
      execute: jest.fn().mockResolvedValue(mockCategory),
    } as any;


    tokenService = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        sub: 1,
        email: 'admin@test.com',
        role: 'ADMIN',
      }),
    } as any;

    controller = new InterestsController(
      getInterestsUseCase,
      createInterestUseCase,
      tokenService,
    );
  });

  describe('GET /interests', () => {
    it('should return interests with language filter', async () => {
      const result = await controller.getInterests(
        undefined,
        'en',
      );

      expect(getInterestsUseCase.execute).toHaveBeenCalledWith('en', undefined);
      expect(result.categories).toHaveLength(1);
    });

    it('should return interests by id query', async () => {
      await controller.getInterests('1', 'en');

      expect(getInterestsUseCase.execute).toHaveBeenCalledWith('en', 1);
    });

    it('should call execute without filters when not provided', async () => {
      await controller.getInterests();

      expect(getInterestsUseCase.execute).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should throw BadRequestException when id query is not a valid number', async () => {
      await expect(
        controller.getInterests('invalid-id'),
      ).rejects.toThrow('Query parameter "id" must be a valid number');
    });
  });

  describe('GET /interests/:id', () => {
    it('should return interest category by id', async () => {
      const result = await controller.getInterestById(1, 'fa');

      expect(getInterestsUseCase.execute).toHaveBeenCalledWith('fa', 1);
      expect(result.categories).toHaveLength(1);
    });
  });

  describe('POST /interests', () => {
    it('should create an interest category when user is admin', async () => {
      const dto = {
        enName: 'Food',
        faName: 'غذا',
        interests: [{ enName: 'Pizza', faName: 'پیتزا' }],
      };

      const result = await controller.createInterest('Bearer valid-token', dto);

      expect(createInterestUseCase.execute).toHaveBeenCalledWith(dto);
      expect(result.id).toBe(1);
    });

    it('should throw UnauthorizedException when user is not admin', async () => {
      tokenService.verifyAccessToken.mockResolvedValue({
        sub: 2,
        email: 'user@test.com',
        role: 'USER',
      });

      await expect(
        controller.createInterest('Bearer valid-token', {
          enName: 'Food',
          faName: 'غذا',
          interests: [{ enName: 'Pizza', faName: 'پیتزا' }],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no auth header', async () => {
      await expect(
        controller.createInterest('', {
          enName: 'Food',
          faName: 'غذا',
          interests: [{ enName: 'Pizza', faName: 'پیتزا' }],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
