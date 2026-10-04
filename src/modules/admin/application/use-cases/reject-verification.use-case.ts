import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

@Injectable()
export class RejectVerificationUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    userId: number,
    reason?: string,
  ): Promise<{ userId: number; profileValidated: boolean; reason: string | null }> {
    return this.adminRepository.rejectVerification(userId, reason);
  }
}
