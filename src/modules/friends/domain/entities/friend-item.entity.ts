import { FriendRequestStatus } from '../enums/friend-request-status.enum';

export interface FriendItemEntity {
  id: number;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
}
