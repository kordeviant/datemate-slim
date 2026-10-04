import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminDashboardStatsDataDto } from './admin-dashboard-stats-response.dto';

export class AdminWeeklyActivityItemDto {
  @ApiProperty({ description: 'Day abbreviation (e.g. ش, ی, د, س, چ, پ, ج)', example: 'ش' })
  dayName: string;

  @ApiProperty({ description: 'Activity hours or interactions count', example: 210 })
  hours: number;

  @ApiProperty({ description: 'Persian solar date string (e.g. ۱۰ اسفند)', example: '۱۰ اسفند' })
  dateStr: string;

  @ApiProperty({ description: 'Whether this day represents peak platform activity', example: true })
  isPeak: boolean;
}

export class AdminGenderStatsDto {
  @ApiProperty({ description: 'Total male user count', example: 2694 })
  maleCount: number;

  @ApiProperty({ description: 'Total female user count', example: 3876 })
  femaleCount: number;

  @ApiProperty({ description: 'Male percentage representation', example: 41 })
  malePercentage: number;

  @ApiProperty({ description: 'Female percentage representation', example: 59 })
  femalePercentage: number;
}

export class AdminRecentTicketDto {
  @ApiProperty({ description: 'Ticket ID', example: 101 })
  id: number;

  @ApiProperty({ description: 'Ticket tracking code', example: '۲۳۴۶' })
  code: string;

  @ApiProperty({ description: 'User full name', example: 'سکینه عالیخانی' })
  userName: string;

  @ApiProperty({ description: 'User avatar image URL', example: '/uploads/avatars/user1.webp' })
  avatar: string;

  @ApiProperty({ description: 'Date and time of ticket creation', example: '۱۴۰۳/۰۹/۱۲ - ۱۳:۲۳' })
  dateTime: string;

  @ApiProperty({ description: 'Time of last activity', example: '۱۴:۲۰' })
  time: string;

  @ApiProperty({ description: 'Count of unread messages in ticket', example: 3 })
  unreadCount: number;

  @ApiProperty({ description: 'Ticket resolution status', example: 'PENDING' })
  status: string;
}

export class AdminRecentSelfieDto {
  @ApiProperty({ description: 'Sequence index or record ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'User ID awaiting selfie verification', example: 45 })
  userId: number;

  @ApiProperty({ description: 'User full name', example: 'چی چانگ' })
  fullName: string;

  @ApiProperty({ description: 'User email address', example: 'chichang@gmail.com' })
  email: string;

  @ApiPropertyOptional({ description: 'User avatar image URL', example: '/uploads/avatars/avatar45.webp', nullable: true })
  avatar: string | null;

  @ApiPropertyOptional({ description: 'User verification selfie image URL', example: '/uploads/selfies/selfie45.webp', nullable: true })
  selfieUrl: string | null;

  @ApiProperty({ description: 'Selfie upload / registration timestamp', example: '2026-03-03T11:20:00.000Z' })
  createdAt: string;
}

export class AdminDashboardOverviewDataDto {
  @ApiProperty({ type: AdminDashboardStatsDataDto, description: 'KPI counters summary' })
  stats: AdminDashboardStatsDataDto;

  @ApiProperty({ type: [AdminWeeklyActivityItemDto], description: '7-day weekly activity progression' })
  weeklyActivity: AdminWeeklyActivityItemDto[];

  @ApiProperty({ type: AdminGenderStatsDto, description: 'Platform gender distribution statistics' })
  genderStats: AdminGenderStatsDto;

  @ApiProperty({ type: [AdminRecentTicketDto], description: 'Recent user support tickets' })
  recentTickets: AdminRecentTicketDto[];

  @ApiProperty({ type: [AdminRecentSelfieDto], description: 'Recently submitted verification selfies' })
  recentSelfies: AdminRecentSelfieDto[];
}

export class AdminDashboardOverviewResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Dashboard overview data retrieved successfully' })
  message: string;

  @ApiProperty({ type: AdminDashboardOverviewDataDto })
  data: AdminDashboardOverviewDataDto;

  @ApiPropertyOptional({ example: null, nullable: true })
  error?: any | null;
}
