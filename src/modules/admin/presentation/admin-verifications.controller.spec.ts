import { Test, TestingModule } from '@nestjs/testing';
import { AdminVerificationsController } from './admin-verifications.controller';
import { GetPendingVerificationsUseCase } from '../application/use-cases/get-pending-verifications.use-case';
import { ApproveVerificationUseCase } from '../application/use-cases/approve-verification.use-case';
import { RejectVerificationUseCase } from '../application/use-cases/reject-verification.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('AdminVerificationsController', () => {
  let controller: AdminVerificationsController;
  let mockGetPendingVerificationsUseCase: Partial<GetPendingVerificationsUseCase>;
  let mockApproveVerificationUseCase: Partial<ApproveVerificationUseCase>;
  let mockRejectVerificationUseCase: Partial<RejectVerificationUseCase>;

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
    it('should return pending verifications', async () => {
      const mockResult = {
        items: [
          {
            userId: 101,
            fullName: 'سارا همتی',
            username: 'sara_h',
            email: 'sara@example.com',
            avatarUrl: 'http://localhost:3000/assets/avatars/avatar_1.webp',
            selfieUrl: 'http://localhost:3000/assets/selfies/selfie_1.webp',
            gender: 'FEMALE',
            age: 23,
            city: 'اسلامشهر',
            submittedAt: '2026-10-04T07:15:00.000Z',
            createdAt: '2024-11-20T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      };

      (
        mockGetPendingVerificationsUseCase.execute as jest.Mock
      ).mockResolvedValue(mockResult);

      const res = await controller.getPendingVerifications({
        page: 1,
        limit: 10,
      });

      expect(res).toEqual({
        status: 'success',
        message: 'Pending verifications retrieved',
        data: mockResult,
      });
      expect(mockGetPendingVerificationsUseCase.execute).toHaveBeenCalledWith(
        1,
        10,
      );
    });
  });

  describe('POST /v1/admin/verifications/:userId/approve', () => {
    it('should approve selfie verification', async () => {
      const mockResult = {
        userId: 101,
        profileValidated: true,
      };

      (mockApproveVerificationUseCase.execute as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const res = await controller.approveVerification(101);

      expect(res).toEqual({
        status: 'success',
        message: 'User selfie verification approved',
        data: mockResult,
      });
      expect(mockApproveVerificationUseCase.execute).toHaveBeenCalledWith(101);
    });
  });

  describe('POST /v1/admin/verifications/:userId/reject', () => {
    it('should reject selfie verification with reason', async () => {
      const mockResult = {
        userId: 101,
        profileValidated: false,
        reason: 'Blurry selfie',
      };

      (mockRejectVerificationUseCase.execute as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const res = await controller.rejectVerification(101, {
        reason: 'Blurry selfie',
      });

      expect(res).toEqual({
        status: 'success',
        message: 'User selfie verification rejected',
        data: mockResult,
      });
      expect(mockRejectVerificationUseCase.execute).toHaveBeenCalledWith(
        101,
        'Blurry selfie',
      );
    });
  });
});
