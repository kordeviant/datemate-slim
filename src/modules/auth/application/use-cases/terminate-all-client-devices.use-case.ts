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
    currentSessionId?: number,
  ): Promise<TerminateAllClientDevicesDataDto> {
    if (excludeCurrent) {
      const trimmedToken = currentRefreshToken?.trim();
      if (!trimmedToken && !currentSessionId) {
        throw new BadRequestException(
          'refreshToken is required in the request body to exclude the current device',
        );
      }

      let count = 0;
      if (trimmedToken) {
        const hash = this.tokenService.hashRefreshToken(trimmedToken);
        count = await this.sessionRepository.deleteAllForUserExcept(
          userId,
          hash,
        );
      } else if (currentSessionId) {
        count = await this.sessionRepository.deleteAllForUserExcept(
          userId,
          undefined,
          currentSessionId,
        );
      }

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
