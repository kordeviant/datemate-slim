export interface FeedCandidateGalleryItem {
  id?: number;
  imageUrl: string;
  isProfilePicture: boolean;
}

export interface FeedCandidateEntity {
  id: number;
  fullName: string | null;
  city: string | null;
  age: number | null;
  avatarUrl: string | null;
  username: string | null;
  gallery?: FeedCandidateGalleryItem[];
}

