import { Test, TestingModule } from '@nestjs/testing';
import { AdminVerificationsController } from './admin-verifications.controller';
import { GetPendingVerificationsUseCase } from '../application/use-cases/get-pending-verifications.use-case';
import { ApproveVerificationUseCase } from '../application/use-cases/approve-verification.use-case';
import { RejectVerificationUseCase } from '../application/use-cases/reject-verification.use-case';
import { GetPendingSelfiesCountUseCase } from '../application/use-cases/get-pending-selfies-count.use-case';
import { TokenService } from '../../auth/application/services/token.service';
import { AdminVerificationStatusFilter } from '../application/dtos/get-admin-verifications.dto';

describe('AdminVerificationsController', () => {
  let controller: AdminVerificationsController;
  let mockGetPendingVerificationsUseCase: Partial<GetPendingVerificationsUseCase>;
  let mockApproveVerificationUseCase: Partial<ApproveVerificationUseCase>;
  let mockRejectVerificationUseCase: Partial<RejectVerificationUseCase>;
  let mockGetPendingSelfiesCountUseCase: Partial<GetPendingSelfiesCountUseCase>;

  beforeEach(async () => {
    mockGetPendingVerificationsUseCase = {
      execute: jest.fn(),
    };
    mockApproveVerificationUseCase = {
      execute: jest.fn(),
    };
    mockRejectVerificationUseCase = {
      execute: jest.fn(),
    };
    mockGetPendingSelfiesCountUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminVerificationsController],
      providers: [
        {
          provide: GetPendingVerificationsUseCase,
          useValue: mockGetPendingVerificationsUseCase,
        },
        {
          provide: ApproveVerificationUseCase,
          useValue: mockApproveVerificationUseCase,
        },
        {
          provide: RejectVerificationUseCase,
          useValue: mockRejectVerificationUseCase,
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

    controller = module.get<AdminVerificationsController>(
      AdminVerificationsController,
    );
  });

  describe('GET /v1/admin/verifications', () => {
    it('should return pending verifications list with meta and status message', async () => {
      const mockResult = {
        data: [
          {
            id: 1,
            userId: 102,
            fullName: 'Sara Mohammadi',
            email: 'sara@example.com',
            avatarUrl: 'https://storage.datemate.com/avatars/user-102.webp',
            selfieUrl: 'https://storage.datemate.com/selfies/user-102-selfie.jpg',
            age: 25,
            gender: 'FEMALE',
            requestedAt: '2026-10-05T12:00:00.000Z',
            status: 'PENDING',
            createdAt: '2026-10-05T12:00:00.000Z',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
        },
      };

      (
        mockGetPendingVerificationsUseCase.execute as jest.Mock
      ).mockResolvedValue(mockResult);

      const res = await controller.getPendingVerifications({
        page: 1,
        limit: 20,
        status: AdminVerificationStatusFilter.PENDING,
      });

      expect(res).toEqual({
        status: 'success',
        message: 'Pending verifications retrieved successfully',
        data: mockResult.data,
        meta: mockResult.meta,
      });
      expect(mockGetPendingVerificationsUseCase.execute).toHaveBeenCalledWith(
        1,
        20,
        AdminVerificationStatusFilter.PENDING,
      );
    });
  });

  describe('POST /v1/admin/verifications/:id/approve', () => {
    it('should approve selfie verification and return success message with data', async () => {
      const mockResult = {
        id: 1,
        status: 'APPROVED',
        verifiedAt: '2026-10-05T12:15:00.000Z',
      };

      (mockApproveVerificationUseCase.execute as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const res = await controller.approveVerification(1);

      expect(res).toEqual({
        status: 'success',
        success: true,
        message: 'Verification approved successfully',
        data: mockResult,
      });
      expect(mockApproveVerificationUseCase.execute).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /v1/admin/verifications/:id/reject', () => {
    it('should reject selfie verification with reason and return success message with data', async () => {
      const mockResult = {
        id: 1,
        status: 'REJECTED',
        reason: 'Image is blurry or does not match profile picture.',
        rejectedAt: '2026-10-05T12:16:00.000Z',
      };

      (mockRejectVerificationUseCase.execute as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const res = await controller.rejectVerification(1, {
        reason: 'Image is blurry or does not match profile picture.',
      });

      expect(res).toEqual({
        status: 'success',
        success: true,
        message: 'Verification rejected successfully',
        data: mockResult,
      });
      expect(mockRejectVerificationUseCase.execute).toHaveBeenCalledWith(
        1,
        'Image is blurry or does not match profile picture.',
      );
    });
  });

  describe('GET /v1/admin/verifications/count', () => {
    it('should return pending selfies count and response envelope', async () => {
      (mockGetPendingSelfiesCountUseCase.execute as jest.Mock).mockResolvedValue({
        count: 12,
      });

      const res = await controller.getPendingSelfiesCount();

      expect(res).toEqual({
        status: 'success',
        message: 'Pending selfies count retrieved successfully',
        data: { count: 12 },
      });
      expect(mockGetPendingSelfiesCountUseCase.execute).toHaveBeenCalled();
    });
  });
});

