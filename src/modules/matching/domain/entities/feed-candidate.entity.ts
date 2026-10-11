export interface FeedCandidateEntity {
  id: number;
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
}
