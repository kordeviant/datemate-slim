import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { SignUpUseCase } from "../application/use-cases/sign-up.use-case";
import { VerifyCodeUseCase } from "../application/use-cases/verify-code.use-case";
import { SignInUseCase } from "../application/use-cases/sign-in.use-case";
import { RefreshTokenUseCase } from "../application/use-cases/refresh-token.use-case";
import { ForgotPasswordUseCase } from "../application/use-cases/forgot-password.use-case";
import { ResetPasswordUseCase } from "../application/use-cases/reset-password.use-case";
import { GoogleAuthUseCase } from "../application/use-cases/google-auth.use-case";
import { AppleAuthUseCase } from "../application/use-cases/apple-auth.use-case";
import { LogoutUseCase } from "../application/use-cases/logout.use-case";
import { TokenService } from "../application/services/token.service";
import { SignUpDto } from "../application/dtos/sign-up.dto";
import { ValidateCodeDto } from "../application/dtos/validate-code.dto";
import { SignInDto } from "../application/dtos/sign-in.dto";
import { RefreshTokenDto } from "../application/dtos/refresh-token.dto";
import { ForgotPasswordDto } from "../application/dtos/forgot-password.dto";
import { ResetPasswordDto } from "../application/dtos/reset-password.dto";
import { GoogleAuthDto } from "../application/dtos/google-auth.dto";
import { AppleAuthDto } from "../application/dtos/apple-auth.dto";
import { LogoutDto, LogoutResponseDto } from "../application/dtos/logout.dto";
import { AuthValidateResultModel } from "../application/dtos/auth-response.dto";
import * as crypto from "crypto";

@ApiTags("Authentication")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly signUpUseCase: SignUpUseCase,
    private readonly verifyCodeUseCase: VerifyCodeUseCase,
    private readonly signInUseCase: SignInUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly googleAuthUseCase: GoogleAuthUseCase,
    private readonly appleAuthUseCase: AppleAuthUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("signup")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Initiate user registration",
    description:
      "Validates email & password, generates a 6-digit OTP, stores it in Redis (10m TTL), and sends a verification email via Nodemailer.",
  })
  @ApiResponse({
    status: 200,
    description: "Verification code sent to email successfully",
    schema: {
      example: {
        status: "success",
        message: "Verification code sent to email",
        data: null,
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: "Email already registered",
    schema: {
      example: {
        status: "error",
        message: "Email already registered",
        data: null,
        error: { type: "UNKNOWN_ERROR", message: "Email already registered" },
      },
    },
  })
  async signUp(@Body() dto: SignUpDto): Promise<void> {
    await this.signUpUseCase.execute(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify OTP code and create user account",
    description:
      "Verifies the 6-digit OTP code, creates user in PostgreSQL, initiates session, and returns JWT access + refresh tokens.",
  })
  @ApiResponse({
    status: 200,
    description: "User verified successfully",
    type: AuthValidateResultModel,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired verification code",
  })
  async verifyCode(
    @Body() dto: ValidateCodeDto,
  ): Promise<AuthValidateResultModel> {
    return this.verifyCodeUseCase.execute(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("signin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sign in with email and password",
    description:
      "Authenticates credentials, verifies ban status, creates a new session, and returns JWT access and refresh tokens.",
  })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: AuthValidateResultModel,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials or user banned",
  })
  async signIn(@Body() dto: SignInDto): Promise<AuthValidateResultModel> {
    return this.signInUseCase.execute(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Refresh expired JWT access token",
    description:
      "Validates the refresh token, deletes the used token (token rotation), and issues a new access/refresh pair.",
  })
  @ApiResponse({
    status: 200,
    description: "Tokens refreshed successfully",
    type: AuthValidateResultModel,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or expired refresh token",
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<AuthValidateResultModel> {
    return this.refreshTokenUseCase.execute(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Request password reset code",
    description:
      "Generates a 6-digit reset code in Redis and dispatches it via email to the user.",
  })
  @ApiResponse({
    status: 200,
    description: "Reset code sent if email exists",
    schema: {
      example: {
        status: "success",
        message: "If the email exists, a reset code was sent",
        data: null,
        error: null,
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.forgotPasswordUseCase.execute(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset account password with code",
    description:
      "Verifies the 6-digit code, updates user password hash, and revokes all active sessions for security.",
  })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
    schema: {
      example: {
        status: "success",
        message: "Password reset successfully",
        data: null,
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired reset code",
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.resetPasswordUseCase.execute(dto);
  }

  @Post("nonce")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get Google Play Integrity nonce",
    description:
      "Returns a cryptographically secure random nonce string for Google Play Integrity verification.",
  })
  @ApiResponse({
    status: 200,
    description: "Nonce string generated",
    schema: {
      example: {
        status: "success",
        message: "Operation successful",
        data: "a1b2c3d4e5f6...",
        error: null,
      },
    },
  })
  async getNonce(): Promise<string> {
    return crypto.randomBytes(32).toString("hex");
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sign in or register with Google OAuth",
    description:
      "Verifies the Google OAuth ID Token in the Authorization header, creates or retrieves user, and returns JWT tokens.",
  })
  @ApiHeader({
    name: "Authorization",
    description: "Google ID Token (Bearer <token>)",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Google authentication successful",
    type: AuthValidateResultModel,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or missing Google ID Token",
  })
  async googleAuth(
    @Headers("authorization") authHeader: string,
    @Body() dto: GoogleAuthDto,
  ): Promise<AuthValidateResultModel> {
    if (!authHeader) {
      throw new UnauthorizedException("Authorization header is required");
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");
    return this.googleAuthUseCase.execute(token, dto);
  }

  @Post("apple")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sign in or register with Apple OAuth",
    description:
      "Verifies the Apple Sign-In Identity Token in the Authorization header (or body), creates or retrieves user, and returns JWT tokens.",
  })
  @ApiHeader({
    name: "Authorization",
    description: "Apple Identity Token (Bearer <token>)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Apple authentication successful",
    type: AuthValidateResultModel,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or missing Apple Identity Token",
  })
  async appleAuth(
    @Headers("authorization") authHeader: string,
    @Body() dto: AppleAuthDto,
  ): Promise<AuthValidateResultModel> {
    const token = authHeader
      ? authHeader.replace(/^Bearer\s+/i, "")
      : dto.identityToken;

    if (!token) {
      throw new UnauthorizedException(
        "Apple Identity Token is required in Authorization header or request body",
      );
    }

    return this.appleAuthUseCase.execute(token, dto);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Logout user device session",
    description:
      "Terminates the user's active device session using the refreshToken in the body. The Authorization: Bearer <accessToken> header is used for authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "User logged out successfully",
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Missing or invalid refreshToken",
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  async logout(
    @Body() dto: LogoutDto,
    @Headers("authorization") authHeader?: string,
  ): Promise<LogoutResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    await this.tokenService.verifyAccessToken(token);

    const result = await this.logoutUseCase.execute(dto);

    return {
      status: "success",
      message: "Logged out successfully",
      data: result,
    };
  }
}

