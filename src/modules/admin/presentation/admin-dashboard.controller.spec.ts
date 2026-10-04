import { Test, TestingModule } from '@nestjs/testing';
import { PATH_METADATA } from '@nestjs/common/constants';
import { AdminDashboardController } from './admin-dashboard.controller';
import { GetDashboardStatsUseCase } from '../application/use-cases/get-dashboard-stats.use-case';
import { GetDashboardOverviewUseCase } from '../application/use-cases/get-dashboard-overview.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;
  let mockGetDashboardStatsUseCase: Partial<GetDashboardStatsUseCase>;
  let mockGetDashboardOverviewUseCase: Partial<GetDashboardOverviewUseCase>;

  beforeEach(async () => {
    mockGetDashboardStatsUseCase = {
      execute: jest.fn(),
    };
    mockGetDashboardOverviewUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        {
          provide: GetDashboardStatsUseCase,
          useValue: mockGetDashboardStatsUseCase,
        },
        {
          provide: GetDashboardOverviewUseCase,
          useValue: mockGetDashboardOverviewUseCase,
        },
        {
          provide: TokenService,
          useValue: { verifyAccessToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
  });

  it('should return dashboard stats', async () => {
    const stats = {
      totalUsers: 6570,
      onlineUsers: 369,
      pendingSelfies: 7,
      unansweredTickets: 0,
    };
    (mockGetDashboardStatsUseCase.execute as jest.Mock).mockResolvedValue(stats);

    const result = await controller.getStats();

    expect(result).toEqual({
      status: 'success',
      message: 'Dashboard stats retrieved',
      data: stats,
    });
    expect(mockGetDashboardStatsUseCase.execute).toHaveBeenCalled();
  });

  it('should expose the dashboard stats and overview routes', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, AdminDashboardController.prototype.getStats),
    ).toBe('stats');
    expect(
      Reflect.getMetadata(PATH_METADATA, AdminDashboardController.prototype.getOverview),
    ).toBe('overview');
  });

  it('should return comprehensive dashboard overview payload', async () => {
    const overviewData = {
      stats: {
        totalUsers: 6570,
        onlineUsers: 369,
        pendingSelfies: 7,
        unansweredTickets: 7,
      },
      weeklyActivity: [
        { dayName: 'ش', hours: 210, dateStr: '۱۰ اسفند', isPeak: true },
      ],
      genderStats: {
        maleCount: 2694,
        femaleCount: 3876,
        malePercentage: 41,
        femalePercentage: 59,
      },
      recentTickets: [
        {
          id: 101,
          code: '۲۳۴۶',
          userName: 'سکینه عالیخانی',
          avatar: '/uploads/avatars/user1.webp',
          dateTime: '۱۴۰۳/۰۹/۱۲ - ۱۳:۲۳',
          time: '۱۴:۲۰',
          unreadCount: 3,
          status: 'PENDING',
        },
      ],
      recentSelfies: [
        {
          id: 1,
          userId: 45,
          fullName: 'چی چانگ',
          email: 'chichang@gmail.com',
          avatar: '/uploads/avatars/avatar45.webp',
          selfieUrl: '/uploads/selfies/selfie45.webp',
          createdAt: '2026-03-03T11:20:00.000Z',
        },
      ],
    };
    (mockGetDashboardOverviewUseCase.execute as jest.Mock).mockResolvedValue(overviewData);

    const result = await controller.getOverview();

    expect(result).toEqual({
      status: 'success',
      message: 'Dashboard overview data retrieved successfully',
      data: overviewData,
      error: null,
    });
    expect(mockGetDashboardOverviewUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
