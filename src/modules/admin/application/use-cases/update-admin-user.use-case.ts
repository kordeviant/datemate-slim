import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
  UpdateAdminUserParams,
} from '../../domain/repositories/admin.repository.interface';
import { AdminUserItem } from '../../domain/entities/admin-user-item.entity';

@Injectable()
export class UpdateAdminUserUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    userId: number,
    params: UpdateAdminUserParams,
  ): Promise<AdminUserItem> {
    return this.adminRepository.updateUser(userId, params);
  }
}
