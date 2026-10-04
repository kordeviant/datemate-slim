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
import { AdminDashboardStatsResponseDto } from '../application/dtos/admin-dashboard-stats-response.dto';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminAuthGuard)
@Controller({ path: 'admin/dashboard', version: ['1', VERSION_NEUTRAL] })
export class AdminDashboardController {
  constructor(
    private readonly getDashboardStatsUseCase: GetDashboardStatsUseCase,
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
    summary: 'Get dashboard overview KPI metrics',
    description:
      'Compatibility alias for the dashboard stats endpoint. Returns total platform users, online users, unverified pending selfies, and unanswered support tickets.',
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
  async getOverview(): Promise<AdminDashboardStatsResponseDto> {
    return this.getStats();
  }
}
