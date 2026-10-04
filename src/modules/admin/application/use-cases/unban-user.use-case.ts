import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  BanUserResult,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

@Injectable()
export class UnbanUserUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(userId: number): Promise<BanUserResult> {
    return this.adminRepository.unbanUser(userId);
  }
}
