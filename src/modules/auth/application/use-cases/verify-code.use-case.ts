import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ValidateCodeDto } from '../dtos/validate-code.dto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IUserSessionRepository,
  USER_SESSION_REPOSITORY,
} from '../../domain/repositories/user-session.repository.interface';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { TokenService } from '../services/token.service';
import { AuthValidateResultModel } from '../dtos/auth-response.dto';

@Injectable()
export class VerifyCodeUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly redisService: RedisService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: ValidateCodeDto): Promise<AuthValidateResultModel> {
    const email = await this.redisService.get(`signup:code:${dto.code}`);
    if (!email) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const pendingDataRaw = await this.redisService.get(`signup:pending:${email}`);
    if (!pendingDataRaw) {
      throw new BadRequestException('Registration session expired');
    }

    const pendingData = JSON.parse(pendingDataRaw);
    const normalizedEmail = (pendingData.email || email).toLowerCase().trim();

    // Check if user with this email already exists
    const existing = await this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      await this.redisService.del(`signup:code:${dto.code}`);
      await this.redisService.del(`signup:pending:${email}`);
      throw new ConflictException('Email already registered');
    }

    // Create user in database
    const user = await this.userRepository.create({
      email: normalizedEmail,
      passwordHash: pendingData.passwordHash,
    });

    // Cleanup Redis OTP keys
    await this.redisService.del(`signup:code:${dto.code}`);
    await this.redisService.del(`signup:pending:${email}`);

    const refreshObj = this.tokenService.generateRefreshToken({ sub: user.id });

    // Save refresh session first to obtain session ID
    const session = await this.sessionRepository.createSession({
      userId: user.id,
      refreshTokenHash: refreshObj.hash,
      deviceInfo: `${dto.device} (${dto.userAgent})`,
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
    };
  }
}
