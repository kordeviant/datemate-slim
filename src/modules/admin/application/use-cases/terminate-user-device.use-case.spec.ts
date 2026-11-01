import { TerminateUserDeviceUseCase } from './terminate-user-device.use-case';
import { IAdminRepository } from '../../domain/repositories/admin.repository.interface';

describe('TerminateUserDeviceUseCase', () => {
  let useCase: TerminateUserDeviceUseCase;
  let mockAdminRepository: Partial<IAdminRepository>;

  beforeEach(() => {
    mockAdminRepository = {
      terminateUserDevice: jest.fn(),
    };

    useCase = new TerminateUserDeviceUseCase(
      mockAdminRepository as IAdminRepository,
    );
  });

  it('should call adminRepository.terminateUserDevice with userId and deviceId', async () => {
    const expected = {
      userId: 12,
      deviceId: 10,
      terminated: true,
    };
    (mockAdminRepository.terminateUserDevice as jest.Mock).mockResolvedValue(
      expected,
    );

    const result = await useCase.execute(12, 10);

    expect(mockAdminRepository.terminateUserDevice).toHaveBeenCalledWith(
      12,
      10,
    );
    expect(result).toEqual(expected);
  });
});
