import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { ApproveVerificationResult } from '../../domain/entities/admin-verification-item.entity';

@Injectable()
export class ApproveVerificationUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(targetId: number): Promise<ApproveVerificationResult> {
    return this.adminRepository.approveVerification(targetId);
  }
}
