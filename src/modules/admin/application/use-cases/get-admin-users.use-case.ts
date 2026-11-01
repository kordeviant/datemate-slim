import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  GetAdminUsersParams,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { AdminUsersPaginatedResult } from '../../domain/entities/admin-user-item.entity';

@Injectable()
export class GetAdminUsersUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(params: GetAdminUsersParams): Promise<AdminUsersPaginatedResult> {
    return this.adminRepository.getUsers(params);
  }
}
