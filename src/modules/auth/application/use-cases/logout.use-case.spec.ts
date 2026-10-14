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
    } as any;

    mockTokenService = {
      hashRefreshToken: jest.fn((token: string) => `hashed_${token}`),
    };

    useCase = new LogoutUseCase(
      mockSessionRepository,
      mockTokenService as TokenService,
    );
  });

  it('should logout single session by refreshToken', async () => {
    const rawToken = 'sample_refresh_token_123';
    mockSessionRepository.findByTokenHash.mockResolvedValue({
      id: 5,
      userId: 10,
      refreshTokenHash: 'hashed_sample_refresh_token_123',
      expiresAt: new Date(),
      createdAt: new Date(),
    });

    const result = await useCase.execute({ refreshToken: rawToken });

    expect(mockTokenService.hashRefreshToken).toHaveBeenCalledWith(rawToken);
    expect(mockSessionRepository.deleteByTokenHash).toHaveBeenCalledWith(
      'hashed_sample_refresh_token_123',
    );
    expect(mockSessionRepository.deleteAllForUser).not.toHaveBeenCalled();
    expect(result).toEqual({ loggedOut: true });
  });

  it('should logout all devices when allDevices is true with refreshToken', async () => {
    const rawToken = 'sample_refresh_token_123';
    mockSessionRepository.findByTokenHash.mockResolvedValue({
      id: 5,
      userId: 10,
      refreshTokenHash: 'hashed_sample_refresh_token_123',
      expiresAt: new Date(),
      createdAt: new Date(),
    });

    const result = await useCase.execute({
      refreshToken: rawToken,
      allDevices: true,
    });

    expect(mockSessionRepository.deleteAllForUser).toHaveBeenCalledWith(10);
    expect(result).toEqual({ loggedOut: true });
  });

  it('should logout by authenticatedUserId when refreshToken is omitted', async () => {
    const result = await useCase.execute(undefined, 25);

    expect(mockSessionRepository.deleteAllForUser).toHaveBeenCalledWith(25);
    expect(result).toEqual({ loggedOut: true });
  });

  it('should throw BadRequestException when neither refreshToken nor authenticatedUserId is provided', async () => {
    await expect(useCase.execute({})).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(undefined, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });
});
