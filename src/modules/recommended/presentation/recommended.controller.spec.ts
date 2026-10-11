import { UnauthorizedException } from '@nestjs/common';
import { RecommendedController } from './recommended.controller';
import { GetRecommendedUseCase } from '../application/use-cases/get-recommended.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('RecommendedController', () => {
  let controller: RecommendedController;
  let mockGetRecommendedUseCase: jest.Mocked<GetRecommendedUseCase>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockGetRecommendedUseCase = {
      execute: jest.fn(),
    } as any;

    mockTokenService = {
      verifyAccessToken: jest.fn(),
    } as any;

    controller = new RecommendedController(
      mockGetRecommendedUseCase,
      mockTokenService,
    );
  });

  it('fetches recommended candidates for authenticated user with req.user', async () => {
    mockGetRecommendedUseCase.execute.mockResolvedValue([
      {
        avatarUrl: 'http://cdn/avatar.webp',
        age: 25,
        city: 'Tehran',
        username: 'sara_c',
        fullName: 'Sara Connor',
      },
    ]);

    const req = { user: { sub: 50 } };
    const result = await controller.getRecommended({ limit: 20 }, req);

    expect(result).toEqual({
      status: 'success',
      message: 'Recommended profiles retrieved successfully',
      data: expect.any(Array),
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      avatarUrl: 'http://cdn/avatar.webp',
      age: 25,
      city: 'Tehran',
      username: 'sara_c',
      fullName: 'Sara Connor',
    });
    expect(mockGetRecommendedUseCase.execute).toHaveBeenCalledWith(50, {
      limit: 20,
    });
  });

  it('extracts user ID from Authorization header when req.user is absent', async () => {
    mockTokenService.verifyAccessToken.mockReturnValue({
      sub: '42',
      email: 'test@example.com',
      role: 'USER',
    } as any);
    mockGetRecommendedUseCase.execute.mockResolvedValue([]);

    const req = {};
    const authHeader = 'Bearer valid-jwt-token';
    const result = await controller.getRecommended({ limit: 20 }, req, authHeader);

    expect(result.status).toBe('success');
    expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid-jwt-token');
    expect(mockGetRecommendedUseCase.execute).toHaveBeenCalledWith(42, {
      limit: 20,
    });
  });

  it('throws UnauthorizedException when both req.user and Authorization header are missing', async () => {
    const req = {};
    await expect(controller.getRecommended({ limit: 20 }, req)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
