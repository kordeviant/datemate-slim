import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardStatsDataDto {
  @ApiProperty({ description: 'Total registered platform users', example: 6570 })
  totalUsers: number;

  @ApiProperty({ description: 'Users currently marked as online', example: 369 })
  onlineUsers: number;

  @ApiProperty({ description: 'Selfies awaiting administrative verification', example: 7 })
  pendingSelfies: number;

  @ApiProperty({ description: 'Support tickets awaiting response', example: 7 })
  unansweredTickets: number;
}

export class AdminDashboardStatsResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Dashboard stats retrieved' })
  message: string;

  @ApiProperty({ type: AdminDashboardStatsDataDto })
  data: AdminDashboardStatsDataDto;
}
