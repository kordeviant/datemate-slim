import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SignUpUseCase } from '../application/use-cases/sign-up.use-case';
import { VerifyCodeUseCase } from '../application/use-cases/verify-code.use-case';
import { SignInUseCase } from '../application/use-cases/sign-in.use-case';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { ForgotPasswordUseCase } from '../application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../application/use-cases/reset-password.use-case';
import { GoogleAuthUseCase } from '../application/use-cases/google-auth.use-case';
import { AppleAuthUseCase } from '../application/use-cases/apple-auth.use-case';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAppleAuthUseCase: any;
  let mockGoogleAuthUseCase: any;

  beforeEach(async () => {
    mockAppleAuthUseCase = {
      execute: jest.fn(),
    };
    mockGoogleAuthUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: SignUpUseCase, useValue: {} },
        { provide: VerifyCodeUseCase, useValue: {} },
        { provide: SignInUseCase, useValue: {} },
        { provide: RefreshTokenUseCase, useValue: {} },
        { provide: ForgotPasswordUseCase, useValue: {} },
        { provide: ResetPasswordUseCase, useValue: {} },
        { provide: GoogleAuthUseCase, useValue: mockGoogleAuthUseCase },
        { provide: AppleAuthUseCase, useValue: mockAppleAuthUseCase },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/apple', () => {
    it('should throw UnauthorizedException if no token is provided in header or body', async () => {
      await expect(
        controller.appleAuth('', {
          device: 'iPhone 15 Pro',
          userAgent: 'DateMate/2.6',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should extract token from Authorization header and call use case', async () => {
      const mockResult = {
        access: 'token_acc',
        refresh: 'token_ref',
        userId: 1,
      };
      mockAppleAuthUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.appleAuth('Bearer header_token_123', {
        device: 'iPhone 15 Pro',
        userAgent: 'DateMate/2.6',
      });

      expect(mockAppleAuthUseCase.execute).toHaveBeenCalledWith(
        'header_token_123',
        expect.objectContaining({ device: 'iPhone 15 Pro' }),
      );
      expect(result).toEqual(mockResult);
    });

    it('should fallback to identityToken in body if Authorization header is missing', async () => {
      const mockResult = {
        access: 'token_acc',
        refresh: 'token_ref',
        userId: 2,
      };
      mockAppleAuthUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.appleAuth(undefined as any, {
        device: 'iPad Pro',
        userAgent: 'DateMate/2.6',
        identityToken: 'body_token_456',
      });

      expect(mockAppleAuthUseCase.execute).toHaveBeenCalledWith(
        'body_token_456',
        expect.objectContaining({ identityToken: 'body_token_456' }),
      );
      expect(result).toEqual(mockResult);
    });
  });
});
