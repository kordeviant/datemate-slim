import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { TokenService } from '../../../auth/application/services/token.service';

describe('AdminAuthGuard', () => {
  let guard: AdminAuthGuard;
  let mockTokenService: Partial<TokenService>;

  beforeEach(() => {
    mockTokenService = {
      verifyAccessToken: jest.fn(),
    };
    guard = new AdminAuthGuard(mockTokenService as TokenService);
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const request = {
      headers: {
        authorization: authHeader,
      },
      user: null as any,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should throw UnauthorizedException if authorization header is missing', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if authorization header is empty', () => {
    const context = createMockContext('   ');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user role is not ADMIN', () => {
    (mockTokenService.verifyAccessToken as jest.Mock).mockReturnValue({
      sub: 1,
      role: 'USER',
    });
    const context = createMockContext('Bearer user-token');
    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Only administrators can access this resource'),
    );
  });

  it('should allow access and set request.user when user role is ADMIN', () => {
    const mockUser = { sub: 99, role: 'ADMIN', email: 'admin@datemate.com' };
    (mockTokenService.verifyAccessToken as jest.Mock).mockReturnValue(mockUser);

    const context = createMockContext('Bearer valid-admin-token');
    const result = guard.canActivate(context);

    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual(mockUser);
    expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
      'valid-admin-token',
    );
  });
});
