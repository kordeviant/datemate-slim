import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { AdminUserDetails } from '../../domain/entities/admin-user-details.entity';

@Injectable()
export class GetAdminUserDetailsUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(userId: number): Promise<AdminUserDetails> {
    return this.adminRepository.getUserDetails(userId);
  }
}
