export interface UserRecommendationProfile {
  id: number;
  gender: 'MALE' | 'FEMALE';
  birthDate: Date | null;
  cityId: number | null;
  cityName: string | null;
  relationPreference: string | null;
  answerIds: number[];
  interestIds: number[];
  interestNames: string[];
  bannedUntil: Date | null;
}

export interface CandidatePoolItem {
  id: number;
  fullName: string | null;
  username: string | null;
  gender: string | null;
  birthDate: Date | null;
  bio: string | null;
  avatarUrl: string | null;
  profilePictureUrl: string | null;
  profileValidated: boolean;
  cityId: number | null;
  cityName: string | null;
  relationPreference: string | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  gallery: { id: number; imageUrl: string; isProfilePicture: boolean }[];
  interestNames: string[];
  interestIds: number[];
  answerIds: number[];
}

export interface IRecommendedRepository {
  getUserProfile(userId: number): Promise<UserRecommendationProfile | null>;
  getSwipedUserIds(userId: number): Promise<number[]>;
  getCandidatePool(
    targetGender: 'MALE' | 'FEMALE',
    excludedUserIds: number[],
    fetchLimit: number,
  ): Promise<CandidatePoolItem[]>;
}

export const RECOMMENDED_REPOSITORY = Symbol('RECOMMENDED_REPOSITORY');
