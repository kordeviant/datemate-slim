import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import {
  IMailService,
  MAIL_SERVICE,
} from '../../../../infrastructure/mail/mail.service.interface';

@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(MAIL_SERVICE)
    private readonly mailService: IMailService,
    private readonly redisService: RedisService,
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      // Return success to avoid email enumeration
      return { message: 'If the email exists, a reset code was sent' };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redisService.set(`reset:code:${resetCode}`, user.email.toLowerCase().trim(), 600);

    this.logger.log(`[PASSWORD RESET] Reset code for ${dto.email} is: ${resetCode}`);

    // Send email asynchronously in background so SMTP delays never cause Cloudflare 524 timeouts
    Promise.resolve(
      this.mailService.sendPasswordResetOtp(user.email, resetCode),
    ).catch((err) => {
      this.logger.error(
        `Failed to send password reset email to ${user.email}`,
        err,
      );
    });

    return { message: 'If the email exists, a reset code was sent' };
  }
}
