import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { TokenService } from '../application/services/token.service';
import { CreateProfileUseCase } from '../application/use-cases/create-profile.use-case';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.interface';

describe('UsersController', () => {
  let controller: UsersController;
  let mockTokenService: any;
  let mockUserRepo: any;
  let mockCreateProfileUseCase: any;

  beforeEach(async () => {
    mockTokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: 1 }),
    };

    mockUserRepo = {
      hasCompletedProfile: jest.fn().mockResolvedValue(true),
    };

    mockCreateProfileUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: TokenService, useValue: mockTokenService },
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: CreateProfileUseCase, useValue: mockCreateProfileUseCase },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('GET /users/profile', () => {
    it('should throw UnauthorizedException if header is missing', async () => {
      await expect(controller.checkUserProfile('')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return completion status', async () => {
      const res = await controller.checkUserProfile('Bearer valid_token');
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid_token');
      expect(mockUserRepo.hasCompletedProfile).toHaveBeenCalledWith(1);
      expect(res).toBe(true);
    });
  });

  describe('POST /users/profile', () => {
    it('should throw UnauthorizedException if header is missing', async () => {
      await expect(
        controller.createProfile('', {} as any, undefined),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should delegate to createProfileUseCase', async () => {
      const dto = {
        firstName: 'John',
        username: 'john_doe',
        birthDate: '1998-11-25',
        gender: 'Male',
      };
      const mockFile: any = { buffer: Buffer.from('img') };
      const expectedResponse: any = {
        userId: 1,
        firstName: 'John',
        username: 'john_doe',
        age: 27,
        gender: 'MALE',
        profileCompleted: true,
      };

      mockCreateProfileUseCase.execute.mockResolvedValue(expectedResponse);

      const res = await controller.createProfile(
        'Bearer token123',
        dto as any,
        mockFile,
      );

      expect(mockCreateProfileUseCase.execute).toHaveBeenCalledWith(
        1,
        dto,
        mockFile,
      );
      expect(res).toEqual(expectedResponse);
    });
  });
});
