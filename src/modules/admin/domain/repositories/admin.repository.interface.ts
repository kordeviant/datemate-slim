import { AdminDashboardStats } from '../entities/admin-dashboard-stats.entity';
import { AdminDashboardOverviewData } from '../entities/admin-dashboard-overview.entity';
import { AdminUserDetails } from '../entities/admin-user-details.entity';
import {
  AdminGenderFilterType,
  AdminSortOrderType,
  AdminUserItem,
  AdminUsersPaginatedResult,
  AdminUserSortByType,
  AdminUserStatusFilterType,
  DeleteUserGalleryItemResult,
} from '../entities/admin-user-item.entity';
import {
  AdminVerificationsPaginatedResult,
  ApproveVerificationResult,
  RejectVerificationResult,
} from '../entities/admin-verification-item.entity';

export interface GetAdminUsersParams {
  page: number;
  limit: number;
  search?: string;
  status?: AdminUserStatusFilterType;
  gender?: AdminGenderFilterType;
  minAge?: number;
  maxAge?: number;
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
  getUserDetails(userId: number): Promise<AdminUserDetails>;
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
    status?: string,
  ): Promise<AdminVerificationsPaginatedResult>;
  approveVerification(
    targetId: number,
  ): Promise<ApproveVerificationResult>;
  rejectVerification(
    targetId: number,
    reason?: string,
  ): Promise<RejectVerificationResult>;
  deleteUserGalleryItem(
    userId: number,
    galleryId: number,
  ): Promise<DeleteUserGalleryItemResult>;
}

export const ADMIN_REPOSITORY = Symbol('IAdminRepository');
