import { AdminDashboardStats } from './admin-dashboard-stats.entity';

export interface AdminWeeklyActivityItem {
  dayName: string;
  hours: number;
  dateStr: string;
  isPeak: boolean;
}

export interface AdminGenderStats {
  maleCount: number;
  femaleCount: number;
  malePercentage: number;
  femalePercentage: number;
}

export interface AdminRecentTicketItem {
  id: number;
  code: string;
  userName: string;
  avatar: string;
  dateTime: string;
  time: string;
  unreadCount: number;
  status: string;
}

export interface AdminRecentSelfieItem {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  avatar: string | null;
  selfieUrl: string | null;
  createdAt: string;
}

export interface AdminDashboardOverviewData {
  stats: AdminDashboardStats;
  weeklyActivity: AdminWeeklyActivityItem[];
  genderStats: AdminGenderStats;
  recentTickets: AdminRecentTicketItem[];
  recentSelfies: AdminRecentSelfieItem[];
}
