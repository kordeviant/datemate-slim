import { DocsProtectionMiddleware } from './docs-protection.middleware';
import { ConfigService } from '@nestjs/config';

describe('DocsProtectionMiddleware', () => {
  let middleware: DocsProtectionMiddleware;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        switch (key) {
          case 'DOCS_IP_WHITELIST_ENABLED':
            return 'false';
          case 'DOCS_ALLOWED_IPS':
            return '127.0.0.1,::1';
          case 'DOCS_AUTH_ENABLED':
            return 'true';
          case 'DOCS_USERNAME':
            return 'admin';
          case 'DOCS_PASSWORD':
            return 'secret123';
          default:
            return defaultValue;
        }
      }),
    } as any;

    middleware = new DocsProtectionMiddleware(mockConfigService);

    mockReq = {
      path: '/docs',
      url: '/docs',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('Route Filtering', () => {
    it('passes through immediately for non-docs routes', () => {
      mockReq.path = '/v1/users/me';
      mockReq.url = '/v1/users/me';

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('identifies docs and rules routes correctly', () => {
      expect(middleware.isDocsOrRulesRoute('/docs')).toBe(true);
      expect(middleware.isDocsOrRulesRoute('/docs/')).toBe(true);
      expect(middleware.isDocsOrRulesRoute('/docs/rules')).toBe(true);
      expect(middleware.isDocsOrRulesRoute('/docs-json')).toBe(true);
      expect(middleware.isDocsOrRulesRoute('/rules')).toBe(true);
      expect(middleware.isDocsOrRulesRoute('/v1/rules')).toBe(true);
      expect(middleware.isDocsOrRulesRoute('/v1/docs')).toBe(true);
      expect(middleware.isDocsOrRulesRoute('/v1/docs/rules')).toBe(true);
      expect(middleware.isDocsOrRulesRoute('/v1/users/profile')).toBe(false);
      expect(middleware.isDocsOrRulesRoute('/health')).toBe(false);
    });

    it('skips checks if _docsProtectionPassed flag is already present', () => {
      mockReq._docsProtectionPassed = true;

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockConfigService.get).not.toHaveBeenCalled();
    });
  });

  describe('IP Whitelisting', () => {
    it('bypasses IP check when DOCS_IP_WHITELIST_ENABLED is false', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'DOCS_IP_WHITELIST_ENABLED') return 'false';
        if (key === 'DOCS_AUTH_ENABLED') return 'false';
        return defaultValue;
      });

      mockReq.ip = '203.0.113.195'; // External non-whitelisted IP
      middleware.use(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('blocks unauthorized IP with 403 Forbidden when DOCS_IP_WHITELIST_ENABLED is true', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DOCS_IP_WHITELIST_ENABLED') return 'true';
        if (key === 'DOCS_ALLOWED_IPS') return '127.0.0.1,::1';
        return undefined;
      });

      mockReq.ip = '203.0.113.195';
      mockReq.socket.remoteAddress = '203.0.113.195';

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('not whitelisted'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('allows whitelisted IP when DOCS_IP_WHITELIST_ENABLED is true', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DOCS_IP_WHITELIST_ENABLED') return 'true';
        if (key === 'DOCS_ALLOWED_IPS') return '192.168.1.100,127.0.0.1';
        if (key === 'DOCS_AUTH_ENABLED') return 'false';
        return undefined;
      });

      mockReq.ip = '192.168.1.100';

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('normalizes IPv6-mapped IPv4 addresses (::ffff:127.0.0.1)', () => {
      expect(middleware.normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
      expect(middleware.normalizeIp('::1')).toBe('127.0.0.1');
      expect(middleware.normalizeIp('192.168.1.1:8080')).toBe('192.168.1.1');
    });
  });

  describe('HTTP Basic Authentication', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DOCS_IP_WHITELIST_ENABLED') return 'false';
        if (key === 'DOCS_AUTH_ENABLED') return 'true';
        if (key === 'DOCS_USERNAME') return 'admin';
        if (key === 'DOCS_PASSWORD') return 'secret123';
        return undefined;
      });
    });

    it('prompts for credentials with 401 and WWW-Authenticate header when Authorization header is missing', () => {
      mockReq.headers = {};

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        'Basic realm="DateMate Documentation", charset="UTF-8"',
      );
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 when invalid credentials are provided', () => {
      const wrongCredentials = Buffer.from('admin:wrongpassword').toString('base64');
      mockReq.headers = { authorization: `Basic ${wrongCredentials}` };

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        expect.stringContaining('Basic realm'),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('allows access and calls next() when valid credentials are provided', () => {
      const validCredentials = Buffer.from('admin:secret123').toString('base64');
      mockReq.headers = { authorization: `Basic ${validCredentials}` };

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq._docsProtectionPassed).toBe(true);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('bypasses Basic Auth when DOCS_AUTH_ENABLED is false', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DOCS_IP_WHITELIST_ENABLED') return 'false';
        if (key === 'DOCS_AUTH_ENABLED') return 'false';
        return undefined;
      });

      mockReq.headers = {};

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
