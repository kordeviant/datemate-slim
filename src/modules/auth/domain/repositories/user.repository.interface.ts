import { UserEntity } from '../user.entity';

export interface IUserRepository {
  findById(id: number): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByUsername?(username: string): Promise<UserEntity | null>;
  findByEmailOrUsername?(identifier: string): Promise<UserEntity | null>;
  create(data: {
    email: string;
    passwordHash: string;
    role?: 'USER' | 'ADMIN';
    language?: 'EN' | 'FA';
  }): Promise<UserEntity>;
  updatePassword(userId: number, passwordHash: string): Promise<void>;
  hasCompletedProfile(userId: number): Promise<boolean>;
  deleteUser(userId: number): Promise<{ userId: number; deleted: boolean }>;
  deleteGalleryItem(
    userId: number,
    galleryId: number,
  ): Promise<{ userId: number; galleryId: number; deleted: boolean }>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');

