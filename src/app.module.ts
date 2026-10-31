import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./infrastructure/database/prisma.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { MailModule } from "./infrastructure/mail/mail.module";
import { GeoModule } from "./infrastructure/geo/geo.module";
import { NotificationModule } from "./infrastructure/notification/notification.module";
import { AuthModule } from "./modules/auth/auth.module";
import { QuestionsModule } from "./modules/questions/questions.module";
import { MediaModule } from "./modules/media/media.module";
import { InterestsModule } from "./modules/interests/interests.module";
import { AdminModule } from "./modules/admin/admin.module";
import { MatchingModule } from "./modules/matching/matching.module";
import { RecommendedModule } from "./modules/recommended/recommended.module";
import { FriendsModule } from "./modules/friends/friends.module";
import { ChatModule } from "./modules/chat/chat.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DocsProtectionMiddleware } from "./common/middleware/docs-protection.middleware";
import configuration from "./config/configuration";
import { AppConfigService } from "./config/app-config.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttlRaw = configService.get<string | number>(
          "THROTTLE_TTL",
          60000,
        );
        const limitRaw = configService.get<string | number>(
          "THROTTLE_LIMIT",
          120,
        );
        const ttl = typeof ttlRaw === "string" ? parseInt(ttlRaw, 10) : ttlRaw;
        const limit =
          typeof limitRaw === "string" ? parseInt(limitRaw, 10) : limitRaw;

        return {
          errorMessage: "Too Many Requests",
          throttlers: [
            {
              name: "default",
              ttl: isNaN(ttl) ? 60000 : ttl,
              limit: isNaN(limit) ? 120 : limit,
            },
          ],
        };
      },
    }),
    PrismaModule,
    RedisModule,
    MailModule,
    GeoModule,
    NotificationModule,
    AuthModule,
    QuestionsModule,
    MediaModule,
    InterestsModule,
    AdminModule,
    MatchingModule,
    RecommendedModule,
    FriendsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppConfigService,
    DocsProtectionMiddleware,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [AppConfigService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DocsProtectionMiddleware).forRoutes("*");
  }
}
