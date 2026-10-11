import { Inject, Injectable } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';

@Injectable()
export class DeleteGalleryImageUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    userId: number,
    galleryId: number,
  ): Promise<{ userId: number; galleryId: number; deleted: boolean }> {
    return this.userRepository.deleteGalleryItem(userId, galleryId);
  }
}
