import { AdminDashboardStats } from '../entities/admin-dashboard-stats.entity';
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

export interface IAdminRepository {
  getDashboardStats(): Promise<AdminDashboardStats>;
  getUsers(params: GetAdminUsersParams): Promise<AdminUsersPaginatedResult>;
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
