import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { FriendsController } from './presentation/friends.controller';
import { AddFriendUseCase } from './application/use-cases/add-friend.use-case';
import { GetFriendRequestsUseCase } from './application/use-cases/get-friend-requests.use-case';
import { AcceptFriendRequestUseCase } from './application/use-cases/accept-friend-request.use-case';
import { RejectFriendRequestUseCase } from './application/use-cases/reject-friend-request.use-case';
import { CancelFriendRequestUseCase } from './application/use-cases/cancel-friend-request.use-case';
import { GetFriendsUseCase } from './application/use-cases/get-friends.use-case';
import { RemoveFriendUseCase } from './application/use-cases/remove-friend.use-case';
import { FRIEND_REPOSITORY } from './domain/repositories/friend.repository.interface';
import { TokenService } from '../auth/application/services/token.service';
import { UserAuthGuard } from './application/guards/user-auth.guard';
import { FriendRequestStatus } from './domain/enums/friend-request-status.enum';

describe('FriendsModule (Integration)', () => {
  let app: INestApplication;
  let mockFriendRepo: any;
  let mockTokenService: any;

  beforeAll(async () => {
    mockFriendRepo = {
      findUserById: jest.fn().mockImplementation(async (id: number) => {
        if (id === 999) return null;
        return { id, isBanned: false };
      }),
      createRequest: jest.fn().mockImplementation(async (senderId: number, receiverId: number) => ({
        id: 1,
        senderId,
        receiverId,
        status: FriendRequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        receiver: {
          id: receiverId,
          fullName: 'Target User',
          username: 'target_user',
          avatarUrl: 'http://avatar.webp',
        },
      })),
      findRequestById: jest.fn().mockImplementation(async (id: number) => {
        if (id === 1) {
          return {
            id: 1,
            senderId: 2,
            receiverId: 1,
            status: FriendRequestStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            sender: {
              id: 2,
              fullName: 'Sara Connor',
              username: 'sarah_c',
              avatarUrl: 'http://avatar.webp',
            },
          };
        }
        if (id === 2) {
          return {
            id: 2,
            senderId: 1,
            receiverId: 3,
            status: FriendRequestStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            receiver: {
              id: 3,
              fullName: 'John Doe',
              username: 'johndoe',
              avatarUrl: 'http://john.webp',
            },
          };
        }
        return null;
      }),
      findRequestBetweenUsers: jest.fn().mockResolvedValue(null),
      updateRequestStatus: jest.fn().mockImplementation(async (id: number, status: FriendRequestStatus) => ({
        id,
        senderId: id === 2 ? 1 : 2,
        receiverId: id === 2 ? 3 : 1,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: 2,
          fullName: 'Sara Connor',
          username: 'sarah_c',
          avatarUrl: 'http://avatar.webp',
        },
        receiver: {
          id: 3,
          fullName: 'John Doe',
          username: 'johndoe',
          avatarUrl: 'http://john.webp',
        },
      })),
      getReceivedRequests: jest.fn().mockResolvedValue({
        items: [
          {
            id: 1,
            senderId: 2,
            receiverId: 1,
            status: FriendRequestStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            sender: {
              id: 2,
              fullName: 'Sara Connor',
              username: 'sarah_c',
              avatarUrl: 'http://avatar.webp',
            },
          },
        ],
        total: 1,
      }),
      getSentRequests: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
      }),
      getFriends: jest.fn().mockResolvedValue({
        items: [
          {
            id: 1,
            status: FriendRequestStatus.ACCEPTED,
            createdAt: new Date(),
            updatedAt: new Date(),
            fullName: 'Sara Connor',
            username: 'sarah_c',
            avatarUrl: 'http://avatar.webp',
          },
        ],
        total: 1,
      }),
      deleteFriendship: jest.fn().mockResolvedValue(true),
      createFriendRequestNotification: jest.fn().mockResolvedValue(undefined),
    };

    mockTokenService = {
      verifyAccessToken: jest.fn().mockResolvedValue({ sub: 1 }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [
        UserAuthGuard,
        {
          provide: FRIEND_REPOSITORY,
          useValue: mockFriendRepo,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        AddFriendUseCase,
        GetFriendRequestsUseCase,
        AcceptFriendRequestUseCase,
        RejectFriendRequestUseCase,
        CancelFriendRequestUseCase,
        GetFriendsUseCase,
        RemoveFriendUseCase,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /friends/add', () => {
    it('should send a friend request to target user and return flat item', async () => {
      const response = await request(app.getHttpServer())
        .post('/friends/add')
        .set('Authorization', 'Bearer valid_token')
        .send({ userId: 2 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Friend request sent successfully');
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.fullName).toBe('Target User');
      expect(response.body.data.username).toBe('target_user');
      expect(response.body.data.user).toBeUndefined();
    });

    it('should reject request when adding self', async () => {
      await request(app.getHttpServer())
        .post('/friends/add')
        .set('Authorization', 'Bearer valid_token')
        .send({ userId: 1 })
        .expect(400);
    });

    it('should return 404 if target user does not exist', async () => {
      await request(app.getHttpServer())
        .post('/friends/add')
        .set('Authorization', 'Bearer valid_token')
        .send({ userId: 999 })
        .expect(404);
    });
  });

  describe('GET /friends/requests', () => {
    it('should return paginated friend requests with flat item in root of item', async () => {
      const response = await request(app.getHttpServer())
        .get('/friends/requests?page=1&limit=10')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].id).toBe(1);
      expect(response.body.data.items[0].status).toBe(FriendRequestStatus.PENDING);
      expect(response.body.data.items[0].fullName).toBe('Sara Connor');
      expect(response.body.data.items[0].username).toBe('sarah_c');
      expect(response.body.data.items[0].avatarUrl).toBe('http://avatar.webp');
      expect(response.body.data.items[0].user).toBeUndefined();
      expect(response.body.data.items[0].senderId).toBeUndefined();
    });
  });

  describe('POST /friends/accept/:id', () => {
    it('should accept pending friend request and return flat item', async () => {
      const response = await request(app.getHttpServer())
        .post('/friends/accept/1')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.status).toBe(FriendRequestStatus.ACCEPTED);
      expect(response.body.data.fullName).toBe('Sara Connor');
      expect(response.body.data.user).toBeUndefined();
    });
  });

  describe('POST /friends/reject/:id', () => {
    it('should reject pending friend request and return flat item', async () => {
      const response = await request(app.getHttpServer())
        .post('/friends/reject/1')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.status).toBe(FriendRequestStatus.REJECTED);
      expect(response.body.data.fullName).toBe('Sara Connor');
      expect(response.body.data.user).toBeUndefined();
    });
  });

  describe('POST /friends/cancel/:id', () => {
    it('should cancel outgoing pending friend request and return flat item', async () => {
      const response = await request(app.getHttpServer())
        .post('/friends/cancel/2')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Friend request cancelled successfully');
      expect(response.body.data.status).toBe(FriendRequestStatus.CANCELLED);
      expect(response.body.data.fullName).toBe('John Doe');
      expect(response.body.data.user).toBeUndefined();
    });
  });

  describe('GET /friends', () => {
    it('should return paginated friends list with flat items in root of data', async () => {
      const response = await request(app.getHttpServer())
        .get('/friends?page=1&limit=10')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].id).toBe(1);
      expect(response.body.data.items[0].status).toBe(FriendRequestStatus.ACCEPTED);
      expect(response.body.data.items[0].fullName).toBe('Sara Connor');
      expect(response.body.data.items[0].username).toBe('sarah_c');
      expect(response.body.data.items[0].avatarUrl).toBe('http://avatar.webp');
      expect(response.body.data.items[0].user).toBeUndefined();
    });
  });

  describe('DELETE /friends/:friendId', () => {
    it('should remove friend', async () => {
      const response = await request(app.getHttpServer())
        .delete('/friends/2')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Friend removed successfully');
    });
  });
});
