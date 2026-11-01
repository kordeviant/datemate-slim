export interface AdminVerificationItem {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  selfieUrl: string | null;
  age: number | null;
  gender: string | null;
  requestedAt: string;
  status: string;
  createdAt: string;
}

export interface AdminVerificationsPaginatedResult {
  data: AdminVerificationItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ApproveVerificationResult {
  id: number;
  userId?: number;
  status: string;
  verifiedAt: string;
}

export interface RejectVerificationResult {
  id: number;
  userId?: number;
  status: string;
  reason: string;
  rejectedAt: string;
}
