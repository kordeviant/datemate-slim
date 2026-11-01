export type AdminUserStatusFilterType =
  | 'ALL'
  | 'BLOCKED'
  | 'PENDING_VERIFICATION'
  | 'COMPLETED';

export type AdminGenderFilterType = 'MALE' | 'FEMALE' | 'ALL';

export type AdminUserSortByType = 'createdAt' | 'lastSeenAt' | 'wallet';

export type AdminSortOrderType = 'asc' | 'desc';

export interface AdminUserGalleryItem {
  id: number;
  url: string;
  description: string | null;
  likesCount: number;
  isProfilePicture: boolean;
  createdAt?: string;
}

export interface AdminUserItem {
  id: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  age: number | null;
  gender: string | null;
  isPremium: boolean;
  hasPendingSelfie: boolean;
  profileValidated: boolean;
  isOnline: boolean;
  bannedUntil: string | null;
  createdAt: string;
  city?: string | null;
  username?: string | null;
  bio?: string | null;
  selfieVerified?: boolean;
  isBanned?: boolean;
  registrationCompleted?: boolean;
  lastSeenAt?: string | null;
  gallery?: AdminUserGalleryItem[];
}

export interface AdminUsersPaginatedResult {
  items: AdminUserItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DeleteUserGalleryItemResult {
  userId: number;
  galleryId: number;
  deleted: boolean;
}

export interface TerminateDeviceResult {
  userId: number;
  deviceId: number;
  terminated: boolean;
}


