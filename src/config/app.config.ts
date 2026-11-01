export interface AppConfig {
  port: number;
  environment: string;
  baseUrl: string;
  trustProxy: string | number | boolean;
  cors: {
    origin: boolean | string | string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
  };
}

export const appConfig = (): { app: AppConfig } => {
  const trustProxyRaw = process.env.TRUST_PROXY || 'loopback';
  const parsedTrustProxy = !isNaN(Number(trustProxyRaw))
    ? Number(trustProxyRaw)
    : trustProxyRaw === 'true'
      ? true
      : trustProxyRaw === 'false'
        ? false
        : trustProxyRaw;

  return {
    app: {
      port: parseInt(process.env.PORT || '3000', 10),
      environment: process.env.NODE_ENV || 'development',
      baseUrl: (process.env.BASE_URL || process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, ''),
      trustProxy: parsedTrustProxy,
      cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'Accept',
          'X-Requested-With',
          'x-api-key',
        ],
        exposedHeaders: ['Content-Range', 'X-Content-Range'],
      },
    },
  };
};
