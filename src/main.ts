import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as path from "path";
import * as fs from "fs";
import { DocsProtectionMiddleware } from "./common/middleware/docs-protection.middleware";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Secure Reverse Proxy & Client IP configuration (Nginx / Load Balancer)
  // By default, trusts loopback proxies ('loopback' = 127.0.0.1, ::1) where Nginx forwards traffic.
  // This ensures req.ip correctly resolves legitimate client IPs from X-Forwarded-For
  // without blindly trusting spoofed X-Forwarded-For headers from untrusted direct callers.
  const trustProxySetting = configService.get<string>(
    "TRUST_PROXY",
    "loopback",
  );
  const parsedTrustProxy = !isNaN(Number(trustProxySetting))
    ? Number(trustProxySetting)
    : trustProxySetting === "true"
      ? true
      : trustProxySetting === "false"
        ? false
        : trustProxySetting;
  app.set("trust proxy", parsedTrustProxy);
  // Enable CORS only allow on port 3001
  // app.enableCors({
  //   origin: ['http://localhost:3001', 'https://panel-datemate.testdevvvv.site','http://panel-datemate.testdevvvv.site/', '162.19.154.210', '162.19.154.210:3001','192.168.88.191:3001', '192.168.88.191'],
  //   credentials: true,
  //   methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  //   allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  // });
  // Allow all origins
  app.enableCors({
    origin: true, // Dynamically reflects request origin (e.g. localhost:3001, panel-datemate.testdevvvv.site)
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'x-api-key',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });
  // Serve static uploads (avatars, images)
  app.useStaticAssets(path.join(process.cwd(), "uploads"), {
    prefix: "/uploads/",
  });

  // Serve raw static dataset files under /static
  const geoDataDir = path.join(process.cwd(), "data/geo");
  if (fs.existsSync(geoDataDir)) {
    app.useStaticAssets(geoDataDir, {
      prefix: "/static/",
      setHeaders: (res: any, filePath: string) => {
        if (filePath.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        }
      },
    });
  }

  // Enable URI Versioning (e.g. /v1/auth/..., /v1/users/...)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global exception filter for unified ResponseResult<T> error envelope
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptor for unified ResponseResult<T> success envelope
  app.useGlobalInterceptors(new TransformInterceptor());


  // Swagger Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle("DateMate Consolidated Backend API")
    .setDescription(
      "DateMate Unified Backend API microservice consolidating User, Matching, Chat (Cassandra + Socket.IO), and Notification (FCM) domains.\n\n" +
      "### Subdomain Specifications & Interactive Portals\n" +
      "- **Authoritative Client Validation Rules**: [Open /docs/rules](/docs/rules)\n" +
      "- **AsyncAPI JSON Specification**: [Open /docs/asyncapi-json](/docs/asyncapi-json)\n" +
      "- **WebSocket Gateway Endpoint**: `ws://<host>/chat` (Namespace: `/chat`)\n" +
      "- **WebSocket Handshake Authentication**: `{ auth: { accessToken: '<JWT>' } }`",
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT Access Token",
        in: "header",
      },
      "JWT-auth",
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "x-api-key",
        in: "header",
        description: "Internal Service API Key (e.g. for push notifications or device tokens)",
      },
      "api-key",
    )
    .addTag("Auth", "User registration, OTP login, token refresh, and session management")
    .addTag("Users", "Profile retrieval, demographic details, avatar and gallery management")
    .addTag("Matching", "User discovery feed, swipes (likes/passes), mutual matches")
    .addTag("Recommended", "Personalized user recommendations and discovery algorithms")
    .addTag("Friends", "Social friend requests, accepts, rejects, and friendship management")
    .addTag("Conversations", "1-on-1 direct conversations, group chats, message history pagination")
    .addTag("Groups", "Group creation, participant invitations, member roles, and metadata updates")
    .addTag("Chat Presence", "Real-time user online/offline status and last seen activity tracking")
    .addTag("Chat Upload", "Direct upload for chat photos, voice messages, audio, and attachments")
    .addTag("Notifications", "High-throughput immediate async push notification dispatch and aliased endpoints")
    .addTag("Questions", "Compatibility questionnaire questions, categories, and choices")
    .addTag("Interests", "Hobbies and user interest tags")
    .addTag("Media", "Static assets and media processing")
    .addTag("Admin", "Administrator user management, selfie verification triage, dashboard metrics")
    .addTag("System", "Platform health, server time, and dynamic API specifications")
    .build();

  // Protect Swagger UI, documentation static assets, and Rules via IP Whitelist & HTTP Basic Auth
  const docsProtectionMiddleware = new DocsProtectionMiddleware(configService);
  app.use((req: any, res: any, next: any) =>
    docsProtectionMiddleware.use(req, res, next),
  );

  // Prevent caching for Swagger documentation so each backend deployment is visible immediately
  app.use(
    ["/docs", "/docs-json", "/v1/docs", "/docs/asyncapi-json", "/asyncapi-json", "/docs/rules"],
    (req: any, res: any, next: any) => {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");

      // Cache-bust swagger-ui-init.js script tag in HTML response
      const originalSend = res.send;
      res.send = function (body: any) {
        if (typeof body === "string" && body.includes("swagger-ui-init.js")) {
          const timestamp = Date.now();
          const modified = body
            .replace("swagger-ui-init.js", `swagger-ui-init.js?v=${timestamp}`)
            .replace(
              "swagger-ui-bundle.js",
              `swagger-ui-bundle.js?v=${timestamp}`,
            );
          return originalSend.call(this, modified);
        }
        return originalSend.call(this, body);
      };

      next();
    },
  );

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      url: "/docs-json",
      persistAuthorization: true,
    },
    customJsStr: `
      window.addEventListener('load', function() {
        fetch('/docs-json?_cb=' + Date.now())
          .then(function(r) { return r.json(); })
          .then(function(spec) {
            if (window.ui && window.ui.specActions) {
              window.ui.specActions.updateSpec(JSON.stringify(spec));
            }
          })
          .catch(function(err) { console.error('Failed to sync Swagger spec:', err); });
      });
    `,
    customSiteTitle: "DateMate Backend API Docs",
  });

  const port = configService.get<number>("PORT", 3000);

  await app.listen(port);
  console.log(`DateMate Backend is running on port: ${port}`);
}

bootstrap();
