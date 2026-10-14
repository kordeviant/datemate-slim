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
  TerminateDeviceResult,
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
  gender?: string;
  avatarUrl?: string;
  username?: string | null;
  phoneNumber?: string | null;
  birthDate?: string;
  age?: number;
  height?: number;
  weight?: number;
  degree?: string | null;
  job?: string | null;
  relationStatus?: string | null;
  religion?: string | null;
  city?: string | null;
  profile?: any;
  demographic?: any;
  preferences?: any;
  personality?: any;
  Answers?: any;
  answers?: any;
  LikedActivities?: any;
  likedActivities?: any;
  interests?: any;
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
  terminateUserDevice(
    userId: number,
    deviceId: number,
  ): Promise<TerminateDeviceResult>;
  terminateAllUserDevices(
    userId: number,
  ): Promise<{ userId: number; terminated: boolean; count: number }>;
  deleteUser(
    userId: number,
  ): Promise<{ userId: number; deleted: boolean }>;
  getUsersCount(status?: string): Promise<number>;
  getPendingSelfiesCount(): Promise<number>;
}

export const ADMIN_REPOSITORY = Symbol('IAdminRepository');

