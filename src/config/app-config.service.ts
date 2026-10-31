import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './app.config';
import { UploadConfig } from './upload.config';
import { ChatConfig } from './chat.config';
import { NotificationConfig } from './notification.config';
import { CassandraConfig } from './cassandra.config';
import { BusinessRulesConfig } from './business-rules.config';
import { SecurityConfig } from './security.config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get app(): AppConfig {
    return this.configService.get<AppConfig>('app')!;
  }

  get upload(): UploadConfig {
    return this.configService.get<UploadConfig>('upload')!;
  }

  get chat(): ChatConfig {
    return this.configService.get<ChatConfig>('chat')!;
  }

  get notification(): NotificationConfig {
    return this.configService.get<NotificationConfig>('notification')!;
  }

  get cassandra(): CassandraConfig {
    return this.configService.get<CassandraConfig>('cassandra')!;
  }

  get businessRules(): BusinessRulesConfig {
    return this.configService.get<BusinessRulesConfig>('businessRules')!;
  }

  get security(): SecurityConfig {
    return this.configService.get<SecurityConfig>('security')!;
  }

  get<T>(key: string, defaultValue?: T): T {
    return this.configService.get<T>(key, defaultValue as any) as T;
  }
}
