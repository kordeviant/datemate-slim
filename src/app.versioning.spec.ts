import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, VersioningType } from "@nestjs/common";
import request from "supertest";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthController } from "./modules/auth/presentation/auth.controller";
import { UsersController } from "./modules/auth/presentation/users.controller";
import { SignUpUseCase } from "./modules/auth/application/use-cases/sign-up.use-case";
import { VerifyCodeUseCase } from "./modules/auth/application/use-cases/verify-code.use-case";
import { SignInUseCase } from "./modules/auth/application/use-cases/sign-in.use-case";
import { RefreshTokenUseCase } from "./modules/auth/application/use-cases/refresh-token.use-case";
import { ForgotPasswordUseCase } from "./modules/auth/application/use-cases/forgot-password.use-case";
import { ResetPasswordUseCase } from "./modules/auth/application/use-cases/reset-password.use-case";
import { GoogleAuthUseCase } from "./modules/auth/application/use-cases/google-auth.use-case";
import { AppleAuthUseCase } from "./modules/auth/application/use-cases/apple-auth.use-case";
import { TokenService } from "./modules/auth/application/services/token.service";
import { GetProfileUseCase } from "./modules/auth/application/use-cases/get-profile.use-case";
import { UpdateProfileUseCase } from "./modules/auth/application/use-cases/update-profile.use-case";
import { DeleteAccountUseCase } from "./modules/auth/application/use-cases/delete-account.use-case";
import { DeleteGalleryImageUseCase } from "./modules/auth/application/use-cases/delete-gallery-image.use-case";
import { LogoutUseCase } from "./modules/auth/application/use-cases/logout.use-case";
import { GetUserDevicesUseCase } from "./modules/auth/application/use-cases/get-user-devices.use-case";
import { TerminateClientDeviceUseCase } from "./modules/auth/application/use-cases/terminate-client-device.use-case";
import { TerminateAllClientDevicesUseCase } from "./modules/auth/application/use-cases/terminate-all-client-devices.use-case";
import { GetBulkUsersUseCase } from "./modules/auth/application/use-cases/get-bulk-users.use-case";
import { GetUserAvatarUseCase } from "./modules/auth/application/use-cases/get-user-avatar.use-case";
import { GetBulkAvatarsUseCase } from "./modules/auth/application/use-cases/get-bulk-avatars.use-case";
import { UpdateDeviceTokenUseCase } from "./modules/auth/application/use-cases/update-device-token.use-case";
import { GetDeviceTokenUseCase } from "./modules/auth/application/use-cases/get-device-token.use-case";
import { GeoController } from "./infrastructure/geo/geo.controller";
import { DownloadController } from "./infrastructure/geo/download.controller";
import { GeoLookupService } from "./infrastructure/geo/geo-lookup.service";
import { DownloadRegistryService } from "./infrastructure/geo/download-registry.service";

