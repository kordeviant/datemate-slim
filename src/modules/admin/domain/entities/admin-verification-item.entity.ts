export interface AdminVerificationItem {
  userId: number;
  fullName: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
  selfieUrl: string | null;
  gender: string | null;
  age: number | null;
  city: string | null;
  submittedAt: string;
  createdAt: string;
}

export interface AdminVerificationsPaginatedResult {
  items: AdminVerificationItem[];
  total: number;
  page: number;
  totalPages: number;
}
