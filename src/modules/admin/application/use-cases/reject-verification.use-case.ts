import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { RejectVerificationResult } from '../../domain/entities/admin-verification-item.entity';

@Injectable()
export class RejectVerificationUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    targetId: number,
    reason: string,
  ): Promise<RejectVerificationResult> {
    return this.adminRepository.rejectVerification(targetId, reason);
  }
}
