import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  JwtService,
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
} from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { TokenService } from "./token.service";

describe("TokenService", () => {
  let service: TokenService;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockJwtService = {
      sign: jest.fn().mockReturnValue("signed_token"),
      verify: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === "JWT_ACCESS_SECRET") return "test_secret";
        if (key === "JWT_ACCESS_EXPIRES_IN") return "15m";
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  describe("verifyAccessToken", () => {
    it("should return decoded payload when token is valid", () => {
      const payload = { sub: 1, email: "user@example.com", role: "USER" };
      mockJwtService.verify.mockReturnValue(payload);

      const result = service.verifyAccessToken("valid_token");
      expect(mockJwtService.verify).toHaveBeenCalledWith("valid_token", {
        secret: "test_secret",
      });
      expect(result).toEqual(payload);
    });

    it("should throw UnauthorizedException with message Access token has expired on TokenExpiredError", () => {
      const expiredError = new TokenExpiredError("jwt expired", new Date());
      mockJwtService.verify.mockImplementation(() => {
        throw expiredError;
      });

      expect(() => service.verifyAccessToken("expired_token")).toThrow(
        new UnauthorizedException("Access token has expired"),
      );
    });

    it("should throw UnauthorizedException with message Invalid access token on JsonWebTokenError", () => {
      const jwtError = new JsonWebTokenError("invalid signature");
      mockJwtService.verify.mockImplementation(() => {
        throw jwtError;
      });

      expect(() => service.verifyAccessToken("invalid_token")).toThrow(
        new UnauthorizedException("Invalid access token"),
      );
    });

    it("should throw UnauthorizedException with message Invalid access token on NotBeforeError", () => {
      const nbfError = new NotBeforeError("jwt not active", new Date());
      mockJwtService.verify.mockImplementation(() => {
        throw nbfError;
      });

      expect(() => service.verifyAccessToken("future_token")).toThrow(
        new UnauthorizedException("Invalid access token"),
      );
    });

    it("should re-throw unexpected non-JWT errors", () => {
      const unexpectedError = new Error("DB connection failure");
      mockJwtService.verify.mockImplementation(() => {
        throw unexpectedError;
      });

      expect(() => service.verifyAccessToken("token")).toThrow("DB connection failure");
    });
  });

  describe("generateAccessToken", () => {
    it("should sign payload with configured secret and expiration", () => {
      const payload = { sub: 1, email: "test@example.com", role: "USER" };
      const token = service.generateAccessToken(payload);

      expect(mockJwtService.sign).toHaveBeenCalledWith(payload, {
        secret: "test_secret",
        expiresIn: "15m",
      });
      expect(token).toBe("signed_token");
    });
  });

  describe("generateRefreshToken", () => {
    it("should return raw token, sha256 hash, and 30-day expiration date", () => {
      const result = service.generateRefreshToken({ sub: 1 });

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBe(64); // 32 bytes hex
      expect(result.hash).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("hashRefreshToken", () => {
    it("should produce consistent sha256 hash", () => {
      const hash1 = service.hashRefreshToken("test_raw_token");
      const hash2 = service.hashRefreshToken("test_raw_token");
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });
});
