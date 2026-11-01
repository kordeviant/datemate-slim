import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SignInDto } from '../dtos/sign-in.dto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IUserSessionRepository,
  USER_SESSION_REPOSITORY,
} from '../../domain/repositories/user-session.repository.interface';
import { PasswordHasherService } from '../services/password-hasher.service';
import { TokenService } from '../services/token.service';
import { AuthValidateResultModel } from '../dtos/auth-response.dto';
import { UserEntity } from '../../domain/user.entity';

@Injectable()
export class SignInUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: SignInDto): Promise<AuthValidateResultModel> {
    const rawIdentifier =
      dto.username ||
      dto.email ||
      dto.usernameOrEmail ||
      (dto as any).login ||
      (dto as any).identifier ||
      '';

    if (typeof rawIdentifier !== 'string' || !rawIdentifier.trim()) {
      throw new BadRequestException('Username or email is required');
    }
    const identifier = rawIdentifier.trim();

    let user: UserEntity | null = null;
    if (typeof this.userRepository.findByEmailOrUsername === 'function') {
      user = await this.userRepository.findByEmailOrUsername(identifier);
    }

    if (!user) {
      if (identifier.includes('@')) {
        user = await this.userRepository.findByEmail(identifier);
      } else if (typeof this.userRepository.findByUsername === 'function') {
        user = await this.userRepository.findByUsername(identifier);
      } else {
        user = await this.userRepository.findByEmail(identifier);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid email, username, or password');
    }

    const isPasswordValid = await this.passwordHasher.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email, username, or password');
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new UnauthorizedException('User is currently banned');
    }

    const refreshObj = this.tokenService.generateRefreshToken({ sub: user.id });

    // Save session first to obtain session ID
    const deviceInfo =
      dto.device && dto.userAgent
        ? `${dto.device} (${dto.userAgent})`
        : dto.device || dto.userAgent || 'Web Browser';

    const session = await this.sessionRepository.createSession({
      userId: user.id,
      refreshTokenHash: refreshObj.hash,
      deviceInfo,
      fcmToken: dto.fcmToken,
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
      role: user.role,
    };
  }
}
