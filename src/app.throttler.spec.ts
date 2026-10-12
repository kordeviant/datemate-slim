import { Test, TestingModule } from "@nestjs/testing";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  INestApplication,
  Post,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  ThrottlerModule,
  ThrottlerGuard,
  Throttle,
  SkipThrottle,
} from "@nestjs/throttler";
import request from "supertest";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

@Controller("test-throttling")
class TestThrottlerController {
  @Get("standard")
  @HttpCode(HttpStatus.OK)
  standardEndpoint() {
    return { success: true };
  }

  @SkipThrottle()
  @Get("health")
  @HttpCode(HttpStatus.OK)
  healthEndpoint() {
    return { status: "ok" };
  }

  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post("sensitive-action")
  @HttpCode(HttpStatus.OK)
  sensitiveEndpoint() {
    return { sensitive: "success" };
  }
}

describe("Rate Limiting & Anti-Spoofing Proxy Security (ThrottlerGuard)", () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: "default",
            ttl: 60000,
            limit: 5,
          },
        ]),
      ],
      controllers: [TestThrottlerController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set("trust proxy", "loopback");
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("Global Rate Limit Enforcement", () => {
    it("allows requests within the configured limit (5 requests)", async () => {
      for (let i = 1; i <= 5; i++) {
        const res = await request(app.getHttpServer()).get(
          "/test-throttling/standard",
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(res.headers["x-ratelimit-limit"]).toBe("5");
        expect(res.headers["x-ratelimit-remaining"]).toBe(String(5 - i));
      }
    });

    it("throttles excess requests beyond the limit with HTTP 429 Too Many Requests", async () => {
      // Consume all 5 allowed hits
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get("/test-throttling/standard");
      }

      // 6th request must be throttled with HTTP 429
      const res = await request(app.getHttpServer()).get(
        "/test-throttling/standard",
      );
      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({
        status: "error",
        message: expect.stringContaining("Too Many Requests"),
        data: null,
      });
      expect(res.headers["retry-after"]).toBeDefined();
    });
  });

  describe("Endpoint-Specific Stricter Limits (@Throttle)", () => {
    it("applies stricter threshold on sensitive endpoint (limit: 2)", async () => {
      // 1st attempt: OK
      const res1 = await request(app.getHttpServer()).post(
        "/test-throttling/sensitive-action",
      );
      expect(res1.status).toBe(200);

      // 2nd attempt: OK
      const res2 = await request(app.getHttpServer()).post(
        "/test-throttling/sensitive-action",
      );
      expect(res2.status).toBe(200);

      // 3rd attempt: Throttled with 429
      const res3 = await request(app.getHttpServer()).post(
        "/test-throttling/sensitive-action",
      );
      expect(res3.status).toBe(429);
      expect(res3.body.status).toBe("error");
    });
  });

  describe("Rate Limit Exemption (@SkipThrottle)", () => {
    it("bypasses rate limiting for health check endpoint across repeated requests", async () => {
      // Send 10 consecutive requests (well past global limit of 5)
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer()).get(
          "/test-throttling/health",
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
      }
    });
  });

  describe("Anti-Spoofing & Reverse Proxy IP Handling", () => {
    it("isolates rate limit buckets between different client IPs via trusted proxy", async () => {
      // Client A exhausts 5 requests
      for (let i = 0; i < 5; i++) {
        const resA = await request(app.getHttpServer())
          .get("/test-throttling/standard")
          .set("X-Forwarded-For", "198.51.100.10");
        expect(resA.status).toBe(200);
      }

      // Client A 6th request is throttled
      const resA6 = await request(app.getHttpServer())
        .get("/test-throttling/standard")
        .set("X-Forwarded-For", "198.51.100.10");
      expect(resA6.status).toBe(429);

      // Client B from another IP still has quota
      const resB = await request(app.getHttpServer())
        .get("/test-throttling/standard")
        .set("X-Forwarded-For", "198.51.100.20");
      expect(resB.status).toBe(200);
      expect(resB.body).toEqual({ success: true });
    });

    it("prevents attackers from bypassing rate limit by spoofing left-hand X-Forwarded-For IPs", async () => {
      // An attacker from 203.0.113.99 sends forged client IPs on the left of X-Forwarded-For
      // Behind loopback proxy (Nginx), Express trust-proxy peels loopback and binds to the rightmost IP (203.0.113.99)
      for (let i = 1; i <= 5; i++) {
        const res = await request(app.getHttpServer())
          .get("/test-throttling/standard")
          .set("X-Forwarded-For", `fake-${i}.attacker.com, 203.0.113.99`);
        expect(res.status).toBe(200);
      }

      // 6th attempt with yet another spoofed IP in prefix must STILL be throttled
      const blockedRes = await request(app.getHttpServer())
        .get("/test-throttling/standard")
        .set("X-Forwarded-For", "yet-another-fake-ip, 203.0.113.99");

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.status).toBe("error");
    });
  });
});
