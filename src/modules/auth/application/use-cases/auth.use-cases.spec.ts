import { Test, TestingModule } from '@nestjs/testing';
import { SignUpUseCase } from '../use-cases/sign-up.use-case';
import { SignInUseCase } from '../use-cases/sign-in.use-case';
import { VerifyCodeUseCase } from '../use-cases/verify-code.use-case';
import { ForgotPasswordUseCase } from '../use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../use-cases/reset-password.use-case';
import { AppleAuthUseCase } from '../use-cases/apple-auth.use-case';
import { AppleAuthService } from '../services/apple-auth.service';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { USER_SESSION_REPOSITORY } from '../../domain/repositories/user-session.repository.interface';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { PasswordHasherService } from '../services/password-hasher.service';
import { TokenService } from '../services/token.service';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserEntity } from '../../domain/user.entity';

describe('Auth Use Cases', () => {
  let signUpUseCase: SignUpUseCase;
  let signInUseCase: SignInUseCase;
  let verifyCodeUseCase: VerifyCodeUseCase;
  let mockUserRepo: any;
  let mockSessionRepo: any;
  let mockRedisService: any;
  let passwordHasher: PasswordHasherService;
  let tokenService: TokenService;

  beforeEach(async () => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findByEmailOrUsername: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updatePassword: jest.fn(),
      hasCompletedProfile: jest.fn(),
    };

    mockSessionRepo = {
      createSession: jest.fn(),
      findByTokenHash: jest.fn(),
      deleteByTokenHash: jest.fn(),
      deleteAllForUser: jest.fn(),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockMailService = {
      sendVerificationOtp: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignUpUseCase,
        SignInUseCase,
        VerifyCodeUseCase,
        PasswordHasherService,
        {
          provide: TokenService,
          useValue: {
            generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
            generateRefreshToken: jest.fn().mockReturnValue({
              token: 'mock_refresh_token',
              hash: 'mock_hash',
              expiresAt: new Date(),
            }),
            hashRefreshToken: jest.fn().mockReturnValue('mock_hash'),
            verifyAccessToken: jest.fn().mockReturnValue({ sub: 1 }),
          },
        },
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: USER_SESSION_REPOSITORY, useValue: mockSessionRepo },
        { provide: RedisService, useValue: mockRedisService },
        {
          provide: require('../../../../infrastructure/mail/mail.service.interface').MAIL_SERVICE,
          useValue: mockMailService,
        },
      ],
    }).compile();

    signUpUseCase = module.get<SignUpUseCase>(SignUpUseCase);
    signInUseCase = module.get<SignInUseCase>(SignInUseCase);
    verifyCodeUseCase = module.get<VerifyCodeUseCase>(VerifyCodeUseCase);
    passwordHasher = module.get<PasswordHasherService>(PasswordHasherService);
    tokenService = module.get<TokenService>(TokenService);
  });

  describe('SignUpUseCase', () => {
    it('should throw ConflictException if email is already registered', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(new UserEntity({ id: 1, email: 'test@example.com' }));

      await expect(
        signUpUseCase.execute({
          email: 'test@example.com',
          password: 'password123',
          integrityToken: 'token',
          packageName: 'com.dmate.datemate',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should normalize email and reject if already registered (case-insensitive & trimmed)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(new UserEntity({ id: 1, email: 'test@example.com' }));

      await expect(
        signUpUseCase.execute({
          email: '  TEST@EXAMPLE.COM  ',
          password: 'password123',
          integrityToken: 'token',
          packageName: 'com.dmate.datemate',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should generate OTP and save to redis if email is new', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      const result = await signUpUseCase.execute({
        email: 'new@example.com',
        password: 'password123',
        integrityToken: 'token',
        packageName: 'com.dmate.datemate',
      });

      expect(result.message).toBe('Verification code sent to email');
      expect(mockRedisService.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('VerifyCodeUseCase', () => {
    it('should throw ConflictException if email is already registered during verification', async () => {
      mockRedisService.get.mockImplementation(async (key: string) => {
        if (key === 'signup:code:123456') return 'existing@example.com';
        if (key === 'signup:pending:existing@example.com') {
          return JSON.stringify({
            email: 'existing@example.com',
            passwordHash: 'hash',
            code: '123456',
          });
        }
        return null;
      });
      mockUserRepo.findByEmail.mockResolvedValue(new UserEntity({ id: 1, email: 'existing@example.com' }));

      await expect(
        verifyCodeUseCase.execute({
          code: '123456',
          device: 'Pixel 8',
          userAgent: 'Android',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockRedisService.del).toHaveBeenCalledWith('signup:code:123456');
      expect(mockRedisService.del).toHaveBeenCalledWith('signup:pending:existing@example.com');
    });

    it('should successfully create user and return tokens when code is valid and email is unique', async () => {
      mockRedisService.get.mockImplementation(async (key: string) => {
        if (key === 'signup:code:123456') return 'newuser@example.com';
        if (key === 'signup:pending:newuser@example.com') {
          return JSON.stringify({
            email: 'newuser@example.com',
            passwordHash: 'hash',
            code: '123456',
          });
        }
        return null;
      });
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(new UserEntity({ id: 2, email: 'newuser@example.com', role: 'USER' }));
      mockSessionRepo.createSession.mockResolvedValue({});

      const result = await verifyCodeUseCase.execute({
        code: '123456',
        device: 'Pixel 8',
        userAgent: 'Android',
      });

      expect(result.userId).toBe(2);
      expect(result.access).toBe('mock_access_token');
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        passwordHash: 'hash',
      });
    });
  });

  describe('SignInUseCase', () => {
    it('should throw BadRequestException if neither username nor email is provided', async () => {
      await expect(
        signInUseCase.execute({
          password: 'password123',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepo.findByEmailOrUsername.mockResolvedValue(null);
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        signInUseCase.execute({
          email: 'notfound@example.com',
          password: 'wrongpassword',
          device: 'Pixel 8',
          userAgent: 'Android',
          integrityToken: 'token',
          packageName: 'com.dmate.datemate',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const passwordHash = await passwordHasher.hash('correctpassword');
      mockUserRepo.findByEmailOrUsername.mockResolvedValue(
        new UserEntity({
          id: 101,
          email: 'user@example.com',
          passwordHash,
          role: 'USER',
        }),
      );

      await expect(
        signInUseCase.execute({
          email: 'user@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is currently banned', async () => {
      const passwordHash = await passwordHasher.hash('correctpassword');
      mockUserRepo.findByEmailOrUsername.mockResolvedValue(
        new UserEntity({
          id: 101,
          email: 'user@example.com',
          passwordHash,
          role: 'USER',
          bannedUntil: new Date(Date.now() + 1000 * 60 * 60), // Banned for 1 hour
        }),
      );

      await expect(
        signInUseCase.execute({
          email: 'user@example.com',
          password: 'correctpassword',
        }),
      ).rejects.toThrow('User is currently banned');
    });

    it('should return tokens and role if credentials are valid with email', async () => {
      const passwordHash = await passwordHasher.hash('correctpassword');
      mockUserRepo.findByEmailOrUsername.mockResolvedValue(
        new UserEntity({
          id: 101,
          email: 'user@example.com',
          passwordHash,
          role: 'USER',
        }),
      );
      mockSessionRepo.createSession.mockResolvedValue({});

      const result = await signInUseCase.execute({
        email: 'user@example.com',
        password: 'correctpassword',
        device: 'Pixel 8',
        userAgent: 'Android',
        integrityToken: 'token',
        packageName: 'com.dmate.datemate',
      });

      expect(result.userId).toBe(101);
      expect(result.access).toBe('mock_access_token');
      expect(result.refresh).toBe('mock_refresh_token');
      expect(result.role).toBe('USER');
      expect(mockSessionRepo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 101,
          deviceInfo: 'Pixel 8 (Android)',
        }),
      );
    });

    it('should successfully sign in admin using username and default deviceInfo to Web Browser', async () => {
      const passwordHash = await passwordHasher.hash('Password123!');
      mockUserRepo.findByEmailOrUsername.mockResolvedValue(
        new UserEntity({
          id: 1,
          email: 'admin@datemate.com',
          passwordHash,
          role: 'ADMIN',
        }),
      );
      mockSessionRepo.createSession.mockResolvedValue({});

      const result = await signInUseCase.execute({
        username: 'admin',
        password: 'Password123!',
      });

      expect(result.userId).toBe(1);
      expect(result.access).toBe('mock_access_token');
      expect(result.refresh).toBe('mock_refresh_token');
      expect(result.role).toBe('ADMIN');
      expect(mockSessionRepo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          deviceInfo: 'Web Browser',
        }),
      );
    });

    it('should successfully sign in using usernameOrEmail alias', async () => {
      const passwordHash = await passwordHasher.hash('Password123!');
      mockUserRepo.findByEmailOrUsername.mockResolvedValue(
        new UserEntity({
          id: 1,
          email: 'admin@datemate.com',
          passwordHash,
          role: 'ADMIN',
        }),
      );
      mockSessionRepo.createSession.mockResolvedValue({});

      const result = await signInUseCase.execute({
        usernameOrEmail: 'admin',
        password: 'Password123!',
      });

      expect(result.userId).toBe(1);
      expect(result.role).toBe('ADMIN');
    });
  });

  describe('ForgotPasswordUseCase & ResetPasswordUseCase (TTL & Expiration)', () => {
    let forgotPasswordUseCase: ForgotPasswordUseCase;
    let resetPasswordUseCase: ResetPasswordUseCase;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ForgotPasswordUseCase,
          ResetPasswordUseCase,
          PasswordHasherService,
          { provide: USER_REPOSITORY, useValue: mockUserRepo },
          { provide: USER_SESSION_REPOSITORY, useValue: mockSessionRepo },
          { provide: RedisService, useValue: mockRedisService },
          {
            provide: require('../../../../infrastructure/mail/mail.service.interface').MAIL_SERVICE,
            useValue: { sendPasswordResetOtp: jest.fn() },
          },
        ],
      }).compile();

      forgotPasswordUseCase = module.get<ForgotPasswordUseCase>(ForgotPasswordUseCase);
      resetPasswordUseCase = module.get<ResetPasswordUseCase>(ResetPasswordUseCase);
    });

    it('ForgotPasswordUseCase should save reset code in Redis with 600s TTL', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(new UserEntity({ id: 1, email: 'user@example.com' }));
      mockRedisService.set.mockResolvedValue('OK');

      const result = await forgotPasswordUseCase.execute({ email: 'user@example.com' });

      expect(result.message).toBe('If the email exists, a reset code was sent');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^reset:code:\d{6}$/),
        'user@example.com',
        600, // 600 seconds TTL
      );
    });

    it('ResetPasswordUseCase should reject with BadRequestException if code is expired (TTL ended in Redis)', async () => {
      // Simulate expired TTL: Redis returns null
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        resetPasswordUseCase.execute({
          email: 'user@example.com',
          code: '764016',
          password: 'NewPassword123!',
        }),
      ).rejects.toThrow('Invalid or expired reset code');
    });

    it('ResetPasswordUseCase should succeed if code is valid and not expired', async () => {
      mockRedisService.get.mockResolvedValue('user@example.com');
      mockUserRepo.findByEmail.mockResolvedValue(new UserEntity({ id: 1, email: 'user@example.com' }));
      mockUserRepo.updatePassword.mockResolvedValue(undefined);
      mockSessionRepo.deleteAllForUser.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(1);

      const result = await resetPasswordUseCase.execute({
        email: 'user@example.com',
        code: '764016',
        password: 'NewPassword123!',
      });

      expect(result.message).toBe('Password reset successfully');
      expect(mockUserRepo.updatePassword).toHaveBeenCalled();
      expect(mockSessionRepo.deleteAllForUser).toHaveBeenCalledWith(1);
      expect(mockRedisService.del).toHaveBeenCalledWith('reset:code:764016');
    });
  });

  describe('AppleAuthUseCase', () => {
    let appleAuthUseCase: AppleAuthUseCase;
    let mockAppleAuthService: any;

    beforeEach(async () => {
      mockAppleAuthService = {
        verifyIdToken: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AppleAuthUseCase,
          {
            provide: TokenService,
            useValue: {
              generateAccessToken: jest.fn().mockReturnValue('mock_apple_access_token'),
              generateRefreshToken: jest.fn().mockReturnValue({
                token: 'mock_apple_refresh_token',
                hash: 'mock_apple_hash',
                expiresAt: new Date(Date.now() + 30 * 86400000),
              }),
            },
          },
          { provide: USER_REPOSITORY, useValue: mockUserRepo },
          { provide: USER_SESSION_REPOSITORY, useValue: mockSessionRepo },
          { provide: AppleAuthService, useValue: mockAppleAuthService },
        ],
      }).compile();

      appleAuthUseCase = module.get<AppleAuthUseCase>(AppleAuthUseCase);
    });

    it('should throw UnauthorizedException if Apple token verification fails', async () => {
      mockAppleAuthService.verifyIdToken.mockRejectedValue(
        new UnauthorizedException('Apple ID Token verification failed'),
      );

      await expect(
        appleAuthUseCase.execute('invalid_token', {
          device: 'iPhone 15 Pro',
          userAgent: 'DateMate/2.6 (iOS 17)',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token payload is missing email', async () => {
      mockAppleAuthService.verifyIdToken.mockResolvedValue({
        sub: 'apple.user.12345',
        // no email in payload
      });

      await expect(
        appleAuthUseCase.execute('valid_token_without_email', {
          device: 'iPhone 15 Pro',
          userAgent: 'DateMate/2.6 (iOS 17)',
        }),
      ).rejects.toThrow('Invalid Apple token payload: email is required');
    });

    it('should register a new user and return tokens when user does not exist', async () => {
      mockAppleAuthService.verifyIdToken.mockResolvedValue({
        sub: 'apple.user.67890',
        email: 'newuser@privaterelay.appleid.com',
      });
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(
        new UserEntity({
          id: 201,
          email: 'newuser@privaterelay.appleid.com',
          role: 'USER',
        }),
      );
      mockSessionRepo.createSession.mockResolvedValue({});

      const result = await appleAuthUseCase.execute('apple_id_token_123', {
        device: 'iPhone 15 Pro',
        userAgent: 'DateMate/2.6 (iOS 17.5)',
        bundleId: 'com.dmate.datemate',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(mockAppleAuthService.verifyIdToken).toHaveBeenCalledWith(
        'apple_id_token_123',
        'com.dmate.datemate',
      );
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(
        'newuser@privaterelay.appleid.com',
      );
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        email: 'newuser@privaterelay.appleid.com',
        passwordHash: expect.any(String),
      });
      expect(mockSessionRepo.createSession).toHaveBeenCalledWith({
        userId: 201,
        refreshTokenHash: 'mock_apple_hash',
        deviceInfo: 'iPhone 15 Pro (DateMate/2.6 (iOS 17.5))',
        expiresAt: expect.any(Date),
      });
      expect(result).toEqual({
        access: 'mock_apple_access_token',
        refresh: 'mock_apple_refresh_token',
        userId: 201,
      });
    });

    it('should authenticate existing user without creating a new user record', async () => {
      mockAppleAuthService.verifyIdToken.mockResolvedValue({
        sub: 'apple.user.99999',
        email: 'existing@icloud.com',
      });
      mockUserRepo.findByEmail.mockResolvedValue(
        new UserEntity({
          id: 55,
          email: 'existing@icloud.com',
          role: 'USER',
        }),
      );
      mockSessionRepo.createSession.mockResolvedValue({});

      const result = await appleAuthUseCase.execute('apple_id_token_valid', {
        device: 'iPad Pro',
        userAgent: 'DateMate/2.6 (iPadOS 17.5)',
      });

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('existing@icloud.com');
      expect(mockUserRepo.create).not.toHaveBeenCalled();
      expect(mockSessionRepo.createSession).toHaveBeenCalledWith({
        userId: 55,
        refreshTokenHash: 'mock_apple_hash',
        deviceInfo: 'iPad Pro (DateMate/2.6 (iPadOS 17.5))',
        expiresAt: expect.any(Date),
      });
      expect(result.userId).toBe(55);
      expect(result.access).toBe('mock_apple_access_token');
      expect(result.refresh).toBe('mock_apple_refresh_token');
    });
  });
});

