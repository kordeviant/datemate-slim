export interface RecommendedCandidateEntity {
  id: number;
  firstName: string | null;
  fullName: string | null;
  username: string | null;
  age: number | null;
  gender: string | null;
  bio: string | null;
  avatarUrl: string | null;
  profileValidated: boolean;
  gallery: string[];
  interests: string[];
  city: string | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  compatibilityScore: number;
  sharedInterests: string[];
  sharedAnswersCount: number;
  sameCity: boolean;
  sameRelationGoal: boolean;
}
