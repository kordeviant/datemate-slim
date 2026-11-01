import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../application/guards/admin-auth.guard';
import { GetDashboardStatsUseCase } from '../application/use-cases/get-dashboard-stats.use-case';
import { GetDashboardOverviewUseCase } from '../application/use-cases/get-dashboard-overview.use-case';
import { AdminDashboardStatsResponseDto } from '../application/dtos/admin-dashboard-stats-response.dto';
import { AdminDashboardOverviewResponseDto } from '../application/dtos/admin-dashboard-overview-response.dto';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminAuthGuard)
@Controller({ path: 'admin/dashboard', version: ['1', VERSION_NEUTRAL] })
export class AdminDashboardController {
  constructor(
    private readonly getDashboardStatsUseCase: GetDashboardStatsUseCase,
    private readonly getDashboardOverviewUseCase: GetDashboardOverviewUseCase,
  ) {}

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get dashboard overview KPI metrics',
    description:
      'Retrieves the 4 core summary counters: total platform users, online users, unverified pending selfies, and unanswered support tickets.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard stats retrieved successfully',
    type: AdminDashboardStatsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async getStats(): Promise<AdminDashboardStatsResponseDto> {
    const stats = await this.getDashboardStatsUseCase.execute();
    return {
      status: 'success',
      message: 'Dashboard stats retrieved',
      data: stats,
    };
  }

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get comprehensive dashboard overview data',
    description:
      'Retrieves complete dashboard overview payload: stats (KPIs), 7-day weeklyActivity with Persian day names and solar dates, genderStats distribution, recentTickets, and recentSelfies awaiting verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview data retrieved successfully',
    type: AdminDashboardOverviewResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async getOverview(): Promise<AdminDashboardOverviewResponseDto> {
    const overview = await this.getDashboardOverviewUseCase.execute();
    return {
      status: 'success',
      message: 'Dashboard overview data retrieved successfully',
      data: overview,
      error: null,
    };
  }
}

