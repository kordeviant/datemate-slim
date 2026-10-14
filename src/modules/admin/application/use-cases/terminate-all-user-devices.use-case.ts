import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

@Injectable()
export class TerminateAllUserDevicesUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    userId: number,
  ): Promise<{ userId: number; terminated: boolean; count: number }> {
    return this.adminRepository.terminateAllUserDevices(userId);
  }
}
