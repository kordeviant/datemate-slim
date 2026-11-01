import { FriendRequestStatus } from '../enums/friend-request-status.enum';
import { FriendRequestEntity } from '../entities/friend-request.entity';
import { FriendItemEntity } from '../entities/friend-item.entity';

export const FRIEND_REPOSITORY = 'FRIEND_REPOSITORY';

export interface IFriendRepository {
  findUserById(
    userId: number,
  ): Promise<{ id: number; isBanned: boolean; fullName?: string } | null>;
  createRequest(senderId: number, receiverId: number): Promise<FriendRequestEntity>;
  findRequestById(id: number): Promise<FriendRequestEntity | null>;
  findRequestBetweenUsers(userAId: number, userBId: number): Promise<FriendRequestEntity | null>;
  updateRequestStatus(id: number, status: FriendRequestStatus): Promise<FriendRequestEntity>;
  getReceivedRequests(
    userId: number,
    options: { page: number; limit: number; status?: FriendRequestStatus },
  ): Promise<{ items: FriendRequestEntity[]; total: number }>;
  getSentRequests(
    userId: number,
    options: { page: number; limit: number; status?: FriendRequestStatus },
  ): Promise<{ items: FriendRequestEntity[]; total: number }>;
  getFriends(
    userId: number,
    options: { page: number; limit: number; search?: string },
  ): Promise<{ items: FriendItemEntity[]; total: number }>;
  deleteFriendship(userAId: number, targetId: number): Promise<boolean>;
  createFriendRequestNotification(receiverId: number, senderId: number): Promise<void>;
}
