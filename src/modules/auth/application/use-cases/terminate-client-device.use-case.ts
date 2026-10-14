import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IUserSessionRepository,
  USER_SESSION_REPOSITORY,
} from '../../domain/repositories/user-session.repository.interface';
import { TerminateClientDeviceDataDto } from '../dtos/user-devices.dto';

@Injectable()
export class TerminateClientDeviceUseCase {
  constructor(
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
  ) {}

  async execute(
    userId: number,
    deviceId: number,
  ): Promise<TerminateClientDeviceDataDto> {
    const deleted = await this.sessionRepository.deleteSessionById(
      deviceId,
      userId,
    );

    if (!deleted) {
      throw new NotFoundException('Device session not found');
    }

    return {
      deviceId,
      terminated: true,
    };
  }
}
