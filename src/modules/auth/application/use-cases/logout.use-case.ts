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
import { LogoutDto } from '../dtos/logout.dto';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    dto?: LogoutDto,
    authenticatedUserId?: number,
  ): Promise<{ loggedOut: boolean }> {
    const rawToken = dto?.refreshToken || dto?.token;
    const allDevices = Boolean(dto?.allDevices);

    if (rawToken && typeof rawToken === 'string' && rawToken.trim()) {
      const hash = this.tokenService.hashRefreshToken(rawToken.trim());
      const session = await this.sessionRepository.findByTokenHash(hash);

      if (allDevices) {
        const targetUserId = session?.userId || authenticatedUserId;
        if (targetUserId) {
          await this.sessionRepository.deleteAllForUser(targetUserId);
        } else {
          await this.sessionRepository.deleteByTokenHash(hash);
        }
      } else {
        await this.sessionRepository.deleteByTokenHash(hash);
      }

      return { loggedOut: true };
    }

    if (authenticatedUserId) {
      await this.sessionRepository.deleteAllForUser(authenticatedUserId);
      return { loggedOut: true };
    }

    throw new BadRequestException(
      'Either refreshToken or a valid Authorization header is required to log out',
    );
  }
}
