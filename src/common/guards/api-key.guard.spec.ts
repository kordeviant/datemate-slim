import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'DEVICE_TOKEN_API_KEY') {
          return 'custom_secret_key_123';
        }
        return undefined;
      }),
    };
    guard = new ApiKeyGuard(mockConfigService as ConfigService);
  });

  const createMockContext = (headers: Record<string, string> = {}, query: Record<string, string> = {}): ExecutionContext => {
    const request = {
      headers,
      query,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access when valid x-api-key header is provided', () => {
    const context = createMockContext({ 'x-api-key': 'custom_secret_key_123' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when fallback default key is used', () => {
    const context = createMockContext({ 'x-api-key': 'datemate_device_token_api_key_2026' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when passed via Authorization: ApiKey <key>', () => {
    const context = createMockContext({ authorization: 'ApiKey custom_secret_key_123' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when passed via Authorization: Bearer <key>', () => {
    const context = createMockContext({ authorization: 'Bearer custom_secret_key_123' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when passed via query param ?apiKey=...', () => {
    const context = createMockContext({}, { apiKey: 'custom_secret_key_123' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when API key is missing', () => {
    const context = createMockContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Missing API key');
  });

  it('should throw UnauthorizedException when API key is invalid', () => {
    const context = createMockContext({ 'x-api-key': 'wrong_invalid_key' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Invalid API key');
  });
});
