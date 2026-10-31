import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './configuration';
import { AppConfigService } from './app-config.service';

describe('Configuration Module', () => {
  let appConfigService: AppConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
      ],
      providers: [AppConfigService],
    }).compile();

    appConfigService = module.get<AppConfigService>(AppConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should initialize and provide strongly-typed app config with sensible defaults', () => {
    expect(appConfigService.app).toBeDefined();
    expect(appConfigService.app.port).toBe(3000);
    expect(appConfigService.app.environment).toBe('test');
    expect(appConfigService.app.cors.origin).toBe(true);
  });

  it('should provide upload configuration with limits for avatar, gallery, video, and chat', () => {
    const upload = appConfigService.upload;
    expect(upload).toBeDefined();
    expect(upload.avatar.maxSizeBytes).toBe(5 * 1024 * 1024);
    expect(upload.galleryPhoto.maxSizeBytes).toBe(10 * 1024 * 1024);
    expect(upload.video.maxSizeBytes).toBe(50 * 1024 * 1024);
    expect(upload.chatAttachment.imageMaxSizeBytes).toBe(15 * 1024 * 1024);
    expect(upload.chatAttachment.audioMaxSizeBytes).toBe(25 * 1024 * 1024);
    expect(upload.chatAttachment.videoMaxSizeBytes).toBe(100 * 1024 * 1024);
    expect(upload.chatAttachment.documentMaxSizeBytes).toBe(50 * 1024 * 1024);
    expect(upload.chatAttachment.dangerousExtensions).toContain('.exe');
    expect(upload.chatAttachment.dangerousExtensions).toContain('.sh');
  });

  it('should provide chat configuration with group and message limitations', () => {
    const chat = appConfigService.chat;
    expect(chat).toBeDefined();
    expect(chat.maxMessageLength).toBe(4000);
    expect(chat.maxAttachmentsPerMessage).toBe(10);
    expect(chat.maxGroupTitleLength).toBe(100);
    expect(chat.maxGroupDescriptionLength).toBe(500);
    expect(chat.minGroupMembers).toBe(2);
    expect(chat.maxGroupMembers).toBe(100);
    expect(chat.maxGroupsPerUser).toBe(50);
    expect(chat.presenceDebounceMs).toBe(3000);
    expect(chat.wsNamespace).toBe('/chat');
  });

  it('should provide notification configuration with sensible defaults and mock mode detection', () => {
    const notification = appConfigService.notification;
    expect(notification).toBeDefined();
    expect(notification.fcm.mockMode).toBe(true);
    expect(notification.defaults.priority).toBe('normal');
    expect(notification.defaults.timeoutMs).toBe(5000);
    expect(notification.defaults.retryAttempts).toBe(3);
    expect(notification.security.apiKeys.length).toBeGreaterThan(0);
  });

  it('should provide cassandra configuration with contact points and keyspace', () => {
    const cassandra = appConfigService.cassandra;
    expect(cassandra).toBeDefined();
    expect(cassandra.contactPoints).toEqual(['127.0.0.1']);
    expect(cassandra.keyspace).toBe('datemate_chat');
    expect(cassandra.localDataCenter).toBe('datacenter1');
    expect(cassandra.autoMigrate).toBe(true);
  });

  it('should provide business rules configuration with pagination and matching bounds', () => {
    const businessRules = appConfigService.businessRules;
    expect(businessRules).toBeDefined();
    expect(businessRules.pagination.defaultLimit).toBe(20);
    expect(businessRules.pagination.maxLimit).toBe(100);
    expect(businessRules.roles.defaultUserRole).toBe('USER');
    expect(businessRules.roles.adminRoles).toContain('ADMIN');
    expect(businessRules.matching.dailyFreeSwipeLimit).toBe(100);
    expect(businessRules.matching.minAge).toBe(18);
    expect(businessRules.matching.maxAge).toBe(100);
  });

  it('should provide security configuration with throttler and jwt defaults', () => {
    const security = appConfigService.security;
    expect(security).toBeDefined();
    expect(security.throttler.ttlMs).toBe(60000);
    expect(security.throttler.limit).toBe(120);
    expect(security.jwt.accessSecret).toBe('access_secret');
    expect(security.jwt.accessExpiresIn).toBe('15m');
  });
});
