import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';
import { ADMIN_REPOSITORY } from './domain/repositories/admin.repository.interface';
import { PrismaAdminRepository } from './infrastructure/repositories/prisma-admin.repository';
import { AdminAuthGuard } from './application/guards/admin-auth.guard';
import { GetDashboardStatsUseCase } from './application/use-cases/get-dashboard-stats.use-case';
import { GetDashboardOverviewUseCase } from './application/use-cases/get-dashboard-overview.use-case';
import { GetAdminUsersUseCase } from './application/use-cases/get-admin-users.use-case';
import { GetAdminUserDetailsUseCase } from './application/use-cases/get-admin-user-details.use-case';
import { UpdateAdminUserUseCase } from './application/use-cases/update-admin-user.use-case';
import { BanUserUseCase } from './application/use-cases/ban-user.use-case';
import { UnbanUserUseCase } from './application/use-cases/unban-user.use-case';
import { GetPendingVerificationsUseCase } from './application/use-cases/get-pending-verifications.use-case';
import { ApproveVerificationUseCase } from './application/use-cases/approve-verification.use-case';
import { RejectVerificationUseCase } from './application/use-cases/reject-verification.use-case';
import { AdminDashboardController } from './presentation/admin-dashboard.controller';
import { AdminUsersController } from './presentation/admin-users.controller';
import { AdminVerificationsController } from './presentation/admin-verifications.controller';

@Module({
  imports: [PrismaModule, MediaModule, AuthModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminVerificationsController,
  ],
  providers: [
    AdminAuthGuard,
    // Repositories (DIP)
    {
      provide: ADMIN_REPOSITORY,
      useClass: PrismaAdminRepository,
    },
    // Use Cases
    GetDashboardStatsUseCase,
    GetDashboardOverviewUseCase,
    GetAdminUsersUseCase,
    GetAdminUserDetailsUseCase,
    UpdateAdminUserUseCase,
    BanUserUseCase,
    UnbanUserUseCase,
    GetPendingVerificationsUseCase,
    ApproveVerificationUseCase,
    RejectVerificationUseCase,
  ],
  exports: [
    ADMIN_REPOSITORY,
    GetDashboardStatsUseCase,
    GetDashboardOverviewUseCase,
    GetAdminUsersUseCase,
    GetAdminUserDetailsUseCase,
    UpdateAdminUserUseCase,
    BanUserUseCase,
    UnbanUserUseCase,
    GetPendingVerificationsUseCase,
    ApproveVerificationUseCase,
    RejectVerificationUseCase,
  ],
})
export class AdminModule {}
