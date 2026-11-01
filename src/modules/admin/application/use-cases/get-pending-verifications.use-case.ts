import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { AdminVerificationsPaginatedResult } from '../../domain/entities/admin-verification-item.entity';

@Injectable()
export class GetPendingVerificationsUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<AdminVerificationsPaginatedResult> {
    return this.adminRepository.getPendingVerifications(page, limit, status);
  }
}
