import { BadRequestException } from '@nestjs/common';
import { TerminateAllClientDevicesUseCase } from './terminate-all-client-devices.use-case';
import { IUserSessionRepository } from '../../domain/repositories/user-session.repository.interface';
import { TokenService } from '../services/token.service';

describe('TerminateAllClientDevicesUseCase', () => {
  let useCase: TerminateAllClientDevicesUseCase;
  let mockSessionRepository: Partial<IUserSessionRepository>;
  let mockTokenService: Partial<TokenService>;

  beforeEach(() => {
    mockSessionRepository = {
      deleteAllForUser: jest.fn(),
      deleteAllForUserExcept: jest.fn(),
    };
    mockTokenService = {
      hashRefreshToken: jest.fn((token: string) => `hashed_${token}`),
    };

    useCase = new TerminateAllClientDevicesUseCase(
      mockSessionRepository as IUserSessionRepository,
      mockTokenService as TokenService,
    );
  });

  describe('terminate all devices (excludeCurrent = false)', () => {
    it('should delete all sessions for user and return count', async () => {
      (mockSessionRepository.deleteAllForUser as jest.Mock).mockResolvedValue(3);

      const result = await useCase.execute(10, false);

      expect(mockSessionRepository.deleteAllForUser).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        terminatedCount: 3,
        excludedCurrent: false,
      });
    });

    it('should default excludeCurrent to false if not passed', async () => {
      (mockSessionRepository.deleteAllForUser as jest.Mock).mockResolvedValue(2);

      const result = await useCase.execute(10);

      expect(mockSessionRepository.deleteAllForUser).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        terminatedCount: 2,
        excludedCurrent: false,
      });
    });
  });

  describe('terminate all devices except current (excludeCurrent = true)', () => {
    it('should throw BadRequestException if currentRefreshToken is not provided', async () => {
      await expect(useCase.execute(10, true)).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute(10, true, '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete all sessions except current token hash and return count', async () => {
      (
        mockSessionRepository.deleteAllForUserExcept as jest.Mock
      ).mockResolvedValue(2);

      const result = await useCase.execute(10, true, 'valid_refresh_token');

      expect(mockTokenService.hashRefreshToken).toHaveBeenCalledWith(
        'valid_refresh_token',
      );
      expect(mockSessionRepository.deleteAllForUserExcept).toHaveBeenCalledWith(
        10,
        'hashed_valid_refresh_token',
      );
      expect(result).toEqual({
        terminatedCount: 2,
        excludedCurrent: true,
      });
    });
  });
});
