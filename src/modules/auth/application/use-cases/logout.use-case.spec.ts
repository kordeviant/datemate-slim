import { BadRequestException } from '@nestjs/common';
import { LogoutUseCase } from './logout.use-case';
import { IUserSessionRepository } from '../../domain/repositories/user-session.repository.interface';
import { TokenService } from '../services/token.service';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let mockSessionRepository: jest.Mocked<IUserSessionRepository>;
  let mockTokenService: Partial<TokenService>;

  beforeEach(() => {
    mockSessionRepository = {
      createSession: jest.fn(),
      findByTokenHash: jest.fn(),
      deleteByTokenHash: jest.fn(),
      deleteAllForUser: jest.fn(),
      deleteSessionById: jest.fn(),
      findSessionsByUserId: jest.fn(),
    } as any;

    mockTokenService = {
      hashRefreshToken: jest.fn((token: string) => `hashed_${token}`),
    };

    useCase = new LogoutUseCase(
      mockSessionRepository,
      mockTokenService as TokenService,
    );
  });

  it('should logout single session by refreshToken from body', async () => {
    const rawToken = 'sample_refresh_token_123';
    const result = await useCase.execute({ refreshToken: rawToken });

    expect(mockTokenService.hashRefreshToken).toHaveBeenCalledWith(rawToken);
    expect(mockSessionRepository.deleteByTokenHash).toHaveBeenCalledWith(
      'hashed_sample_refresh_token_123',
    );
    expect(result).toEqual({ loggedOut: true });
  });

  it('should throw BadRequestException when refreshToken is missing or empty', async () => {
    await expect(useCase.execute({ refreshToken: '' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(useCase.execute({} as any)).rejects.toThrow(
      BadRequestException,
    );
    await expect(useCase.execute(undefined as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});
