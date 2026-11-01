/**
 * DateMate E2E - Configuration Loader
 * Reads .env file, CLI flags, and provides canonical defaults for local test environment.
 */

import fs from 'fs';
import path from 'path';

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const localEnv = loadEnvFile(path.resolve(process.cwd(), '.env'));

export const config = {
  // Target API Server
  port: process.env.PORT || localEnv.PORT || '2020',
  baseUrl: process.env.BASE_URL || localEnv.BASE_URL || `http://127.0.0.1:${process.env.PORT || localEnv.PORT || '2020'}`,
  chatWsUrl: process.env.CHAT_WS_URL || `http://127.0.0.1:${process.env.PORT || localEnv.PORT || '2020'}`,

  // API Keys for server-to-server endpoints
  deviceTokenApiKey: process.env.DEVICE_TOKEN_API_KEY || localEnv.DEVICE_TOKEN_API_KEY || 'datemate_device_token_api_key_2026',
  pushNotificationApiKey: process.env.PUSH_NOTIFICATION_API_KEY || localEnv.PUSH_NOTIFICATION_API_KEY || 'simple-api-key',

  // Database URL for direct query inspection & reliable test cleanup
  databaseUrl: process.env.DATABASE_URL || localEnv.DATABASE_URL || 'postgresql://postgres:postgrespassword@127.0.0.1:5432/datemate_db?sslmode=disable',

  // Redis configuration
  redisHost: process.env.REDIS_HOST || localEnv.REDIS_HOST || '127.0.0.1',
  redisPort: parseInt(process.env.REDIS_PORT || localEnv.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD ?? localEnv.REDIS_PASSWORD ?? '',

  // Timeouts & Execution
  requestTimeoutMs: 10000,
  wsTimeoutMs: 10000,

  // Unique session prefix to ensure isolated test entities
  testRunId: `e2e_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
};
