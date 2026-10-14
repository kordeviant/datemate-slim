import { Injectable, Logger, Optional, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  JwtService,
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
} from "@nestjs/jwt";
import * as crypto from "crypto";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  generateAccessToken(payload: {
    sub: number;
    email: string;
    role: string;
    sessionId?: number;
  }): string {
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

  decodeAccessToken(token: string): any {
    if (!token || typeof token !== "string" || !token.trim()) {
      throw new UnauthorizedException("Invalid access token");
    }
    const cleanToken = token.trim();
    try {
      return this.jwtService.verify(cleanToken, {
        secret: this.configService.get<string>(
          "JWT_ACCESS_SECRET",
          "access_secret",
        ),
      });
    } catch (error: any) {
      if (
        error instanceof TokenExpiredError ||
        error?.name === "TokenExpiredError"
      ) {
        throw new UnauthorizedException("Access token has expired");
      }
      throw new UnauthorizedException("Invalid access token");
    }
  }

  async verifyAccessToken(token: string): Promise<any> {
    if (!token || typeof token !== "string" || !token.trim()) {
      this.logger.warn(`verifyAccessToken received empty token`);
      throw new UnauthorizedException("Invalid access token");
    }
    const cleanToken = token.trim();
    let decoded: any;
    try {
      decoded = this.jwtService.verify(cleanToken, {
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

    // Active session and ban check against database
    if (this.prisma && decoded && decoded.sub) {
      // 1. If token has sessionId, verify this specific device session still exists and has not expired
      if (decoded.sessionId) {
        const session = await this.prisma.userSession.findUnique({
          where: { id: decoded.sessionId },
          select: {
            id: true,
            userId: true,
            expiresAt: true,
            user: {
              select: {
                bannedUntil: true,
              },
            },
          },
        });

        if (
          !session ||
          session.userId !== decoded.sub ||
          (session.expiresAt && session.expiresAt < new Date())
        ) {
          throw new UnauthorizedException(
            "Device session has been terminated or expired",
          );
        }

        if (session.user?.bannedUntil && session.user.bannedUntil > new Date()) {
          throw new UnauthorizedException("User account is currently suspended");
        }
      } else {
        // Fallback for legacy tokens without sessionId: verify user is not banned and has active sessions
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.sub },
          select: {
            bannedUntil: true,
            sessions: {
              where: {
                expiresAt: { gt: new Date() },
              },
              select: { id: true },
              take: 1,
            },
          },
        });

        if (user?.bannedUntil && user.bannedUntil > new Date()) {
          throw new UnauthorizedException("User account is currently suspended");
        }

        if (
          decoded.role !== "ADMIN" &&
          (!user?.sessions || user.sessions.length === 0)
        ) {
          throw new UnauthorizedException(
            "All user sessions have been terminated",
          );
        }
      }
    }

    return decoded;
  }
}

