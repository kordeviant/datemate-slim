import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { AdminDashboardStats } from '../../domain/entities/admin-dashboard-stats.entity';

@Injectable()
export class GetDashboardStatsUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(): Promise<AdminDashboardStats> {
    return this.adminRepository.getDashboardStats();
  }
}
