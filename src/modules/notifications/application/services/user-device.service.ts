import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetDeviceTokenUseCase } from '../../../auth/application/use-cases/get-device-token.use-case';

export interface DeviceTokenResponse {
  status: string;
  message: string;
  data?: {
    userId: number | string;
    token: string;
    deviceInfo?: string;
  };
}

@Injectable()
export class UserDeviceService {
  private readonly logger = new Logger(UserDeviceService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly getDeviceTokenUseCase?: GetDeviceTokenUseCase,
  ) {}

  /**
   * Fetches the device token for a given userId.
   * Prioritizes in-memory direct database lookup via GetDeviceTokenUseCase.
   * Falls back to HTTP call if configured as external microservice.
   */
  async getDeviceToken(userId: string | number): Promise<string | null> {
    const numericUserId = typeof userId === 'number' ? userId : parseInt(String(userId), 10);

    // 1. Direct in-memory lookup if available
    if (this.getDeviceTokenUseCase && !isNaN(numericUserId)) {
      try {
        const result = await this.getDeviceTokenUseCase.execute(numericUserId);
        if (result?.token) {
          this.logger.debug(`Resolved device token in-memory for userId ${numericUserId}`);
          return result.token;
        }
        return null;
      } catch (err: any) {
        if (err?.status === 404 || err?.name === 'NotFoundException') {
          this.logger.debug(`No device token found for userId ${numericUserId}`);
          return null;
        }
        this.logger.warn(`In-memory device token resolution error for user ${numericUserId}: ${err?.message}`);
      }
    }

    // 2. HTTP external user-service fallback
    const rawBaseUrl =
      this.configService.get<string>('userService.baseUrl') ||
      process.env.USER_SERVICE_URL ||
      process.env.USER_SERVICE_BASE_URL;

    if (!rawBaseUrl) {
      return null;
    }

    const apiKey =
      this.configService.get<string>('userService.apiKey') ||
      process.env.USER_SERVICE_API_KEY ||
      process.env.API_KEY ||
      '';

    const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
    const url = cleanBaseUrl.endsWith('/v1')
      ? `${cleanBaseUrl}/users/${encodeURIComponent(userId)}/device-token`
      : `${cleanBaseUrl}/v1/users/${encodeURIComponent(userId)}/device-token`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    try {
      this.logger.debug(`Fetching device token for userId ${userId} from ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.status === 404) {
        this.logger.warn(`Device token not found for userId ${userId} (HTTP 404).`);
        return null;
      }

      if (response.status === 401 || response.status === 403) {
        this.logger.error(
          `Authentication failed while requesting device token for userId ${userId} (HTTP ${response.status}). Check USER_SERVICE_API_KEY.`,
        );
        return null;
      }

      if (!response.ok) {
        throw new Error(
          `User service returned HTTP ${response.status} ${response.statusText} for userId ${userId}`,
        );
      }

      const body = (await response.json()) as DeviceTokenResponse;
      const token = body?.data?.token;

      if (!token) {
        this.logger.warn(`Device token response for userId ${userId} was missing data.token.`);
        return null;
      }

      return token;
    } catch (error: any) {
      const causeStr = error?.cause ? ` (${error.cause?.message || error.cause})` : '';
      this.logger.error(
        `Error requesting device token for userId ${userId} from ${url}: ${error?.message}${causeStr}`,
      );
      throw error;
    }
  }
}
