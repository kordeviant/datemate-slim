import { Test, TestingModule } from '@nestjs/testing';
import { GetPendingSelfiesCountUseCase } from './get-pending-selfies-count.use-case';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

describe('GetPendingSelfiesCountUseCase', () => {
  let useCase: GetPendingSelfiesCountUseCase;
  let mockAdminRepository: Partial<IAdminRepository>;

  beforeEach(async () => {
    mockAdminRepository = {
      getPendingSelfiesCount: jest.fn().mockResolvedValue(15),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPendingSelfiesCountUseCase,
        {
          provide: ADMIN_REPOSITORY,
          useValue: mockAdminRepository,
        },
      ],
    }).compile();

    useCase = module.get<GetPendingSelfiesCountUseCase>(
      GetPendingSelfiesCountUseCase,
    );
  });

  it('should return pending unvalidated selfies count', async () => {
    const result = await useCase.execute();

    expect(mockAdminRepository.getPendingSelfiesCount).toHaveBeenCalled();
    expect(result).toEqual({ count: 15 });
  });
});
