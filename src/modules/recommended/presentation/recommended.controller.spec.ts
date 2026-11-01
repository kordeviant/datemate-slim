import { UnauthorizedException } from '@nestjs/common';
import { RecommendedController } from './recommended.controller';
import { GetRecommendedUseCase } from '../application/use-cases/get-recommended.use-case';
import { GetRecommendedDetailUseCase } from '../application/use-cases/get-recommended-detail.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('RecommendedController', () => {
  let controller: RecommendedController;
  let mockGetRecommendedUseCase: jest.Mocked<GetRecommendedUseCase>;
  let mockGetRecommendedDetailUseCase: jest.Mocked<GetRecommendedDetailUseCase>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockGetRecommendedUseCase = {
      execute: jest.fn(),
    } as any;

    mockGetRecommendedDetailUseCase = {
      execute: jest.fn(),
    } as any;

    mockTokenService = {
      verifyAccessToken: jest.fn(),
    } as any;

    controller = new RecommendedController(
      mockGetRecommendedUseCase,
      mockGetRecommendedDetailUseCase,
      mockTokenService,
    );
  });

  describe('GET /recommended', () => {
    it('fetches recommended candidates for authenticated user with req.user', async () => {
      mockGetRecommendedUseCase.execute.mockResolvedValue([
        {
          id: 102,
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
        id: 102,
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
      const result = await controller.getRecommended(
        { limit: 20 },
        req,
        authHeader,
      );

      expect(result.status).toBe('success');
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
        'valid-jwt-token',
      );
      expect(mockGetRecommendedUseCase.execute).toHaveBeenCalledWith(42, {
        limit: 20,
      });
    });

    it('throws UnauthorizedException when both req.user and Authorization header are missing', async () => {
      const req = {};
      await expect(
        controller.getRecommended({ limit: 20 }, req),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /recommended/detail', () => {
    it('fetches detailed recommended profiles for authenticated user with start and limit', async () => {
      const mockDetailedProfiles = [
        {
          id: 102,
          email: 'sara@example.com',
          language: 'EN',
          lat: 35.68,
          lon: 51.38,
          profileValidated: true,
          isPremium: false,
          Profile: {
            fullName: 'Sara Connor',
            username: 'sara_c',
            phoneNumber: '+1234567890',
            bio: 'Bio',
            languages: ['en'],
            avatar: 'http://cdn/avatar.webp',
            profilePicture: 'http://cdn/pic.webp',
            profilePictureId: 10,
            profileCompleted: true,
            isPremium: false,
            Demographic: {
              birthDate: '1998-01-01',
              gender: 'FEMALE',
              height: 168,
              degree: 'BACHELOR',
              profession: 'Designer',
              relationStatus: 'SINGLE',
              City: { id: 1, name: 'Tehran', state: 'Tehran', country: 'Iran' },
            },
            RelationType: 'LONG',
            Answers: { '1': 0 },
            LikedActivities: { '1': 1 },
          },
          gallery: [],
        },
      ];

      mockGetRecommendedDetailUseCase.execute.mockResolvedValue(
        mockDetailedProfiles as any,
      );

      const req = { user: { sub: 50 } };
      const result = await controller.getRecommendedDetail(
        { start: 3, limit: 20 },
        req,
      );

      expect(result).toEqual({
        status: 'success',
        message: 'Recommended detailed profiles retrieved successfully',
        data: mockDetailedProfiles,
      });
      expect(mockGetRecommendedDetailUseCase.execute).toHaveBeenCalledWith(50, {
        start: 3,
        limit: 20,
      });
    });

    it('throws UnauthorizedException when auth header and req.user are missing', async () => {
      const req = {};
      await expect(
        controller.getRecommendedDetail({ limit: 20 }, req),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
