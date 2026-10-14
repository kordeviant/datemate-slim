import { UnauthorizedException } from '@nestjs/common';
import { UserAuthGuard } from './user-auth.guard';
import { TokenService } from '../../../auth/application/services/token.service';

describe('UserAuthGuard', () => {
  let guard: UserAuthGuard;
  let mockTokenService: Partial<TokenService>;

  beforeEach(() => {
    mockTokenService = {
      verifyAccessToken: jest.fn(),
    };
    guard = new UserAuthGuard(mockTokenService as TokenService);
  });

  const createMockContext = (headers: Record<string, string>): any => {
    const request = { headers, user: null };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };
  };

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when Authorization header is whitespace', async () => {
    const context = createMockContext({ authorization: '   ' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token payload has no sub', async () => {
    (mockTokenService.verifyAccessToken as jest.Mock).mockResolvedValue({});
    const context = createMockContext({ authorization: 'Bearer valid_token' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches decoded user to request and returns true for valid token', async () => {
    const userPayload = { sub: 101, email: 'user@example.com', role: 'USER' };
    (mockTokenService.verifyAccessToken as jest.Mock).mockResolvedValue(userPayload);
    const context = createMockContext({ authorization: 'Bearer valid_token' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual(userPayload);
  });
});
