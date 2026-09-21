import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './presentation/auth.controller';
import { UsersController } from './presentation/users.controller';
import { SignUpUseCase } from './application/use-cases/sign-up.use-case';
import { VerifyCodeUseCase } from './application/use-cases/verify-code.use-case';
import { SignInUseCase } from './application/use-cases/sign-in.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { GoogleAuthUseCase } from './application/use-cases/google-auth.use-case';
import { AppleAuthUseCase } from './application/use-cases/apple-auth.use-case';
import { PasswordHasherService } from './application/services/password-hasher.service';
import { TokenService } from './application/services/token.service';
import { AppleAuthService } from './application/services/apple-auth.service';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { USER_SESSION_REPOSITORY } from './domain/repositories/user-session.repository.interface';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { PrismaUserSessionRepository } from './infrastructure/repositories/prisma-user-session.repository';

@Module({
  imports: [
    JwtModule.register({}),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    // Repositories (DIP)
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: USER_SESSION_REPOSITORY,
      useClass: PrismaUserSessionRepository,
    },
    // Services
    PasswordHasherService,
    TokenService,
    AppleAuthService,
    // Use Cases
    SignUpUseCase,
    VerifyCodeUseCase,
    SignInUseCase,
    RefreshTokenUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    GoogleAuthUseCase,
    AppleAuthUseCase,
  ],
  exports: [USER_REPOSITORY, USER_SESSION_REPOSITORY, TokenService],
})
export class AuthModule {}
