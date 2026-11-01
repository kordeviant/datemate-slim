import { NotFoundException } from '@nestjs/common';
import { TerminateClientDeviceUseCase } from './terminate-client-device.use-case';
import { IUserSessionRepository } from '../../domain/repositories/user-session.repository.interface';

describe('TerminateClientDeviceUseCase', () => {
  let useCase: TerminateClientDeviceUseCase;
  let mockSessionRepository: Partial<IUserSessionRepository>;

  beforeEach(() => {
    mockSessionRepository = {
      deleteSessionById: jest.fn(),
    };

    useCase = new TerminateClientDeviceUseCase(
      mockSessionRepository as IUserSessionRepository,
    );
  });

  it('should delete session and return result when session belongs to user', async () => {
    (mockSessionRepository.deleteSessionById as jest.Mock).mockResolvedValue(true);

    const result = await useCase.execute(10, 5);

    expect(mockSessionRepository.deleteSessionById).toHaveBeenCalledWith(5, 10);
    expect(result).toEqual({
      deviceId: 5,
      terminated: true,
    });
  });

  it('should throw NotFoundException when session is not found or does not belong to user', async () => {
    (mockSessionRepository.deleteSessionById as jest.Mock).mockResolvedValue(false);

    await expect(useCase.execute(10, 999)).rejects.toThrow(NotFoundException);
    expect(mockSessionRepository.deleteSessionById).toHaveBeenCalledWith(999, 10);
  });
});
