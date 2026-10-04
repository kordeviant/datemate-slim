import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardController } from './admin-dashboard.controller';
import { GetDashboardStatsUseCase } from '../application/use-cases/get-dashboard-stats.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;
  let mockGetDashboardStatsUseCase: Partial<GetDashboardStatsUseCase>;

  beforeEach(async () => {
    mockGetDashboardStatsUseCase = {
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
          provide: TokenService,
          useValue: { verifyAccessToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
  });

  it('should return dashboard overview stats', async () => {
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
});
