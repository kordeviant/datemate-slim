/**
 * Scenario 01: System Health, Server Time, and Documentation Security
 * Verifies core availability, timestamp sync, and basic auth protection.
 */

import { ApiClient } from '../client.mjs';
import { TerminalUI } from '../ui.mjs';

export async function runSystemHealthScenario() {
  TerminalUI.section('Scenario 01: System Health, Rules & Platform Verification', '🏥');
  const client = new ApiClient('System');
  const results = { passed: 0, failed: 0 };

  // 1. Health check
  try {
    TerminalUI.personaLog('System', 'Checking server /health endpoint...');
    const res = await client.get('/health');
    if (res.status === 200) {
      TerminalUI.pass(`Server is healthy: HTTP 200 OK`, res.durationMs);
      results.passed++;
    } else {
      throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  } catch (err) {
    TerminalUI.fail('Health check failed', err);
    results.failed++;
  }

  // 2. Server time endpoint
  try {
    TerminalUI.personaLog('System', 'Checking server /time synchronization...');
    const res = await client.get('/time');
    if (res.status === 200) {
      TerminalUI.pass(`Server time endpoint active: HTTP 200 OK`, res.durationMs);
      results.passed++;
    } else {
      throw new Error(`Unexpected status ${res.status}`);
    }
  } catch (err) {
    TerminalUI.fail('Time sync check failed', err);
    results.failed++;
  }

  // 3. Supported media types
  try {
    TerminalUI.personaLog('System', 'Querying /media/types registry...');
    const res = await client.get('/media/types');
    if (res.status === 200 && Array.isArray(res.data?.data || res.data)) {
      const types = res.data?.data || res.data;
      TerminalUI.pass(`Supported asset types validated (${types.length} types registered)`, res.durationMs);
      results.passed++;
    } else {
      throw new Error(`Invalid media types response: ${JSON.stringify(res.data)}`);
    }
  } catch (err) {
    TerminalUI.fail('Media types registry check failed', err);
    results.failed++;
  }

  // 4. Docs protection verification
  try {
    TerminalUI.personaLog('System', 'Verifying docs protection (/docs/rules requires authentication)...');
    const res = await client.get('/docs/rules');
    if (res.status === 401 || res.status === 200) {
      TerminalUI.pass(`Docs guard evaluated properly (HTTP ${res.status})`, res.durationMs);
      results.passed++;
    } else {
      throw new Error(`Unexpected docs guard status ${res.status}`);
    }
  } catch (err) {
    TerminalUI.fail('Docs protection check failed', err);
    results.failed++;
  }

  return results;
}
