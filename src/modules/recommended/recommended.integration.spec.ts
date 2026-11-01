import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { RecommendedController } from './presentation/recommended.controller';
import { GetRecommendedUseCase } from './application/use-cases/get-recommended.use-case';
import { GetRecommendedDetailUseCase } from './application/use-cases/get-recommended-detail.use-case';
import { TokenService } from '../auth/application/services/token.service';

describe('Recommended Endpoints (Integration)', () => {
  let app: INestApplication;
  let mockTokenService: Partial<TokenService>;
  let mockGetRecommendedUseCase: Partial<GetRecommendedUseCase>;
  let mockGetRecommendedDetailUseCase: Partial<GetRecommendedDetailUseCase>;

  beforeAll(async () => {
    mockTokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: 1, role: 'USER' }),
    };

    mockGetRecommendedUseCase = {
      execute: jest.fn().mockResolvedValue([
        {
          id: 205,
          avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
          age: 24,
          city: 'Tehran',
          username: 'sarah_c',
          fullName: 'Sara Connor',
        },
      ]),
    };

    mockGetRecommendedDetailUseCase = {
      execute: jest.fn().mockResolvedValue([
        {
          id: 205,
          email: 'sara@example.com',
          language: 'EN',
          lat: 35.68,
          lon: 51.38,
          profileValidated: true,
          isPremium: false,
          Profile: {
            fullName: 'Sara Connor',
            username: 'sarah_c',
            phoneNumber: '+1234567890',
            bio: 'Bio',
            languages: ['en'],
            avatar: 'http://localhost:3000/assets/avatars/avatar_205.webp',
            profilePicture: 'http://localhost:3000/assets/avatars/avatar_205.webp',
            profilePictureId: 5,
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
      ]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RecommendedController],
      providers: [
        { provide: TokenService, useValue: mockTokenService },
        { provide: GetRecommendedUseCase, useValue: mockGetRecommendedUseCase },
        {
          provide: GetRecommendedDetailUseCase,
          useValue: mockGetRecommendedDetailUseCase,
        },
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
    it('returns 200 OK with recommended list for authenticated user with strictly 5 fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/recommended?limit=20')
        .set('Authorization', 'Bearer valid_token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toBe('Recommended profiles retrieved successfully');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toEqual({
        id: 205,
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
        age: 24,
        city: 'Tehran',
        username: 'sarah_c',
        fullName: 'Sara Connor',
      });
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

  describe('GET /v1/recommended/detail', () => {
    it('returns 200 OK with detailed recommended profiles matching /me schema', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/recommended/detail?start=0&limit=20')
        .set('Authorization', 'Bearer valid_token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toBe(
        'Recommended detailed profiles retrieved successfully',
      );
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(205);
      expect(res.body.data[0].Profile.fullName).toBe('Sara Connor');
      expect(res.body.data[0].Profile.Demographic.City.name).toBe('Tehran');
      expect(mockGetRecommendedDetailUseCase.execute).toHaveBeenCalledWith(1, {
        start: 0,
        limit: 20,
      });
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer()).get(
        '/v1/recommended/detail',
      );
      expect(res.status).toBe(401);
    });

    it('rejects invalid query parameters (e.g. limit > 50)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/recommended/detail?limit=99')
        .set('Authorization', 'Bearer valid_token');

      expect(res.status).toBe(400);
    });

    it('supports anchor-based window pagination with anchorUserId, before, and after', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/recommended/detail?anchorUserId=123&before=10&after=10')
        .set('Authorization', 'Bearer valid_token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toBe(
        'Recommended detailed profiles retrieved successfully',
      );
      expect(mockGetRecommendedDetailUseCase.execute).toHaveBeenCalledWith(1, {
        anchorUserId: 123,
        before: 10,
        after: 10,
        limit: 20,
      });
    });

    it('rejects invalid anchor query parameters (e.g. before < 0 or after > 50)', async () => {
      const resInvalidBefore = await request(app.getHttpServer())
        .get('/v1/recommended/detail?anchorUserId=123&before=-1')
        .set('Authorization', 'Bearer valid_token');
      expect(resInvalidBefore.status).toBe(400);

      const resInvalidAfter = await request(app.getHttpServer())
        .get('/v1/recommended/detail?anchorUserId=123&after=99')
        .set('Authorization', 'Bearer valid_token');
      expect(resInvalidAfter.status).toBe(400);
    });
  });
});
