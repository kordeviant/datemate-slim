/**
 * Scenario 02: Authentication Lifecycle & Token Management
 * Tests registration, OTP verification via Redis, sign-in, JWT refresh, and negative credential tests.
 */

import { exec } from 'child_process';
import util from 'util';
import { ApiClient } from '../client.mjs';
import { personas } from '../personas.mjs';
import { TerminalUI } from '../ui.mjs';

const execAsync = util.promisify(exec);

async function getRedisOtp(email, maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const cmd = `docker exec datemate_redis redis-cli get "otp:signup:${email.toLowerCase()}"`;
      const { stdout } = await execAsync(cmd);
      const raw = stdout.trim();
      if (raw && raw !== '(nil)') {
        const code = raw.split('|')[0];
        if (code) return code;
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 60));
  }
  throw new Error(`No OTP found in Redis for email ${email} after ${maxAttempts} attempts`);
}

export async function runAuthLifecycleScenario() {
  TerminalUI.section('Scenario 02: Authentication Lifecycle & Verification', '🔐');
  const results = { passed: 0, failed: 0 };
  const clients = {
    alice: new ApiClient('Alice'),
    bob: new ApiClient('Bob'),
    charlie: new ApiClient('Charlie'),
  };

  // 1. Alice SignUp
  try {
    TerminalUI.personaLog('Alice', 'Submitting registration request with email and password...');
    const res = await clients.alice.post('/auth/signup', {
      email: personas.alice.email,
      password: personas.alice.password,
    });

    if (res.status === 200) {
      TerminalUI.pass(`Registration accepted: OTP generated (HTTP 200)`, res.durationMs);
      results.passed++;
    } else {
      throw new Error(`Signup failed with status ${res.status}: ${JSON.stringify(res.data)}`);
    }

    // 2. Retrieve OTP from local Redis test mailbox
    const code = await getRedisOtp(personas.alice.email);
    TerminalUI.personaLog('Alice', `Retrieved OTP from test environment: [${code}]`);

    // 3. Verify OTP and acquire JWT
    TerminalUI.personaLog('Alice', 'Verifying OTP code...');
    const verifyRes = await clients.alice.post('/auth/verify', {
      email: personas.alice.email,
      code,
    });

    const authData = verifyRes.data?.data || verifyRes.data;
    if (verifyRes.status === 200 && authData?.access && authData?.userId) {
      clients.alice.setAuth(authData);
      personas.alice.userId = authData.userId;
      TerminalUI.pass(`Account verified and JWT issued (UserID: ${authData.userId}, Role: ${authData.role})`, verifyRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Verification failed with status ${verifyRes.status}: ${JSON.stringify(verifyRes.data)}`);
    }

    // 4. Test Sign In
    TerminalUI.personaLog('Alice', 'Testing fresh sign-in with credentials...');
    const signInRes = await clients.alice.post('/auth/signin', {
      email: personas.alice.email,
      password: personas.alice.password,
    });
    if (signInRes.status === 200 && (signInRes.data?.data?.access || signInRes.data?.access)) {
      TerminalUI.pass('Sign-in successful, tokens re-issued (HTTP 200)', signInRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Sign-in failed with status ${signInRes.status}`);
    }

    // 5. Test Token Refresh
    TerminalUI.personaLog('Alice', 'Testing token refresh rotation...');
    const refreshRes = await clients.alice.post('/auth/refresh', {
      refreshToken: clients.alice.refreshToken,
    });
    if (refreshRes.status === 200 && (refreshRes.data?.data?.access || refreshRes.data?.access)) {
      const refreshed = refreshRes.data?.data || refreshRes.data;
      clients.alice.accessToken = refreshed.access || refreshed.accessToken;
      TerminalUI.pass('Access token successfully rotated via refresh token (HTTP 200)', refreshRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Refresh failed with status ${refreshRes.status}`);
    }

    // 6. Negative Test: Bad Password
    TerminalUI.personaLog('Alice', 'Validating rejection on invalid password (negative test)...');
    const badAuthRes = await clients.alice.post('/auth/signin', {
      email: personas.alice.email,
      password: 'DefinitivelyWrongPassword_401!',
    });
    if (badAuthRes.status === 401 || badAuthRes.status === 400) {
      TerminalUI.pass(`Invalid credentials correctly rejected with HTTP ${badAuthRes.status}`, badAuthRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Expected HTTP 401/400 for bad password, received ${badAuthRes.status}`);
    }
  } catch (err) {
    TerminalUI.fail('Alice auth lifecycle encountered an error', err);
    results.failed++;
  }

  // Helper to register Bob and Charlie seamlessly
  for (const [personaKey, persona] of Object.entries({ bob: personas.bob, charlie: personas.charlie })) {
    const client = clients[personaKey];
    try {
      TerminalUI.personaLog(persona.name, `Registering and onboarding test user ${persona.name}...`);
      await client.post('/auth/signup', {
        email: persona.email,
        password: persona.password,
      });

      const code = await getRedisOtp(persona.email);
      const verifyRes = await client.post('/auth/verify', {
        email: persona.email,
        code,
      });

      const authData = verifyRes.data?.data || verifyRes.data;
      if (verifyRes.status !== 200 || !authData?.userId) {
        throw new Error(`Verification failed with status ${verifyRes.status}: ${JSON.stringify(verifyRes.data)}`);
      }
      client.setAuth(authData);
      persona.userId = authData.userId;
      TerminalUI.pass(`${persona.name} verified and active (UserID: ${authData.userId})`);
      results.passed++;
    } catch (err) {
      TerminalUI.fail(`Failed onboarding ${persona.name}`, err);
      results.failed++;
    }
  }

  return { results, clients };
}