describe("API Versioning (v1)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        AppController,
        AuthController,
        UsersController,
        GeoController,
        DownloadController,
      ],
      providers: [
        AppService,
        GeoLookupService,
        DownloadRegistryService,
        { provide: SignUpUseCase, useValue: { execute: jest.fn() } },
        { provide: VerifyCodeUseCase, useValue: { execute: jest.fn() } },
        { provide: SignInUseCase, useValue: { execute: jest.fn() } },
        { provide: RefreshTokenUseCase, useValue: { execute: jest.fn() } },
        { provide: ForgotPasswordUseCase, useValue: { execute: jest.fn() } },
        { provide: ResetPasswordUseCase, useValue: { execute: jest.fn() } },
        { provide: GoogleAuthUseCase, useValue: { execute: jest.fn() } },
        { provide: AppleAuthUseCase, useValue: { execute: jest.fn() } },
        { provide: LogoutUseCase, useValue: { execute: jest.fn() } },
        { provide: TokenService, useValue: { verifyAccessToken: jest.fn() } },
        { provide: GetProfileUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateProfileUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteAccountUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteGalleryImageUseCase, useValue: { execute: jest.fn() } },
        { provide: GetUserDevicesUseCase, useValue: { execute: jest.fn() } },
        { provide: TerminateClientDeviceUseCase, useValue: { execute: jest.fn() } },
        { provide: TerminateAllClientDevicesUseCase, useValue: { execute: jest.fn() } },
        { provide: GetBulkUsersUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
        { provide: UpdateDeviceTokenUseCase, useValue: { execute: jest.fn() } },
        { provide: GetDeviceTokenUseCase, useValue: { execute: jest.fn().mockResolvedValue({ userId: 1, token: "test_token", deviceInfo: "test_device" }) } },
        { provide: GetUserAvatarUseCase, useValue: { execute: jest.fn().mockResolvedValue({ id: 1, avatarUrl: "http://localhost:3000/assets/avatars/avatar_1.webp" }) } },
        { provide: GetBulkAvatarsUseCase, useValue: { execute: jest.fn().mockResolvedValue([{ id: 1, avatarUrl: "http://localhost:3000/assets/avatars/avatar_1.webp" }]) } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: "1",
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("System Endpoints (Neutral & v1)", () => {
    it("GET /health returns 200", async () => {
      const res = await request(app.getHttpServer()).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });

    it("GET /v1/health returns 200", async () => {
      const res = await request(app.getHttpServer()).get("/v1/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });

    it("GET /time returns 200", async () => {
      const res = await request(app.getHttpServer()).get("/time");
      expect(res.status).toBe(200);
    });

    it("GET /v1/time returns 200", async () => {
      const res = await request(app.getHttpServer()).get("/v1/time");
      expect(res.status).toBe(200);
    });

    it("GET /docs/rules returns 200 with HTML documentation view and slug anchor support", async () => {
      const res = await request(app.getHttpServer()).get("/docs/rules");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("DateMate Platform Rules");
      expect(res.text).toContain("/docs/rules");
      expect(res.text).toContain("slugifyHeading");
    });

    it("GET /v1/docs/rules returns 200 with HTML documentation view", async () => {
      const res = await request(app.getHttpServer()).get("/v1/docs/rules");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("DateMate Platform Rules");
    });

    it("GET /docs/rules?format=raw returns 200 with raw Markdown", async () => {
      const res = await request(app.getHttpServer()).get("/docs/rules?format=raw");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/markdown");
      expect(res.text).toContain("# DateMate Platform Rules & Client Validation Specification");
    });

    it("GET /docs/rules?format=json returns 200 with structured JSON referencing /docs/rules", async () => {
      const res = await request(app.getHttpServer()).get("/docs/rules?format=json");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.title).toContain("DateMate Platform Rules");
      expect(res.body.data.rulesUrl).toBe("/docs/rules");
      expect(res.body.data.content).toBeDefined();
    });

    it("GET /docs/rules?download=1 returns 200 with attachment disposition header", async () => {
      const res = await request(app.getHttpServer()).get("/docs/rules?download=1");
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain('attachment; filename="DateMate-RULES.md"');
    });

    it("GET /rules and /v1/rules backward-compatible aliases return 200", async () => {
      const res1 = await request(app.getHttpServer()).get("/rules");
      expect(res1.status).toBe(200);
      const res2 = await request(app.getHttpServer()).get("/v1/rules");
      expect(res2.status).toBe(200);
    });
  });

  describe("Versioned v1 API Endpoints", () => {
    it("GET /v1/users/me requires auth header (returns 401)", async () => {
      const res = await request(app.getHttpServer()).get("/v1/users/me");
      expect(res.status).toBe(401);
    });

    it("GET /v1/users/profile requires auth header (returns 401)", async () => {
      const res = await request(app.getHttpServer()).get("/v1/users/profile");
      expect(res.status).toBe(401);
    });

    it("POST /v1/users/profile requires auth header (returns 401)", async () => {
      const res = await request(app.getHttpServer()).post("/v1/users/profile");
      expect(res.status).toBe(401);
    });

    it("PUT /v1/users/profile requires auth header (returns 401)", async () => {
      const res = await request(app.getHttpServer()).put("/v1/users/profile");
      expect(res.status).toBe(401);
    });

    it("POST /v1/auth/nonce succeeds with 200", async () => {
      const res = await request(app.getHttpServer()).post("/v1/auth/nonce");
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it("POST /auth/nonce without /v1 returns 404", async () => {
      const res = await request(app.getHttpServer()).post("/auth/nonce");
      expect(res.status).toBe(404);
    });

    it("POST /v1/users/bulk succeeds with 200 and accepts bare array", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/users/bulk")
        .send([1, 2]);
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it("PUT /v1/users/device-token requires auth header (returns 401)", async () => {
      const res = await request(app.getHttpServer())
        .put("/v1/users/device-token")
        .send({ token: "sample_token" });
      expect(res.status).toBe(401);
    });

    it("GET /v1/users/1/device-token without API key returns 401", async () => {
      const res = await request(app.getHttpServer()).get("/v1/users/1/device-token");
      expect(res.status).toBe(401);
    });

    it("GET /v1/users/1/device-token with valid API key succeeds with 200", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/users/1/device-token")
        .set("x-api-key", "datemate_device_token_api_key_2026");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.token).toBe("test_token");
    });

    it("GET /v1/geo/countries succeeds with 200 and returns 250 countries", async () => {
      const res = await request(app.getHttpServer()).get("/v1/geo/countries");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(250);
    });

    it("GET /v1/downloads/catalog succeeds with 200", async () => {
      const res = await request(app.getHttpServer()).get("/v1/downloads/catalog");
      expect(res.status).toBe(200);
      expect(res.body.totalPackages).toBeGreaterThanOrEqual(4);
    });

    it("GET /v1/users/1/avatar requires authorization header (returns 401)", async () => {
      const res = await request(app.getHttpServer()).get("/v1/users/1/avatar");
      expect(res.status).toBe(401);
    });

    it("GET /v1/users/avatars/1,2 requires authorization header (returns 401)", async () => {
      const res = await request(app.getHttpServer()).get("/v1/users/avatars/1,2");
      expect(res.status).toBe(401);
    });
  });
});
