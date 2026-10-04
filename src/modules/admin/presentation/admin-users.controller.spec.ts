import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { GetAdminUsersUseCase } from '../application/use-cases/get-admin-users.use-case';
import { BanUserUseCase } from '../application/use-cases/ban-user.use-case';
import { UnbanUserUseCase } from '../application/use-cases/unban-user.use-case';
import { TokenService } from '../../auth/application/services/token.service';
import {
  AdminGenderFilter,
  AdminSortOrder,
  AdminUserSortBy,
  AdminUserStatusFilter,
  GetAdminUsersDto,
} from '../application/dtos/get-admin-users.dto';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let mockGetAdminUsersUseCase: Partial<GetAdminUsersUseCase>;
  let mockBanUserUseCase: Partial<BanUserUseCase>;
  let mockUnbanUserUseCase: Partial<UnbanUserUseCase>;

  beforeEach(async () => {
    mockGetAdminUsersUseCase = {
      execute: jest.fn(),
    };
    mockBanUserUseCase = {
      execute: jest.fn(),
    };
    mockUnbanUserUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        {
          provide: GetAdminUsersUseCase,
          useValue: mockGetAdminUsersUseCase,
        },
        {
          provide: BanUserUseCase,
          useValue: mockBanUserUseCase,
        },
        {
          provide: UnbanUserUseCase,
          useValue: mockUnbanUserUseCase,
        },
        {
          provide: TokenService,
          useValue: { verifyAccessToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
  });

  describe('GET /v1/admin/users', () => {
    it('should return paginated list of users', async () => {
      const mockResult = {
        items: [
          {
            id: 101,
            email: 'Sarahemati@gmail.com',
            fullName: 'سارا همتی',
            username: 'sara_h',
            avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
            isPremium: true,
            profileValidated: false,
            isBanned: false,
            bannedUntil: null,
            gender: 'FEMALE',
            age: 23,
            city: 'اسلامشهر',
            registrationCompleted: true,
            isOnline: true,
            lastSeenAt: '2026-10-04T07:15:00.000Z',
            createdAt: '2024-11-20T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      };

      (mockGetAdminUsersUseCase.execute as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const query: GetAdminUsersDto = {
        page: 1,
        limit: 10,
        search: 'sara',
        status: AdminUserStatusFilter.ALL,
        gender: AdminGenderFilter.FEMALE,
        sortBy: AdminUserSortBy.CREATED_AT,
        order: AdminSortOrder.DESC,
      };

      const res = await controller.getUsers(query);

      expect(res).toEqual({
        status: 'success',
        message: 'Users list retrieved',
        data: mockResult,
      });
      expect(mockGetAdminUsersUseCase.execute).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'sara',
        status: AdminUserStatusFilter.ALL,
        gender: AdminGenderFilter.FEMALE,
        sortBy: AdminUserSortBy.CREATED_AT,
        order: AdminSortOrder.DESC,
      });
    });
  });

  describe('POST /v1/admin/users/:id/ban', () => {
    it('should ban a user and return response envelope', async () => {
      const banResult = {
        id: 101,
        email: 'user@example.com',
        isBanned: true,
        bannedUntil: '2026-10-11T11:50:00.000Z',
        reason: 'Violation of rules',
      };
      (mockBanUserUseCase.execute as jest.Mock).mockResolvedValue(banResult);

      const res = await controller.banUser(101, {
        durationHours: 168,
        reason: 'Violation of rules',
      });

      expect(res).toEqual({
        status: 'success',
        message: 'User banned successfully',
        data: banResult,
      });
      expect(mockBanUserUseCase.execute).toHaveBeenCalledWith(
        101,
        168,
        'Violation of rules',
      );
    });
  });

  describe('POST /v1/admin/users/:id/unban', () => {
    it('should unban a user and return response envelope', async () => {
      const unbanResult = {
        id: 101,
        email: 'user@example.com',
        isBanned: false,
        bannedUntil: null,
      };
      (mockUnbanUserUseCase.execute as jest.Mock).mockResolvedValue(unbanResult);

      const res = await controller.unbanUser(101);

      expect(res).toEqual({
        status: 'success',
        message: 'User unbanned successfully',
        data: unbanResult,
      });
      expect(mockUnbanUserUseCase.execute).toHaveBeenCalledWith(101);
    });
  });
});
