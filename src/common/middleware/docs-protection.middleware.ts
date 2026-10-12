import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class DocsProtectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DocsProtectionMiddleware.name);

  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // If protection has already passed in an earlier middleware layer, proceed
    if ((req as any)._docsProtectionPassed) {
      return next();
    }

    const rawPath =
      req.originalUrl ||
      (req.baseUrl ? req.baseUrl + (req.path || '') : '') ||
      req.path ||
      req.url ||
      '';
    const requestPath = rawPath.split('?')[0];

    // Only protect docs and rules routes
    if (!this.isDocsOrRulesRoute(requestPath)) {
      return next();
    }

    // 1. IP Whitelisting Check
    const isIpWhitelistEnabled =
      String(
        this.configService.get<string>('DOCS_IP_WHITELIST_ENABLED', 'false'),
      ).toLowerCase() === 'true';

    if (isIpWhitelistEnabled) {
      const allowedIpsRaw =
        this.configService.get<string>('DOCS_ALLOWED_IPS') ||
        this.configService.get<string>('DOCS_IP_WHITELIST') ||
        '127.0.0.1,::1';

      const allowedIps = allowedIpsRaw
        .split(',')
        .map((ip) => this.normalizeIp(ip.trim()))
        .filter(Boolean);

      const clientIp = this.getClientIp(req);

      const isWhitelisted =
        allowedIps.includes('*') ||
        allowedIps.includes(clientIp) ||
        (clientIp === '127.0.0.1' && allowedIps.includes('::1')) ||
        (clientIp === '::1' && allowedIps.includes('127.0.0.1'));

      if (!isWhitelisted) {
        this.logger.warn(
          `[Docs Protection] Access denied for IP ${clientIp} to ${requestPath} (not in whitelist)`,
        );
        res.status(403).json({
          status: 'error',
          message:
            'Access denied: Your IP is not whitelisted to access documentation',
        });
        return;
      }
    }

    // 2. HTTP Basic Auth Check (Username & Password)
    const isAuthEnabled =
      String(
        this.configService.get<string>('DOCS_AUTH_ENABLED', 'true'),
      ).toLowerCase() === 'true';

    const expectedUsername =
      this.configService.get<string>('DOCS_USERNAME') ||
      this.configService.get<string>('DOCS_AUTH_USERNAME');
    const expectedPassword =
      this.configService.get<string>('DOCS_PASSWORD') ||
      this.configService.get<string>('DOCS_AUTH_PASSWORD');

    if (isAuthEnabled && expectedUsername && expectedPassword) {
      const authHeader = req.headers['authorization'];

      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader(
          'WWW-Authenticate',
          'Basic realm="DateMate Documentation", charset="UTF-8"',
        );
        res.status(401).json({
          status: 'error',
          message: 'Access denied: Authentication required for documentation',
        });
        return;
      }

      const credentialsBase64 = authHeader.slice(6).trim();
      let decoded = '';
      try {
        decoded = Buffer.from(credentialsBase64, 'base64').toString('utf8');
      } catch {
        res.setHeader(
          'WWW-Authenticate',
          'Basic realm="DateMate Documentation", charset="UTF-8"',
        );
        res.status(401).json({
          status: 'error',
          message: 'Access denied: Invalid authentication format',
        });
        return;
      }

      const colonIndex = decoded.indexOf(':');
      if (colonIndex === -1) {
        res.setHeader(
          'WWW-Authenticate',
          'Basic realm="DateMate Documentation", charset="UTF-8"',
        );
        res.status(401).json({
          status: 'error',
          message: 'Access denied: Invalid credentials format',
        });
        return;
      }

      const username = decoded.slice(0, colonIndex);
      const password = decoded.slice(colonIndex + 1);

      if (username !== expectedUsername || password !== expectedPassword) {
        this.logger.warn(
          `[Docs Protection] Invalid credentials attempt for user "${username}" on ${requestPath}`,
        );
        res.setHeader(
          'WWW-Authenticate',
          'Basic realm="DateMate Documentation", charset="UTF-8"',
        );
        res.status(401).json({
          status: 'error',
          message: 'Access denied: Invalid documentation credentials',
        });
        return;
      }
    }

    // Mark request as passed
    (req as any)._docsProtectionPassed = true;
    return next();
  }

  /**
   * Checks whether the request path matches any documentation or rules routes.
   */
  isDocsOrRulesRoute(urlPath: string): boolean {
    const normalized = urlPath.replace(/\/+$/, '').toLowerCase();
    return (
      normalized === '/docs' ||
      normalized.startsWith('/docs/') ||
      normalized === '/docs-json' ||
      normalized.startsWith('/docs-json') ||
      normalized === '/rules' ||
      normalized.startsWith('/rules/') ||
      normalized === '/v1/docs' ||
      normalized.startsWith('/v1/docs/') ||
      normalized === '/v1/docs-json' ||
      normalized.startsWith('/v1/docs-json') ||
      normalized === '/v1/rules' ||
      normalized.startsWith('/v1/rules/')
    );
  }

  /**
   * Extracts and normalizes the client IP address from request headers or socket.
   */
  getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      const firstIp = forwardedStr.split(',')[0].trim();
      if (firstIp) return this.normalizeIp(firstIp);
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      const realIpStr = Array.isArray(realIp) ? realIp[0] : realIp;
      if (realIpStr) return this.normalizeIp(realIpStr.trim());
    }

    return this.normalizeIp(req.ip || req.socket?.remoteAddress || '');
  }

  /**
   * Normalizes IP string (removes IPv6-mapped IPv4 prefix and port numbers).
   */
  normalizeIp(ip: string): string {
    if (!ip) return '';

    let clean = ip.trim();

    // Strip IPv6-mapped IPv4 prefix (e.g. "::ffff:127.0.0.1" -> "127.0.0.1")
    if (clean.startsWith('::ffff:')) {
      clean = clean.slice(7);
    }

    // Strip port if formatted like IPv4:port
    if (clean.includes('.') && clean.includes(':')) {
      clean = clean.split(':')[0];
    }

    if (clean === '::1') {
      return '127.0.0.1';
    }

    return clean;
  }
}
