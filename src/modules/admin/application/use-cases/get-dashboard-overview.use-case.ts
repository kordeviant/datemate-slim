import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { AdminDashboardOverviewData } from '../../domain/entities/admin-dashboard-overview.entity';

@Injectable()
export class GetDashboardOverviewUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(): Promise<AdminDashboardOverviewData> {
    return this.adminRepository.getDashboardOverview();
  }
}
