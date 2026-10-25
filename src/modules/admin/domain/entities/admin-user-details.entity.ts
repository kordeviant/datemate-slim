export interface AdminUserDemographicDetails {
  birthDate: string | null;
  gender: string | null;
  age: number | null;
  cityName: string | null;
  job: string | null;
  degree: string | null;
  height: number | null;
  weight: number | null;
  religion: string | null;
  relationStatus: string | null;
}

export interface AdminUserGalleryItemDetails {
  id: number;
  url: string;
  likesCount: number;
  createdAt: string;
}

export interface AdminUserTransactionDetails {
  id: number;
  title: string;
  amount: number;
  planName: string;
  date: string;
  bank: string;
  cardNumber: string;
  status: string;
}

export interface AdminUserChatRoomDetails {
  id: number;
  title: string;
  memberCount: number;
  imageUrl: string;
}

export interface AdminUserDeviceDetails {
  id: number;
  deviceInfo: string;
  fcmToken: string | null;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface AdminUserLikeDetails {
  id: number;
  userId: number;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  city?: string | null;
  type: string;
  createdAt: string;
}

export interface AdminUserDetails {
  id: number;
  email: string;
  role: string;
  language: string;
  fullName: string;
  username: string | null;
  phoneNumber: string | null;
  bio: string | null;
  city?: string | null;
  gender?: string | null;
  age?: number | null;
  avatarUrl: string | null;
  selfieUrl: string | null;
  profileValidated: boolean;
  hasPendingSelfie: boolean;
  bannedUntil: string | null;
  wallet: number;
  score: number;
  notificationsOn: boolean;
  isPrivate: boolean;
  isOnline: boolean;
  isPremium: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  demographic: AdminUserDemographicDetails;
  gallery: AdminUserGalleryItemDetails[];
  transactions: AdminUserTransactionDetails[];
  chatRooms: AdminUserChatRoomDetails[];
  devices: AdminUserDeviceDetails[];
  likes: AdminUserLikeDetails[];
  interests: string[];
}

