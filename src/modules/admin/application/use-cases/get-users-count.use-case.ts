import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_REPOSITORY,
  IAdminRepository,
} from '../../domain/repositories/admin.repository.interface';

@Injectable()
export class GetUsersCountUseCase {
  constructor(
    @Inject(ADMIN_REPOSITORY)
    private readonly adminRepository: IAdminRepository,
  ) {}

  async execute(status?: string): Promise<{ count: number }> {
    const count = await this.adminRepository.getUsersCount(status);
    return { count };
  }
}
