import { FeedCandidateEntity } from '../entities/feed-candidate.entity';
import { LikeReceivedEntity } from '../entities/like-received.entity';

export const MATCHING_REPOSITORY = Symbol('MATCHING_REPOSITORY');

export interface IMatchingRepository {
  findCandidateProfiles(
    userId: number,
    targetGender: 'MALE' | 'FEMALE',
    limit: number,
  ): Promise<FeedCandidateEntity[]>;

  recordSwipe(
    fromUserId: number,
    toUserId: number,
    direction: 'RIGHT' | 'LEFT',
  ): Promise<void>;

  getUserDemographicGender(userId: number): Promise<'MALE' | 'FEMALE' | null>;

  findLikesReceived(userId: number): Promise<LikeReceivedEntity[]>;

  findTargetUserStatus(
    userId: number,
  ): Promise<{ exists: boolean; isBanned: boolean }>;

  getUserFullName(userId: number): Promise<string | null>;
}
