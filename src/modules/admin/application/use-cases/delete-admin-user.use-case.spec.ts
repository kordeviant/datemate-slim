import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DeleteAdminUserUseCase } from './delete-admin-user.use-case';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

describe('DeleteAdminUserUseCase', () => {
  let useCase: DeleteAdminUserUseCase;
  let mockAdminRepository: Partial<IAdminRepository>;

  beforeEach(async () => {
    mockAdminRepository = {
      deleteUser: jest.fn().mockResolvedValue({ userId: 101, deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteAdminUserUseCase,
        {
          provide: ADMIN_REPOSITORY,
          useValue: mockAdminRepository,
        },
      ],
    }).compile();

    useCase = module.get<DeleteAdminUserUseCase>(DeleteAdminUserUseCase);
  });

  it('should delete a single user by ID', async () => {
    const result = await useCase.execute(101);

    expect(mockAdminRepository.deleteUser).toHaveBeenCalledWith(101);
    expect(result).toEqual({ userId: 101, deleted: true });
  });

  it('should throw BadRequestException if invalid user ID is passed', async () => {
    await expect(useCase.execute(NaN)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(0)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(-5)).rejects.toThrow(BadRequestException);
  });
});
