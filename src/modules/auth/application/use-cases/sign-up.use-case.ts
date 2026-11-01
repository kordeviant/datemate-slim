import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SignUpDto } from '../dtos/sign-up.dto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import {
  IMailService,
  MAIL_SERVICE,
} from '../../../../infrastructure/mail/mail.service.interface';
import { PasswordHasherService } from '../services/password-hasher.service';

@Injectable()
export class SignUpUseCase {
  private readonly logger = new Logger(SignUpUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(MAIL_SERVICE)
    private readonly mailService: IMailService,
    private readonly redisService: RedisService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async execute(dto: SignUpDto): Promise<{ message: string }> {
    const normalizedEmail = (dto.email || '').toLowerCase().trim();
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await this.passwordHasher.hash(dto.password);

    // Save pending verification to Redis (TTL 10 minutes)
    const pendingData = JSON.stringify({
      email: normalizedEmail,
      passwordHash,
      code: otpCode,
    });

    await this.redisService.set(`signup:pending:${normalizedEmail}`, pendingData, 600);
    await this.redisService.set(`signup:code:${otpCode}`, normalizedEmail, 600);

    this.logger.log(`[OTP DISPATCH] Verification code for ${normalizedEmail} is: ${otpCode}`);

    // Send email asynchronously in background so SMTP delays never cause Cloudflare 524 timeouts
    Promise.resolve(this.mailService.sendVerificationOtp(normalizedEmail, otpCode)).catch(
      (err) => {
        this.logger.error(
          `Failed to send verification email to ${normalizedEmail}`,
          err,
        );
      },
    );

    return { message: 'Verification code sent to email' };
  }
}
