import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { GetAdminUsersUseCase } from '../application/use-cases/get-admin-users.use-case';
import { GetAdminUserDetailsUseCase } from '../application/use-cases/get-admin-user-details.use-case';
import { UpdateAdminUserUseCase } from '../application/use-cases/update-admin-user.use-case';
import { BanUserUseCase } from '../application/use-cases/ban-user.use-case';
import { UnbanUserUseCase } from '../application/use-cases/unban-user.use-case';
import { DeleteUserGalleryItemUseCase } from '../application/use-cases/delete-user-gallery-item.use-case';
import { DeleteAdminUserUseCase } from '../application/use-cases/delete-admin-user.use-case';
import { TerminateUserDeviceUseCase } from '../application/use-cases/terminate-user-device.use-case';
import { TerminateAllUserDevicesUseCase } from '../application/use-cases/terminate-all-user-devices.use-case';
import { GetUsersCountUseCase } from '../application/use-cases/get-users-count.use-case';
import { GetPendingSelfiesCountUseCase } from '../application/use-cases/get-pending-selfies-count.use-case';
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
  let mockGetAdminUserDetailsUseCase: Partial<GetAdminUserDetailsUseCase>;
  let mockUpdateAdminUserUseCase: Partial<UpdateAdminUserUseCase>;
  let mockBanUserUseCase: Partial<BanUserUseCase>;
  let mockUnbanUserUseCase: Partial<UnbanUserUseCase>;
  let mockDeleteUserGalleryItemUseCase: Partial<DeleteUserGalleryItemUseCase>;
  let mockDeleteAdminUserUseCase: Partial<DeleteAdminUserUseCase>;
  let mockTerminateUserDeviceUseCase: Partial<TerminateUserDeviceUseCase>;
  let mockTerminateAllUserDevicesUseCase: Partial<TerminateAllUserDevicesUseCase>;
  let mockGetUsersCountUseCase: Partial<GetUsersCountUseCase>;
  let mockGetPendingSelfiesCountUseCase: Partial<GetPendingSelfiesCountUseCase>;

  beforeEach(async () => {
    mockGetAdminUsersUseCase = {
      execute: jest.fn(),
    };
    mockGetAdminUserDetailsUseCase = {
      execute: jest.fn(),
    };
    mockUpdateAdminUserUseCase = {
      execute: jest.fn(),
    };
    mockBanUserUseCase = {
      execute: jest.fn(),
    };
    mockUnbanUserUseCase = {
      execute: jest.fn(),
    };
    mockDeleteUserGalleryItemUseCase = {
      execute: jest.fn(),
    };
    mockDeleteAdminUserUseCase = {
      execute: jest.fn(),
    };
    mockTerminateUserDeviceUseCase = {
      execute: jest.fn(),
    };
    mockTerminateAllUserDevicesUseCase = {
      execute: jest.fn(),
    };
    mockGetUsersCountUseCase = {
      execute: jest.fn(),
    };
    mockGetPendingSelfiesCountUseCase = {
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
          provide: GetAdminUserDetailsUseCase,
          useValue: mockGetAdminUserDetailsUseCase,
        },
        {
          provide: UpdateAdminUserUseCase,
          useValue: mockUpdateAdminUserUseCase,
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
          provide: DeleteUserGalleryItemUseCase,
          useValue: mockDeleteUserGalleryItemUseCase,
        },
        {
          provide: DeleteAdminUserUseCase,
          useValue: mockDeleteAdminUserUseCase,
        },
        {
          provide: TerminateUserDeviceUseCase,
          useValue: mockTerminateUserDeviceUseCase,
        },
        {
          provide: TerminateAllUserDevicesUseCase,
          useValue: mockTerminateAllUserDevicesUseCase,
        },
        {
          provide: GetUsersCountUseCase,
          useValue: mockGetUsersCountUseCase,
        },
        {
          provide: GetPendingSelfiesCountUseCase,
          useValue: mockGetPendingSelfiesCountUseCase,
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
            avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
            age: 23,
            gender: 'FEMALE',
            isPremium: true,
            hasPendingSelfie: false,
            profileValidated: false,
            isOnline: true,
            bannedUntil: null,
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
      expect(typeof res.data.items[0].profileValidated).toBe('boolean');
      expect(res.data.items[0].profileValidated).toBe(false);
      expect(res.data.items[0].hasPendingSelfie).toBe(false);
      expect((res.data.items[0] as any).gallery).toBeUndefined();
      expect(mockGetAdminUsersUseCase.execute).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'sara',
        status: AdminUserStatusFilter.ALL,
        gender: AdminGenderFilter.FEMALE,
        minAge: undefined,
        maxAge: undefined,
        sortBy: AdminUserSortBy.CREATED_AT,
        order: AdminSortOrder.DESC,
      });
    });

    it('should pass minAge and maxAge filters when provided in query', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        totalPages: 1,
      };

      (mockGetAdminUsersUseCase.execute as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const query: GetAdminUsersDto = {
        page: 1,
        limit: 9,
        status: AdminUserStatusFilter.ALL,
        gender: AdminGenderFilter.ALL,
        minAge: 24,
        maxAge: 27,
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
        limit: 9,
        search: undefined,
        status: AdminUserStatusFilter.ALL,
        gender: AdminGenderFilter.ALL,
        minAge: 24,
        maxAge: 27,
        sortBy: AdminUserSortBy.CREATED_AT,
        order: AdminSortOrder.DESC,
      });
    });
  });

  describe('GET /v1/admin/users/:id', () => {
    it('should return complete user details by id', async () => {
      const mockUserDetails: any = {
        id: 12,
        email: 'sarah.smith@example.com',
        role: 'USER',
        language: 'FA',
        fullName: 'سارا محمدی',
        username: 'sarah_m',
        phoneNumber: '09123456789',
        bio: 'علاقه‌مند به سفر',
        avatarUrl: 'https://example.com/avatar.webp',
        selfieUrl: null,
        profileValidated: true,
        hasPendingSelfie: false,
        bannedUntil: null,
        wallet: 150000,
        score: 420,
        notificationsOn: true,
        isPrivate: false,
        isOnline: false,
        isPremium: true,
        lastSeenAt: '2026-10-05T12:00:00.000Z',
        createdAt: '2025-11-20T14:22:00.000Z',
        updatedAt: '2026-04-01T08:15:00.000Z',
        demographic: {
          birthDate: '1997-07-05',
          gender: 'FEMALE',
          age: 29,
          cityName: 'تهران',
          job: 'طراح محصول',
          degree: 'کارشناسی ارشد',
          height: 168,
          weight: 58,
          religion: null,
          relationStatus: 'مجرد',
        },
        gallery: [
          {
            id: 101,
            url: 'https://example.com/photo1.webp',
            likesCount: 24,
            createdAt: '2026-01-10T12:00:00.000Z',
          },
        ],
        transactions: [],
        chatRooms: [],
        devices: [],
        likes: [],
        interests: ['Hiking'],
      };

      (mockGetAdminUserDetailsUseCase.execute as jest.Mock).mockResolvedValue(
        mockUserDetails,
      );

      const res = await controller.getUserDetails(12);

      expect(res).toEqual({
        status: 'success',
        message: 'User details retrieved successfully',
        data: mockUserDetails,
      });
      expect(mockGetAdminUserDetailsUseCase.execute).toHaveBeenCalledWith(12);
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

  describe('PATCH /v1/admin/users/:id', () => {
    it('should update user and confirm selfie verification', async () => {
      const updatedUser = {
        id: 101,
        email: 'user@example.com',
        fullName: 'سارا همتی',
        username: 'sara_h',
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
        bio: 'بیوگرافی جدید',
        isPremium: true,
        profileValidated: true,
        selfieVerified: true,
        isBanned: false,
        bannedUntil: null,
        gender: 'FEMALE',
        age: 23,
        city: 'اسلامشهر',
        registrationCompleted: true,
        isOnline: true,
        lastSeenAt: '2026-10-04T07:15:00.000Z',
        createdAt: '2024-11-20T10:00:00.000Z',
        gallery: [],
      };
      (mockUpdateAdminUserUseCase.execute as jest.Mock).mockResolvedValue(
        updatedUser,
      );

      const res = await controller.updateUser(101, {
        confirmSelfie: true,
        bio: 'بیوگرافی جدید',
      });

      expect(res).toEqual({
        status: 'success',
        message: 'User updated successfully',
        data: updatedUser,
      });
      expect(mockUpdateAdminUserUseCase.execute).toHaveBeenCalledWith(101, {
        confirmSelfie: true,
        bio: 'بیوگرافی جدید',
      });
    });
  });

  describe('PUT /v1/admin/users/:id', () => {
    it('should alias PATCH and update user', async () => {
      const updatedUser = {
        id: 101,
        email: 'user@example.com',
        fullName: 'سارا همتی',
        username: 'sara_h',
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
        bio: 'بیوگرافی',
        isPremium: true,
        profileValidated: true,
        selfieVerified: true,
        isBanned: false,
        bannedUntil: null,
        gender: 'FEMALE',
        age: 23,
        city: 'اسلامشهر',
        registrationCompleted: true,
        isOnline: true,
        lastSeenAt: '2026-10-04T07:15:00.000Z',
        createdAt: '2024-11-20T10:00:00.000Z',
        gallery: [],
      };
      (mockUpdateAdminUserUseCase.execute as jest.Mock).mockResolvedValue(
        updatedUser,
      );

      const res = await controller.updateUserPut(101, {
        confirmSelfie: true,
      });

      expect(res).toEqual({
        status: 'success',
        message: 'User updated successfully',
        data: updatedUser,
      });
      expect(mockUpdateAdminUserUseCase.execute).toHaveBeenCalledWith(101, {
        confirmSelfie: true,
      });
    });
  });

  describe('DELETE /v1/admin/users/:userId/gallery/:galleryId', () => {
    it('should delete user gallery image and return success response', async () => {
      const mockResult = {
        userId: 63,
        galleryId: 68,
        deleted: true,
      };

      (
        mockDeleteUserGalleryItemUseCase.execute as jest.Mock
      ).mockResolvedValue(mockResult);

      const res = await controller.deleteUserGalleryItem(63, 68);

      expect(res).toEqual({
        status: 'success',
        success: true,
        message: 'Gallery image deleted successfully',
        data: mockResult,
      });
      expect(mockDeleteUserGalleryItemUseCase.execute).toHaveBeenCalledWith(
        63,
        68,
      );
    });
  });

  describe('GET /v1/admin/users/count', () => {
    it('should return total users count', async () => {
      (mockGetUsersCountUseCase.execute as jest.Mock).mockResolvedValue({
        count: 6570,
      });

      const res = await controller.getUsersCount();

      expect(res).toEqual({
        status: 'success',
        message: 'Users count retrieved successfully',
        data: { count: 6570 },
      });
      expect(mockGetUsersCountUseCase.execute).toHaveBeenCalledWith(undefined);
    });

    it('should pass status filter when provided in query', async () => {
      (mockGetUsersCountUseCase.execute as jest.Mock).mockResolvedValue({
        count: 42,
      });

      const res = await controller.getUsersCount('BLOCKED');

      expect(res).toEqual({
        status: 'success',
        message: 'Users count retrieved successfully',
        data: { count: 42 },
      });
      expect(mockGetUsersCountUseCase.execute).toHaveBeenCalledWith('BLOCKED');
    });
  });

  describe('GET /v1/admin/users/pending-selfies/count', () => {
    it('should return count of users with unvalidated selfies', async () => {
      (mockGetPendingSelfiesCountUseCase.execute as jest.Mock).mockResolvedValue({
        count: 7,
      });

      const res = await controller.getPendingSelfiesCount();

      expect(res).toEqual({
        status: 'success',
        message: 'Pending selfies count retrieved successfully',
        data: { count: 7 },
      });
      expect(mockGetPendingSelfiesCountUseCase.execute).toHaveBeenCalled();
    });
  });

  describe('DELETE /v1/admin/users/:id', () => {
    it('should delete a single user and return success response', async () => {
      const mockResult = {
        userId: 101,
        deleted: true,
      };

      (mockDeleteAdminUserUseCase.execute as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const res = await controller.deleteUser(101);

      expect(res).toEqual({
        status: 'success',
        success: true,
        message: 'User deleted successfully',
        data: mockResult,
      });
      expect(mockDeleteAdminUserUseCase.execute).toHaveBeenCalledWith(101);
    });
  });

  describe('DELETE /v1/admin/users/:userId/devices/:deviceId', () => {
    it('should terminate a user device and return success response', async () => {
      const mockResult = {
        userId: 12,
        deviceId: 10,
        terminated: true,
      };

      (mockTerminateUserDeviceUseCase.execute as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const res = await controller.terminateDevice(12, 10);

      expect(res).toEqual({
        status: 'success',
        success: true,
        message: 'Device session terminated successfully',
        data: mockResult,
      });
      expect(mockTerminateUserDeviceUseCase.execute).toHaveBeenCalledWith(
        12,
        10,
      );
    });
  });

  describe('DELETE /v1/admin/users/:userId/devices', () => {
    it('should terminate all user devices and return success response', async () => {
      const mockResult = {
        userId: 12,
        terminated: true,
        count: 4,
      };

      (
        mockTerminateAllUserDevicesUseCase.execute as jest.Mock
      ).mockResolvedValue(mockResult);

      const res = await controller.terminateAllDevices(12);

      expect(res).toEqual({
        status: 'success',
        success: true,
        message: 'All user device sessions terminated successfully',
        data: mockResult,
      });
      expect(mockTerminateAllUserDevicesUseCase.execute).toHaveBeenCalledWith(12);
    });
  });
});


