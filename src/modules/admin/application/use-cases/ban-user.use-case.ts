import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  BanUserResult,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

@Injectable()
export class BanUserUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    userId: number,
    durationHours?: number | null,
    reason?: string,
  ): Promise<BanUserResult> {
    return this.adminRepository.banUser(userId, durationHours, reason);
  }
}
