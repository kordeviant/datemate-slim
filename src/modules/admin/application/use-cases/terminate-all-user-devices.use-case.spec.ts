import { TerminateAllUserDevicesUseCase } from './terminate-all-user-devices.use-case';
import { IAdminRepository } from '../../domain/repositories/admin.repository.interface';

describe('TerminateAllUserDevicesUseCase', () => {
  let useCase: TerminateAllUserDevicesUseCase;
  let mockAdminRepository: Partial<IAdminRepository>;

  beforeEach(() => {
    mockAdminRepository = {
      terminateAllUserDevices: jest.fn(),
    };

    useCase = new TerminateAllUserDevicesUseCase(
      mockAdminRepository as IAdminRepository,
    );
  });

  it('should call adminRepository.terminateAllUserDevices with userId and return result', async () => {
    const expected = {
      userId: 12,
      terminated: true,
      count: 3,
    };
    (
      mockAdminRepository.terminateAllUserDevices as jest.Mock
    ).mockResolvedValue(expected);

    const result = await useCase.execute(12);

    expect(mockAdminRepository.terminateAllUserDevices).toHaveBeenCalledWith(12);
    expect(result).toEqual(expected);
  });
});
