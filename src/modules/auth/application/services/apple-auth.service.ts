import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import appleSignin from 'apple-signin-auth';

export interface AppleTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | 'true' | 'false';
  is_private_email?: boolean | 'true' | 'false';
  [key: string]: any;
}

@Injectable()
export class AppleAuthService {
  private readonly logger = new Logger(AppleAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  async verifyIdToken(
    identityToken: string,
    bundleIdOverride?: string,
  ): Promise<AppleTokenPayload> {
    try {
      const configuredClientId =
        this.configService.get<string>('APPLE_CLIENT_ID') ||
        this.configService.get<string>('APPLE_BUNDLE_ID');

      const audience = bundleIdOverride || configuredClientId;

      const payload = await appleSignin.verifyIdToken(identityToken, {
        ...(audience ? { audience } : {}),
        ignoreExpiration: false,
      });

      return payload as AppleTokenPayload;
    } catch (err: any) {
      this.logger.error(`Apple ID token verification failed: ${err.message}`);
      throw new UnauthorizedException(
        `Apple ID Token verification failed: ${err.message || 'Invalid token'}`,
      );
    }
  }
}
