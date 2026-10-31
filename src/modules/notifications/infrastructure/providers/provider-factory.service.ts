import { Injectable } from '@nestjs/common';
import { NotificationProvider } from '../../domain/notification-provider.interface';
import { FcmService } from './fcm/fcm.service';
import { FCM_PROVIDER_NAME } from './fcm/fcm.constants';

@Injectable()
export class ProviderFactoryService {
  constructor(private readonly fcmService: FcmService) {}

  getProvider(providerName?: string): NotificationProvider {
    switch (providerName?.toLowerCase()) {
      case FCM_PROVIDER_NAME:
      default:
        return this.fcmService;
    }
  }
}
