import { GetDashboardStatsUseCase } from './get-dashboard-stats.use-case';
import { GetDashboardOverviewUseCase } from './get-dashboard-overview.use-case';
import { GetAdminUsersUseCase } from './get-admin-users.use-case';
import { GetAdminUserDetailsUseCase } from './get-admin-user-details.use-case';
import { UpdateAdminUserUseCase } from './update-admin-user.use-case';
import { BanUserUseCase } from './ban-user.use-case';
import { UnbanUserUseCase } from './unban-user.use-case';
import { GetPendingVerificationsUseCase } from './get-pending-verifications.use-case';
import { ApproveVerificationUseCase } from './approve-verification.use-case';
import { RejectVerificationUseCase } from './reject-verification.use-case';
import { DeleteUserGalleryItemUseCase } from './delete-user-gallery-item.use-case';
import { IAdminRepository } from '../../domain/repositories/admin.repository.interface';
import { AdminUserStatusFilter, AdminGenderFilter } from '../dtos/get-admin-users.dto';

describe('Admin Use Cases', () => {
  let mockAdminRepository: Partial<IAdminRepository>;

  beforeEach(() => {
    mockAdminRepository = {
      getDashboardStats: jest.fn(),
      getDashboardOverview: jest.fn(),
      getUsers: jest.fn(),
      getUserDetails: jest.fn(),
      updateUser: jest.fn(),
      banUser: jest.fn(),
      unbanUser: jest.fn(),
      getPendingVerifications: jest.fn(),
      approveVerification: jest.fn(),
      rejectVerification: jest.fn(),
      deleteUserGalleryItem: jest.fn(),
    };
  });

  describe('GetDashboardStatsUseCase', () => {
    it('should return aggregated platform stats', async () => {
      const stats = {
        totalUsers: 6570,
        onlineUsers: 369,
        pendingSelfies: 7,
        unansweredTickets: 0,
      };
      (mockAdminRepository.getDashboardStats as jest.Mock).mockResolvedValue(stats);

      const useCase = new GetDashboardStatsUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute();

      expect(result).toEqual(stats);
      expect(mockAdminRepository.getDashboardStats).toHaveBeenCalled();
    });
  });

  describe('GetDashboardOverviewUseCase', () => {
    it('should return comprehensive dashboard overview data', async () => {
      const overview = {
        stats: {
          totalUsers: 6570,
          onlineUsers: 369,
          pendingSelfies: 7,
          unansweredTickets: 7,
        },
        weeklyActivity: [],
        genderStats: {
          maleCount: 2694,
          femaleCount: 3876,
          malePercentage: 41,
          femalePercentage: 59,
        },
        recentTickets: [],
        recentSelfies: [],
      };
      (mockAdminRepository.getDashboardOverview as jest.Mock).mockResolvedValue(overview);

      const useCase = new GetDashboardOverviewUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute();

      expect(result).toEqual(overview);
      expect(mockAdminRepository.getDashboardOverview).toHaveBeenCalled();
    });
  });

  describe('GetAdminUsersUseCase', () => {
    it('should delegate fetching users with pagination and filters', async () => {
      const paginatedResult = {
        items: [
          {
            id: 101,
            email: 'sara@example.com',
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
            gallery: [],
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      };
      (mockAdminRepository.getUsers as jest.Mock).mockResolvedValue(paginatedResult);

      const useCase = new GetAdminUsersUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const params = {
        page: 1,
        limit: 10,
        search: 'sara',
        status: AdminUserStatusFilter.ALL,
        gender: AdminGenderFilter.FEMALE,
      };

      const result = await useCase.execute(params);

      expect(result).toEqual(paginatedResult);
      expect(mockAdminRepository.getUsers).toHaveBeenCalledWith(params);
    });
  });

  describe('BanUserUseCase', () => {
    it('should delegate user ban to repository', async () => {
      const banResult = {
        id: 101,
        email: 'user@example.com',
        isBanned: true,
        bannedUntil: '2026-10-11T11:50:00.000Z',
        reason: 'Violated guidelines',
      };
      (mockAdminRepository.banUser as jest.Mock).mockResolvedValue(banResult);

      const useCase = new BanUserUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute(101, 168, 'Violated guidelines');

      expect(result).toEqual(banResult);
      expect(mockAdminRepository.banUser).toHaveBeenCalledWith(
        101,
        168,
        'Violated guidelines',
      );
    });
  });

  describe('UnbanUserUseCase', () => {
    it('should delegate user unban to repository', async () => {
      const unbanResult = {
        id: 101,
        email: 'user@example.com',
        isBanned: false,
        bannedUntil: null,
      };
      (mockAdminRepository.unbanUser as jest.Mock).mockResolvedValue(unbanResult);

      const useCase = new UnbanUserUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute(101);

      expect(result).toEqual(unbanResult);
      expect(mockAdminRepository.unbanUser).toHaveBeenCalledWith(101);
    });
  });

  describe('GetPendingVerificationsUseCase', () => {
    it('should delegate fetching pending verifications', async () => {
      const verificationsResult = {
        data: [
          {
            id: 1,
            userId: 101,
            fullName: 'سارا همتی',
            email: 'sara@example.com',
            avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
            selfieUrl: 'http://localhost:3000/assets/selfies/selfie_1.webp',
            gender: 'FEMALE',
            age: 23,
            requestedAt: '۱۷ دقیقه قبل',
            status: 'PENDING',
            createdAt: '2024-11-20T10:00:00.000Z',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
        },
      };
      (mockAdminRepository.getPendingVerifications as jest.Mock).mockResolvedValue(
        verificationsResult,
      );

      const useCase = new GetPendingVerificationsUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute(1, 10);

      expect(result).toEqual(verificationsResult);
      expect(mockAdminRepository.getPendingVerifications).toHaveBeenCalledWith(
        1,
        10,
        undefined,
      );
    });
  });

  describe('ApproveVerificationUseCase', () => {
    it('should delegate approval to repository and send push notification', async () => {
      const approvalResult = {
        id: 101,
        userId: 202,
        status: 'APPROVED',
        verifiedAt: '2026-10-05T12:15:00.000Z',
      };
      (mockAdminRepository.approveVerification as jest.Mock).mockResolvedValue(
        approvalResult,
      );
      const mockPushService = {
        sendPush: jest.fn(),
        sendFriendRequestNotification: jest.fn(),
        sendFriendRequestAcceptedNotification: jest.fn(),
        sendLikeUserNotification: jest.fn(),
        sendSelfieAcceptedNotification: jest.fn().mockResolvedValue(true),
        sendSelfieRejectedNotification: jest.fn(),
      };

      const useCase = new ApproveVerificationUseCase(
        mockAdminRepository as IAdminRepository,
        mockPushService as any,
      );
      const result = await useCase.execute(101);

      expect(result).toEqual(approvalResult);
      expect(mockAdminRepository.approveVerification).toHaveBeenCalledWith(101);
      expect(mockPushService.sendSelfieAcceptedNotification).toHaveBeenCalledWith({
        recipientUserId: 202,
      });
    });

    it('should handle missing push service gracefully', async () => {
      const approvalResult = {
        id: 101,
        status: 'APPROVED',
        verifiedAt: '2026-10-05T12:15:00.000Z',
      };
      (mockAdminRepository.approveVerification as jest.Mock).mockResolvedValue(
        approvalResult,
      );

      const useCase = new ApproveVerificationUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute(101);

      expect(result).toEqual(approvalResult);
      expect(mockAdminRepository.approveVerification).toHaveBeenCalledWith(101);
    });

    it('should not throw if push notification fails', async () => {
      const approvalResult = {
        id: 101,
        userId: 202,
        status: 'APPROVED',
        verifiedAt: '2026-10-05T12:15:00.000Z',
      };
      (mockAdminRepository.approveVerification as jest.Mock).mockResolvedValue(
        approvalResult,
      );
      const mockPushService = {
        sendPush: jest.fn(),
        sendFriendRequestNotification: jest.fn(),
        sendFriendRequestAcceptedNotification: jest.fn(),
        sendLikeUserNotification: jest.fn(),
        sendSelfieAcceptedNotification: jest
          .fn()
          .mockRejectedValue(new Error('Gateway down')),
        sendSelfieRejectedNotification: jest.fn(),
      };

      const useCase = new ApproveVerificationUseCase(
        mockAdminRepository as IAdminRepository,
        mockPushService as any,
      );
      const result = await useCase.execute(101);

      expect(result).toEqual(approvalResult);
    });
  });

  describe('RejectVerificationUseCase', () => {
    it('should delegate rejection with reason to repository and send push notification', async () => {
      const rejectionResult = {
        id: 101,
        userId: 202,
        status: 'REJECTED',
        reason: 'Blurry face',
        rejectedAt: '2026-10-05T12:16:00.000Z',
      };
      (mockAdminRepository.rejectVerification as jest.Mock).mockResolvedValue(
        rejectionResult,
      );
      const mockPushService = {
        sendPush: jest.fn(),
        sendFriendRequestNotification: jest.fn(),
        sendFriendRequestAcceptedNotification: jest.fn(),
        sendLikeUserNotification: jest.fn(),
        sendSelfieAcceptedNotification: jest.fn(),
        sendSelfieRejectedNotification: jest.fn().mockResolvedValue(true),
      };

      const useCase = new RejectVerificationUseCase(
        mockAdminRepository as IAdminRepository,
        mockPushService as any,
      );
      const result = await useCase.execute(101, 'Blurry face');

      expect(result).toEqual(rejectionResult);
      expect(mockAdminRepository.rejectVerification).toHaveBeenCalledWith(
        101,
        'Blurry face',
      );
      expect(mockPushService.sendSelfieRejectedNotification).toHaveBeenCalledWith({
        recipientUserId: 202,
        rejectionReason: 'Blurry face',
      });
    });

    it('should handle missing push service gracefully', async () => {
      const rejectionResult = {
        id: 101,
        status: 'REJECTED',
        reason: 'Blurry face',
        rejectedAt: '2026-10-05T12:16:00.000Z',
      };
      (mockAdminRepository.rejectVerification as jest.Mock).mockResolvedValue(
        rejectionResult,
      );

      const useCase = new RejectVerificationUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute(101, 'Blurry face');

      expect(result).toEqual(rejectionResult);
    });

    it('should not throw if push notification fails', async () => {
      const rejectionResult = {
        id: 101,
        userId: 202,
        status: 'REJECTED',
        reason: 'Blurry face',
        rejectedAt: '2026-10-05T12:16:00.000Z',
      };
      (mockAdminRepository.rejectVerification as jest.Mock).mockResolvedValue(
        rejectionResult,
      );
      const mockPushService = {
        sendPush: jest.fn(),
        sendFriendRequestNotification: jest.fn(),
        sendFriendRequestAcceptedNotification: jest.fn(),
        sendLikeUserNotification: jest.fn(),
        sendSelfieAcceptedNotification: jest.fn(),
        sendSelfieRejectedNotification: jest
          .fn()
          .mockRejectedValue(new Error('Gateway timeout')),
      };

      const useCase = new RejectVerificationUseCase(
        mockAdminRepository as IAdminRepository,
        mockPushService as any,
      );
      const result = await useCase.execute(101, 'Blurry face');

      expect(result).toEqual(rejectionResult);
    });
  });

  describe('UpdateAdminUserUseCase', () => {
    it('should delegate updating user and confirming selfie to repository', async () => {
      const updatedUser = {
        id: 101,
        email: 'sara@example.com',
        fullName: 'سارا همتی',
        username: 'sara_h',
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
        bio: 'علاقه‌مند به هنر و عکاسی',
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
      (mockAdminRepository.updateUser as jest.Mock).mockResolvedValue(updatedUser);

      const useCase = new UpdateAdminUserUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const params = {
        confirmSelfie: true,
        bio: 'علاقه‌مند به هنر و عکاسی',
      };
      const result = await useCase.execute(101, params);

      expect(result).toEqual(updatedUser);
      expect(mockAdminRepository.updateUser).toHaveBeenCalledWith(101, params);
    });
  });

  describe('GetAdminUserDetailsUseCase', () => {
    it('should delegate fetching full user details by id', async () => {
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
        gallery: [],
        transactions: [],
        chatRooms: [],
        interests: ['Hiking'],
      };

      (mockAdminRepository.getUserDetails as jest.Mock).mockResolvedValue(
        mockUserDetails,
      );

      const useCase = new GetAdminUserDetailsUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute(12);

      expect(result).toEqual(mockUserDetails);
      expect(mockAdminRepository.getUserDetails).toHaveBeenCalledWith(12);
    });
  });

  describe('DeleteUserGalleryItemUseCase', () => {
    it('should delegate deleting user gallery image', async () => {
      const mockResult = {
        userId: 63,
        galleryId: 68,
        deleted: true,
      };

      (
        mockAdminRepository.deleteUserGalleryItem as jest.Mock
      ).mockResolvedValue(mockResult);

      const useCase = new DeleteUserGalleryItemUseCase(
        mockAdminRepository as IAdminRepository,
      );
      const result = await useCase.execute(63, 68);

      expect(result).toEqual(mockResult);
      expect(mockAdminRepository.deleteUserGalleryItem).toHaveBeenCalledWith(
        63,
        68,
      );
    });
  });
});
