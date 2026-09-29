import { InterestCategoryEntity } from '../interest.entity';

export interface CreateInterestCategoryData {
  enName: string;
  faName: string;
  icon?: string;
  iconAlt?: string;
  interests: Array<{
    enName: string;
    faName: string;
    icon?: string;
    iconAlt?: string;
  }>;
}

export interface IInterestRepository {
  findAllCategories(): Promise<InterestCategoryEntity[]>;
  findCategoryById(id: number): Promise<InterestCategoryEntity | null>;
  createCategory(data: CreateInterestCategoryData): Promise<InterestCategoryEntity>;
  countCategories(): Promise<number>;
}

export const INTEREST_REPOSITORY = Symbol('IInterestRepository');
