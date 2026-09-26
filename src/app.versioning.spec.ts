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

describe("API Versioning (v1)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController, AuthController, UsersController],
      providers: [
        AppService,
        { provide: SignUpUseCase, useValue: { execute: jest.fn() } },
        { provide: VerifyCodeUseCase, useValue: { execute: jest.fn() } },
        { provide: SignInUseCase, useValue: { execute: jest.fn() } },
        { provide: RefreshTokenUseCase, useValue: { execute: jest.fn() } },
        { provide: ForgotPasswordUseCase, useValue: { execute: jest.fn() } },
        { provide: ResetPasswordUseCase, useValue: { execute: jest.fn() } },
        { provide: GoogleAuthUseCase, useValue: { execute: jest.fn() } },
        { provide: AppleAuthUseCase, useValue: { execute: jest.fn() } },
        { provide: TokenService, useValue: { verifyAccessToken: jest.fn() } },
        { provide: GetProfileUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateProfileUseCase, useValue: { execute: jest.fn() } },
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

    it("GET /rules returns 200 with HTML documentation view", async () => {
      const res = await request(app.getHttpServer()).get("/rules");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("DateMate Platform Rules");
    });

    it("GET /v1/rules returns 200 with HTML documentation view", async () => {
      const res = await request(app.getHttpServer()).get("/v1/rules");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("DateMate Platform Rules");
    });

    it("GET /rules?format=raw returns 200 with raw Markdown", async () => {
      const res = await request(app.getHttpServer()).get("/rules?format=raw");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/markdown");
      expect(res.text).toContain("# DateMate Platform Rules & Client Validation Specification");
    });

    it("GET /rules?format=json returns 200 with structured JSON", async () => {
      const res = await request(app.getHttpServer()).get("/rules?format=json");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.title).toContain("DateMate Platform Rules");
      expect(res.body.data.content).toBeDefined();
    });

    it("GET /rules?download=1 returns 200 with attachment disposition header", async () => {
      const res = await request(app.getHttpServer()).get("/rules?download=1");
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain('attachment; filename="DateMate-RULES.md"');
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
  });
});
