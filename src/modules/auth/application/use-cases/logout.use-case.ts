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

  async execute(dto: LogoutDto): Promise<{ loggedOut: boolean }> {
    if (
      !dto?.refreshToken ||
      typeof dto.refreshToken !== 'string' ||
      !dto.refreshToken.trim()
    ) {
      throw new BadRequestException('refreshToken is required to log out');
    }

    const hash = this.tokenService.hashRefreshToken(dto.refreshToken.trim());
    await this.sessionRepository.deleteByTokenHash(hash);

    return { loggedOut: true };
  }
}
