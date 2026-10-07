import { Test, TestingModule } from '@nestjs/testing';
import { GetUsersCountUseCase } from './get-users-count.use-case';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

describe('GetUsersCountUseCase', () => {
  let useCase: GetUsersCountUseCase;
  let mockAdminRepository: Partial<IAdminRepository>;

  beforeEach(async () => {
    mockAdminRepository = {
      getUsersCount: jest.fn().mockResolvedValue(6570),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUsersCountUseCase,
        {
          provide: ADMIN_REPOSITORY,
          useValue: mockAdminRepository,
        },
      ],
    }).compile();

    useCase = module.get<GetUsersCountUseCase>(GetUsersCountUseCase);
  });

  it('should return total users count', async () => {
    const result = await useCase.execute();

    expect(mockAdminRepository.getUsersCount).toHaveBeenCalledWith(undefined);
    expect(result).toEqual({ count: 6570 });
  });

  it('should pass status filter if provided', async () => {
    const result = await useCase.execute('ONLINE');

    expect(mockAdminRepository.getUsersCount).toHaveBeenCalledWith('ONLINE');
    expect(result).toEqual({ count: 6570 });
  });
});
