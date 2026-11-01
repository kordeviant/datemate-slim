import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

@Injectable()
export class DeleteAdminUserUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    userId: number,
  ): Promise<{ userId: number; deleted: boolean }> {
    if (typeof userId !== 'number' || isNaN(userId) || userId <= 0) {
      throw new BadRequestException('A valid single user ID is required');
    }

    return this.adminRepository.deleteUser(userId);
  }
}
