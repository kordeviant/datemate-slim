import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GoogleAuthDto } from '../dtos/google-auth.dto';
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
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

@Injectable()
export class GoogleAuthUseCase {
  private readonly googleClient = new OAuth2Client();

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    googleIdToken: string,
    dto: GoogleAuthDto,
  ): Promise<AuthValidateResultModel> {
    let email: string;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleIdToken,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload');
      }
      email = payload.email.toLowerCase().trim();
    } catch {
      // In development / testing environment fallback
      throw new UnauthorizedException('Google ID Token verification failed');
    }

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
