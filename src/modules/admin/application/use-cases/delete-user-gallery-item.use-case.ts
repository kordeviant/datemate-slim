import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { DeleteUserGalleryItemResult } from '../../domain/entities/admin-user-item.entity';

@Injectable()
export class DeleteUserGalleryItemUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    userId: number,
    galleryId: number,
  ): Promise<DeleteUserGalleryItemResult> {
    return this.adminRepository.deleteUserGalleryItem(userId, galleryId);
  }
}
