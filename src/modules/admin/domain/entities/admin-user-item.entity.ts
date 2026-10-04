export type AdminUserStatusFilterType =
  | 'ALL'
  | 'BLOCKED'
  | 'PENDING_VERIFICATION'
  | 'COMPLETED';

export type AdminGenderFilterType = 'MALE' | 'FEMALE' | 'ALL';

export type AdminUserSortByType = 'createdAt' | 'lastSeenAt' | 'wallet';

export type AdminSortOrderType = 'asc' | 'desc';

export interface AdminUserItem {
  id: number;
  email: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  isPremium: boolean;
  profileValidated: boolean;
  isBanned: boolean;
  bannedUntil: string | null;
  gender: string | null;
  age: number | null;
  city: string | null;
  registrationCompleted: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface AdminUsersPaginatedResult {
  items: AdminUserItem[];
  total: number;
  page: number;
  totalPages: number;
}
