import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  IUserSessionRepository,
  USER_SESSION_REPOSITORY,
} from '../../domain/repositories/user-session.repository.interface';
import { TokenService } from '../services/token.service';
import { TerminateAllClientDevicesDataDto } from '../dtos/user-devices.dto';

@Injectable()
export class TerminateAllClientDevicesUseCase {
  constructor(
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    userId: number,
    excludeCurrent: boolean = false,
    currentRefreshToken?: string,
  ): Promise<TerminateAllClientDevicesDataDto> {
    if (excludeCurrent) {
      if (!currentRefreshToken || !currentRefreshToken.trim()) {
        throw new BadRequestException(
          'Current refresh token is required to exclude current device (pass via x-refresh-token header or refreshToken query/body)',
        );
      }

      const hash = this.tokenService.hashRefreshToken(
        currentRefreshToken.trim(),
      );
      const count = await this.sessionRepository.deleteAllForUserExcept(
        userId,
        hash,
      );

      return {
        terminatedCount: count,
        excludedCurrent: true,
      };
    }

    const count = await this.sessionRepository.deleteAllForUser(userId);

    return {
      terminatedCount: count,
      excludedCurrent: false,
    };
  }
}
