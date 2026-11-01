import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FcmService } from './fcm/fcm.service';
import { ProviderFactoryService } from './provider-factory.service';

@Module({
  imports: [ConfigModule],
  providers: [FcmService, ProviderFactoryService],
  exports: [FcmService, ProviderFactoryService],
})
export class ProvidersModule {}
