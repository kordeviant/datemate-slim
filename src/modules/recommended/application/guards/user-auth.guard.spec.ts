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

  it('throws UnauthorizedException when Authorization header is missing', () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when Authorization header is whitespace', () => {
    const context = createMockContext({ authorization: '   ' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token payload has no sub', () => {
    (mockTokenService.verifyAccessToken as jest.Mock).mockReturnValue({});
    const context = createMockContext({ authorization: 'Bearer valid_token' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('attaches decoded user to request and returns true for valid token', () => {
    const userPayload = { sub: 101, email: 'user@example.com', role: 'USER' };
    (mockTokenService.verifyAccessToken as jest.Mock).mockReturnValue(userPayload);
    const context = createMockContext({ authorization: 'Bearer valid_token' });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual(userPayload);
  });
});
