import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';
import { TerminateDeviceResult } from '../../domain/entities/admin-user-item.entity';

@Injectable()
export class TerminateUserDeviceUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(
    userId: number,
    deviceId: number,
  ): Promise<TerminateDeviceResult> {
    return this.adminRepository.terminateUserDevice(userId, deviceId);
  }
}
