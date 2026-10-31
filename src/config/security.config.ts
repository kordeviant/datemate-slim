export interface SecurityConfig {
  throttler: {
    ttlMs: number;
    limit: number;
    authLimit: number;
    pushLimit: number;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  docsProtection: {
    enabled: boolean;
    username: string;
    password: string;
    ipWhitelist: string[];
  };
}

export const securityConfig = (): { security: SecurityConfig } => {
  const ipWhitelistRaw = process.env.DOCS_IP_WHITELIST || '';
  const ipWhitelist = ipWhitelistRaw
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  return {
    security: {
      throttler: {
        ttlMs: parseInt(process.env.THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '120', 10),
        authLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT || '15', 10),
        pushLimit: parseInt(process.env.THROTTLE_PUSH_LIMIT || '300', 10),
      },
      jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'access_secret',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      },
      docsProtection: {
        enabled: process.env.DOCS_PROTECTION_ENABLED === 'true',
        username: process.env.DOCS_USERNAME || 'admin',
        password: process.env.DOCS_PASSWORD || 'datemate_secret',
        ipWhitelist,
      },
    },
  };
};
