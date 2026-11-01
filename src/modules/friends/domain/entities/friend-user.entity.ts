export interface FriendUserEntity {
  id: number;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  city: string | null;
  isOnline: boolean;
}
