import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IUserSessionRepository,
  USER_SESSION_REPOSITORY,
} from '../../domain/repositories/user-session.repository.interface';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { PasswordHasherService } from '../services/password-hasher.service';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_SESSION_REPOSITORY)
    private readonly sessionRepository: IUserSessionRepository,
    private readonly redisService: RedisService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<{ message: string }> {
    const email = await this.redisService.get(`reset:code:${dto.code}`);
    if (!email || email !== dto.email.toLowerCase().trim()) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const newHash = await this.passwordHasher.hash(dto.password);
    await this.userRepository.updatePassword(user.id, newHash);

    // Invalidate all active sessions for security
    await this.sessionRepository.deleteAllForUser(user.id);
    await this.redisService.del(`reset:code:${dto.code}`);

    return { message: 'Password reset successfully' };
  }
}
