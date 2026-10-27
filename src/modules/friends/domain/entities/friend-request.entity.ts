import { FriendRequestStatus } from '../enums/friend-request-status.enum';
import { FriendUserEntity } from './friend-user.entity';

export interface FriendRequestEntity {
  id: number;
  senderId: number;
  receiverId: number;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  sender?: FriendUserEntity;
  receiver?: FriendUserEntity;
}
