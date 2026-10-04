import { AdminDashboardStats } from '../entities/admin-dashboard-stats.entity';
import { AdminDashboardOverviewData } from '../entities/admin-dashboard-overview.entity';
import {
  AdminGenderFilterType,
  AdminSortOrderType,
  AdminUserItem,
  AdminUsersPaginatedResult,
  AdminUserSortByType,
  AdminUserStatusFilterType,
} from '../entities/admin-user-item.entity';
import { AdminVerificationsPaginatedResult } from '../entities/admin-verification-item.entity';

export interface GetAdminUsersParams {
  page: number;
  limit: number;
  search?: string;
  status?: AdminUserStatusFilterType;
  gender?: AdminGenderFilterType;
  sortBy?: AdminUserSortByType;
  order?: AdminSortOrderType;
}

export interface BanUserResult {
  id: number;
  email: string;
  isBanned: boolean;
  bannedUntil: string | null;
  reason?: string | null;
}

export interface UpdateAdminUserParams {
  confirmSelfie?: boolean;
  selfieVerified?: boolean;
  profileValidated?: boolean;
  bio?: string | null;
  fullName?: string;
  isPremium?: boolean;
  wallet?: number;
}

export interface IAdminRepository {
  getDashboardStats(): Promise<AdminDashboardStats>;
  getDashboardOverview(): Promise<AdminDashboardOverviewData>;
  getUsers(params: GetAdminUsersParams): Promise<AdminUsersPaginatedResult>;
  updateUser(
    userId: number,
    params: UpdateAdminUserParams,
  ): Promise<AdminUserItem>;
  banUser(
    userId: number,
    durationHours?: number | null,
    reason?: string,
  ): Promise<BanUserResult>;
  unbanUser(userId: number): Promise<BanUserResult>;
  getPendingVerifications(
    page: number,
    limit: number,
  ): Promise<AdminVerificationsPaginatedResult>;
  approveVerification(
    userId: number,
  ): Promise<{ userId: number; profileValidated: boolean }>;
  rejectVerification(
    userId: number,
    reason?: string,
  ): Promise<{ userId: number; profileValidated: boolean; reason: string | null }>;
}

export const ADMIN_REPOSITORY = Symbol('IAdminRepository');
