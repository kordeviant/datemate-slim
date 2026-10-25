import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@Optional() private readonly configService?: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedApiKey = this.extractApiKey(request);

    if (!providedApiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const validApiKeys = this.getValidApiKeys();
    const isValid = validApiKeys.some(
      (validKey) => validKey && validKey === providedApiKey,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private extractApiKey(request: any): string | null {
    if (!request) return null;

    // 1. Header lookup: x-api-key, apikey, x-token (Express lowercases header keys)
    const headers = request.headers || {};
    const headerKey =
      headers['x-api-key'] ||
      headers['apikey'] ||
      headers['x-token'];
    if (headerKey && typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }

    // 2. Authorization header: ApiKey <key> or Bearer <key> or raw key
    const authHeader = headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.trim()) {
      const trimmed = authHeader.trim();
      const match = trimmed.match(/^(?:ApiKey|Bearer)\s+(.+)$/i);
      if (match && match[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
      return trimmed.replace(/^["']|["']$/g, '');
    }

    // 3. Query param: ?apiKey=... or ?api_key=...
    const query = request.query || {};
    const queryKey = query.apiKey || query.api_key;
    if (queryKey && typeof queryKey === 'string' && queryKey.trim()) {
      return queryKey.trim();
    }

    return null;
  }

  private getValidApiKeys(): string[] {
    const configuredKeys: string[] = [
      this.configService?.get<string>('DEVICE_TOKEN_API_KEY') || '',
      this.configService?.get<string>('INTERNAL_API_KEY') || '',
      this.configService?.get<string>('API_KEY') || '',
      process.env.DEVICE_TOKEN_API_KEY || '',
      process.env.INTERNAL_API_KEY || '',
      process.env.API_KEY || '',
    ].filter(Boolean);

    const defaultKeys = [
      'datemate_device_token_api_key_2026',
      'datemate_internal_api_key_2026',
    ];

    return Array.from(new Set([...configuredKeys, ...defaultKeys]));
  }
}
