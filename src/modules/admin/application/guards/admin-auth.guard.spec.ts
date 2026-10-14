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

  it('should throw UnauthorizedException if authorization header is missing', async () => {
    const context = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if authorization header is empty', async () => {
    const context = createMockContext('   ');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user role is not ADMIN', async () => {
    (mockTokenService.verifyAccessToken as jest.Mock).mockResolvedValue({
      sub: 1,
      role: 'USER',
    });
    const context = createMockContext('Bearer user-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Only administrators can access this resource'),
    );
  });

  it('should allow access and set request.user when user role is ADMIN', async () => {
    const mockUser = { sub: 99, role: 'ADMIN', email: 'admin@datemate.com' };
    (mockTokenService.verifyAccessToken as jest.Mock).mockResolvedValue(mockUser);

    const context = createMockContext('Bearer valid-admin-token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual(mockUser);
    expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
      'valid-admin-token',
    );
  });
});
