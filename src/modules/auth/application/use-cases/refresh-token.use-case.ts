import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IUserSessionRepository,
  USER_SESSION_REPOSITORY,
} from '../../domain/repositories/user-session.repository.interface';
import { TokenService } from '../services/token.service';
import { AuthValidateResultModel } from '../dtos/auth-response.dto';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: RefreshTokenDto): Promise<AuthValidateResultModel> {
    const tokenHash = this.tokenService.hashRefreshToken(dto.token);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.sessionRepository.deleteByTokenHash(tokenHash);
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Delete used refresh token (Rotation)
    await this.sessionRepository.deleteByTokenHash(tokenHash);

    const newRefreshObj = this.tokenService.generateRefreshToken({ sub: user.id });

    // Save new session first to obtain session ID
    const newSession = await this.sessionRepository.createSession({
      userId: user.id,
      refreshTokenHash: newRefreshObj.hash,
      deviceInfo: session.deviceInfo || undefined,
      fcmToken: session.fcmToken || undefined,
      expiresAt: newRefreshObj.expiresAt,
    });

    // Issue new tokens with new session ID embedded
    const access = this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: newSession?.id,
    });

    return {
      access,
      refresh: newRefreshObj.token,
      userId: user.id,
    };
  }
}
