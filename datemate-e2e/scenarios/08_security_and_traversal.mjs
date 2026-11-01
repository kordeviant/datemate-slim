/**
 * Scenario 08: Security Guards, Path Traversal & Infrastructure Resilience
 * Tests directory traversal attacks, unauthorized route guards, and session terminations.
 */

import { ApiClient } from '../client.mjs';
import { TerminalUI } from '../ui.mjs';

export async function runSecurityAndTraversalScenario(clients) {
  TerminalUI.section('Scenario 08: Security Guards & Path Traversal Resilience', '🛡️');
  const results = { passed: 0, failed: 0 };
  const anonymousClient = new ApiClient('System');
  const { alice } = clients;

  // 1. Path Traversal on Media Engine
  try {
    TerminalUI.personaLog('System', 'Probing path traversal exploit on static asset server (/assets/../../etc/passwd)...');
    const attackRes = await anonymousClient.get('/assets/images/../../../../etc/passwd');
    if (attackRes.status === 400 || attackRes.status === 404) {
      TerminalUI.pass(`Path traversal successfully blocked with HTTP ${attackRes.status}`, attackRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Security breach: path traversal returned status ${attackRes.status}`);
    }

    // Encoded traversal
    TerminalUI.personaLog('System', 'Probing URL-encoded path traversal exploit (%2e%2e%2f)...');
    const encAttackRes = await anonymousClient.get('/assets/avatars/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    if (encAttackRes.status === 400 || encAttackRes.status === 404) {
      TerminalUI.pass(`Encoded traversal attempt rejected with HTTP ${encAttackRes.status}`, encAttackRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Security breach: encoded traversal returned status ${encAttackRes.status}`);
    }

    // 2. Unauthorized Route Guards
    TerminalUI.personaLog('System', 'Testing protected route /v1/users/me without Authorization token...');
    const unauthRes = await anonymousClient.get('/v1/users/me');
    if (unauthRes.status === 401) {
      TerminalUI.pass('Unauthorized request correctly blocked with HTTP 401', unauthRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Expected HTTP 401, received ${unauthRes.status}`);
    }

    // 3. Forged JWT Token
    TerminalUI.personaLog('System', 'Testing protected route with malformed/forged JWT signature...');
    const forgedClient = new ApiClient('System');
    forgedClient.accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiZmFrZUBmYWtlLmNvbSJ9.badSignature1234567890';
    const forgedRes = await forgedClient.get('/v1/users/me');
    if (forgedRes.status === 401) {
      TerminalUI.pass('Forged JWT signature safely rejected with HTTP 401', forgedRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Expected HTTP 401 for forged token, received ${forgedRes.status}`);
    }

    // 4. Session Device Termination
    TerminalUI.personaLog('Alice', 'Testing device session management (/v1/users/devices)...');
    const devicesRes = await alice.get('/v1/users/devices');
    if (devicesRes.status === 200) {
      TerminalUI.pass('User active sessions list retrieved (HTTP 200)', devicesRes.durationMs);
      results.passed++;
    }
  } catch (err) {
    TerminalUI.fail('Security scenario error', err);
    results.failed++;
  }

  return results;
}
