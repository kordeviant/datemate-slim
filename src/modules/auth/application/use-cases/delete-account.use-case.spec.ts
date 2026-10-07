import { Test, TestingModule } from '@nestjs/testing';
import { DeleteAccountUseCase } from './delete-account.use-case';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';

describe('DeleteAccountUseCase', () => {
  let useCase: DeleteAccountUseCase;
  let mockUserRepository: Partial<IUserRepository>;

  beforeEach(async () => {
    mockUserRepository = {
      deleteUser: jest.fn().mockResolvedValue({ userId: 42, deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteAccountUseCase,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    useCase = module.get<DeleteAccountUseCase>(DeleteAccountUseCase);
  });

  it('should call userRepository.deleteUser with userId and return result', async () => {
    const result = await useCase.execute(42);

    expect(mockUserRepository.deleteUser).toHaveBeenCalledWith(42);
    expect(result).toEqual({ userId: 42, deleted: true });
  });
});
