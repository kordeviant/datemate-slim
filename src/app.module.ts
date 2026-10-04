import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { MailModule } from './infrastructure/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { MediaModule } from './modules/media/media.module';
import { InterestsModule } from './modules/interests/interests.module';
import { AdminModule } from './modules/admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    QuestionsModule,
    MediaModule,
    InterestsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

