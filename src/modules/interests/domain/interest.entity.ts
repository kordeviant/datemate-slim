export interface InterestEntity {
  id: number;
  categoryId: number;
  enName: string;
  faName: string;
  icon?: string | null;
  iconAlt?: string | null;
}

export interface InterestCategoryEntity {
  id: number;
  enName: string;
  faName: string;
  icon?: string | null;
  iconAlt?: string | null;
  interests: InterestEntity[];
}
