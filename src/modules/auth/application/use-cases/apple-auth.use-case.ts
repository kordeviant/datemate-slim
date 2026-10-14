import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AppleAuthDto } from '../dtos/apple-auth.dto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IUserSessionRepository,
  USER_SESSION_REPOSITORY,
} from '../../domain/repositories/user-session.repository.interface';
import { TokenService } from '../services/token.service';
import { AppleAuthService } from '../services/apple-auth.service';
import { AuthValidateResultModel } from '../dtos/auth-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class AppleAuthUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly tokenService: TokenService,
    private readonly appleAuthService: AppleAuthService,
  ) {}

  async execute(
    appleIdToken: string,
    dto: AppleAuthDto,
  ): Promise<AuthValidateResultModel> {
    const payload = await this.appleAuthService.verifyIdToken(
      appleIdToken,
      dto.bundleId,
    );

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid Apple token payload: email is required');
    }

    const email = payload.email.toLowerCase().trim();

    let user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Create user with random password hash
      const randomPassword = crypto.randomBytes(16).toString('hex');
      user = await this.userRepository.create({
        email,
        passwordHash: randomPassword,
      });
    }

    const refreshObj = this.tokenService.generateRefreshToken({ sub: user.id });

    // Save session first to obtain session ID
    const session = await this.sessionRepository.createSession({
      userId: user.id,
      refreshTokenHash: refreshObj.hash,
      deviceInfo: `${dto.device} (${dto.userAgent})`,
      expiresAt: refreshObj.expiresAt,
    });

    // Generate tokens with sessionId embedded
    const access = this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session?.id,
    });

    return {
      access,
      refresh: refreshObj.token,
      userId: user.id,
    };
  }
}
