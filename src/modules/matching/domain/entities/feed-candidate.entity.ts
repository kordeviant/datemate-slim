export interface FeedCandidateEntity {
  id: number;
  firstName: string | null;
  fullName: string | null;
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
}
