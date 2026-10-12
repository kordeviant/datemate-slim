import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { SwipesController } from './presentation/swipes.controller';
import { FeedController } from './presentation/feed.controller';
import { LikesController } from './presentation/likes.controller';
import { MatchesController } from './presentation/matches.controller';
import { RecordSwipeUseCase } from './application/use-cases/record-swipe.use-case';
import { GetFeedUseCase } from './application/use-cases/get-feed.use-case';
import { GetLikesReceivedUseCase } from './application/use-cases/get-likes-received.use-case';
import { TokenService } from '../auth/application/services/token.service';

describe('Matching & Swipes Endpoints (Integration)', () => {
  let app: INestApplication;
  let mockTokenService: Partial<TokenService>;
  let mockRecordSwipeUseCase: Partial<RecordSwipeUseCase>;
  let mockGetFeedUseCase: Partial<GetFeedUseCase>;
  let mockGetLikesReceivedUseCase: Partial<GetLikesReceivedUseCase>;

  beforeAll(async () => {
    mockTokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: 1, role: 'USER' }),
    };

    mockRecordSwipeUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    mockGetFeedUseCase = {
      execute: jest.fn().mockResolvedValue({
        candidates: [
          {
            id: 205,
            fullName: 'Sara Connor',
            city: 'Tehran',
            age: 24,
            profilePicture: 'http://localhost:3000/assets/avatars/avatar_205.webp',
            username: 'sarah_c',
          },
        ],
        count: 1,
      }),
    };

    mockGetLikesReceivedUseCase = {
      execute: jest.fn().mockResolvedValue([
        {
          id: 205,
          fullName: 'Sara Connor',
          username: 'sarah_c',
          city: 'Tehran',
          isOnline: true,
          avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
        },
      ]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        SwipesController,
        FeedController,
        LikesController,
        MatchesController,
      ],
      providers: [
        { provide: TokenService, useValue: mockTokenService },
        { provide: RecordSwipeUseCase, useValue: mockRecordSwipeUseCase },
        { provide: GetFeedUseCase, useValue: mockGetFeedUseCase },
        {
          provide: GetLikesReceivedUseCase,
          useValue: mockGetLikesReceivedUseCase,
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

  describe('POST /v1/swipes', () => {
    it('returns 200 OK with minimal payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/swipes')
        .set('Authorization', 'Bearer valid_token')
        .send({ targetUserId: 205, direction: 'RIGHT' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toBe('Swipe recorded successfully');
      expect(mockRecordSwipeUseCase.execute).toHaveBeenCalledWith(1, {
        targetUserId: 205,
        direction: 'RIGHT',
      });
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/swipes')
        .send({ targetUserId: 205, direction: 'RIGHT' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /v1/feed', () => {
    it('returns 200 OK with candidate cards', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/feed?limit=20')
        .set('Authorization', 'Bearer valid_token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.candidates.length).toBe(1);
      expect(res.body.data.candidates[0]).toEqual({
        id: 205,
        fullName: 'Sara Connor',
        city: 'Tehran',
        age: 24,
        profilePicture: 'http://localhost:3000/assets/avatars/avatar_205.webp',
        username: 'sarah_c',
      });
      expect(mockGetFeedUseCase.execute).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ limit: 20 }),
      );
    });
  });

  describe('GET /v1/likes', () => {
    it('returns 200 OK with list of users who liked current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/likes')
        .set('Authorization', 'Bearer valid_token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toEqual({
        id: 205,
        fullName: 'Sara Connor',
        username: 'sarah_c',
        city: 'Tehran',
        isOnline: true,
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
      });
    });
  });

  describe('GET /v1/matches', () => {
    it('returns 200 OK with list of users who liked current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/matches')
        .set('Authorization', 'Bearer valid_token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toEqual({
        id: 205,
        fullName: 'Sara Connor',
        username: 'sarah_c',
        city: 'Tehran',
        isOnline: true,
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_205.webp',
      });
    });
  });
});
