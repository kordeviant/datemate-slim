import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  JwtService,
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
} from "@nestjs/jwt";
import * as crypto from "crypto";

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(payload: { sub: number; email: string; role: string }): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_ACCESS_SECRET", "access_secret"),
      expiresIn: this.configService.get<string>("JWT_ACCESS_EXPIRES_IN", "15m"),
    });
  }

  generateRefreshToken(payload: { sub: number }): { token: string; hash: string; expiresAt: Date } {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    return {
      token: rawToken,
      hash,
      expiresAt,
    };
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  verifyAccessToken(token: string): any {
    if (!token || typeof token !== "string" || !token.trim()) {
      this.logger.warn(`verifyAccessToken received empty token`);
      throw new UnauthorizedException("Invalid access token");
    }
    const cleanToken = token.trim();
    try {
      return this.jwtService.verify(cleanToken, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET", "access_secret"),
      });
    } catch (error: any) {
      const preview =
        cleanToken.length > 20
          ? `${cleanToken.slice(0, 10)}...${cleanToken.slice(-6)} (len: ${cleanToken.length})`
          : `"${cleanToken}"`;
      this.logger.warn(
        `verifyAccessToken failed for token ${preview}: [${error?.name}] ${error?.message}`,
      );
      if (
        error instanceof TokenExpiredError ||
        error?.name === "TokenExpiredError"
      ) {
        throw new UnauthorizedException("Access token has expired");
      }
      if (
        error instanceof JsonWebTokenError ||
        error instanceof NotBeforeError ||
        error?.name === "JsonWebTokenError" ||
        error?.name === "NotBeforeError"
      ) {
        throw new UnauthorizedException("Invalid access token");
      }
      throw error;
    }
  }
}
