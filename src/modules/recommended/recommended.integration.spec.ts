import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { RecommendedController } from './presentation/recommended.controller';
import { GetRecommendedUseCase } from './application/use-cases/get-recommended.use-case';
import { TokenService } from '../auth/application/services/token.service';

describe('Recommended Endpoints (Integration)', () => {
  let app: INestApplication;
  let mockTokenService: Partial<TokenService>;
  let mockGetRecommendedUseCase: Partial<GetRecommendedUseCase>;

  beforeAll(async () => {
    mockTokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: 1, role: 'USER' }),
    };

    mockGetRecommendedUseCase = {
      execute: jest.fn().mockResolvedValue([
        {
          id: 205,
          firstName: 'Sara',
          fullName: 'Sara Connor',
          username: 'sarah_c',
          age: 24,
          gender: 'FEMALE',
          bio: 'Love hiking and art',
          avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
          profileValidated: true,
          gallery: ['http://localhost:3000/assets/images/g_205.webp'],
          interests: ['Hiking', 'Art'],
          city: 'Tehran',
          isOnline: true,
          lastSeenAt: new Date(),
          compatibilityScore: 95,
          sharedInterests: ['Hiking'],
          sharedAnswersCount: 4,
          sameCity: true,
          sameRelationGoal: true,
        },
      ]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RecommendedController],
      providers: [
        { provide: TokenService, useValue: mockTokenService },
        { provide: GetRecommendedUseCase, useValue: mockGetRecommendedUseCase },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/recommended', () => {
    it('returns 200 OK with recommended list for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/recommended?limit=20')
        .set('Authorization', 'Bearer valid_token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toBe('Recommended profiles retrieved successfully');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(205);
      expect(res.body.data[0].compatibilityScore).toBe(95);
      expect(res.body.data[0].sameCity).toBe(true);
      expect(mockGetRecommendedUseCase.execute).toHaveBeenCalledWith(1, {
        limit: 20,
      });
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer()).get('/v1/recommended');
      expect(res.status).toBe(401);
    });

    it('validates limit query param min and max', async () => {
      const resInvalid = await request(app.getHttpServer())
        .get('/v1/recommended?limit=100')
        .set('Authorization', 'Bearer valid_token');

      expect(resInvalid.status).toBe(400);
    });
  });
});
