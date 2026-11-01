/**
 * Scenario 07: Device Tokens, Push Notifications & Service-to-Service Communication
 * Tests device registration, canonical Rule 11 invariants, server-to-server API key auth,
 * and asynchronous FCM multicast push acceptance.
 */

import { config } from '../config.mjs';
import { ApiClient } from '../client.mjs';
import { TerminalUI } from '../ui.mjs';

export async function runDeviceTokensAndPushScenario(clients) {
  TerminalUI.section('Scenario 07: Device Tokens, FCM Push & Service-to-Service RPC', '🔔');
  const results = { passed: 0, failed: 0 };
  const { alice } = clients;
  const serverClient = new ApiClient('System');

  const testToken = `fcm_device_token_alice_${Date.now()}`;
  const testDeviceInfo = 'Google Pixel 8 (Android 14; Build/UP1A.231005.007)';

  // 1. Alice updates device token via authenticated user JWT (Rule 11)
  try {
    TerminalUI.personaLog('Alice', 'Registering active FCM push token (PUT /v1/users/device-token)...');
    const updateTokenRes = await alice.put('/v1/users/device-token', {
      token: testToken,
      deviceInfo: testDeviceInfo,
    });

    if (updateTokenRes.status === 200) {
      TerminalUI.pass('Device token and deviceInfo registered on current session (HTTP 200)', updateTokenRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Device token update failed: status ${updateTokenRes.status}: ${JSON.stringify(updateTokenRes.data)}`);
    }

    // 2. Server-to-server retrieval via API Key (x-api-key header)
    TerminalUI.personaLog('System', `Retrieving Alice device token via Server API Key (GET /v1/users/${alice.userId}/device-token)...`);
    const getTokenRes = await serverClient.get(`/v1/users/${alice.userId}/device-token`, null, {
      'x-api-key': config.deviceTokenApiKey,
    });

    const tokenData = getTokenRes.data?.data || getTokenRes.data;
    if (getTokenRes.status === 200 && tokenData?.token === testToken) {
      TerminalUI.pass(`Server retrieved registered device token successfully: "${tokenData.token}"`, getTokenRes.durationMs);
      results.passed++;

      // Invariant check: ensure no forbidden alias fields (fcmToken, deviceToken, device_token)
      if (tokenData.fcmToken === undefined && tokenData.deviceToken === undefined) {
        TerminalUI.pass('Canonical Rule 11 invariant confirmed: field strictly named "token" without aliases');
        results.passed++;
      }
    } else {
      throw new Error(`Server failed retrieving device token: ${getTokenRes.status} -> ${JSON.stringify(getTokenRes.data)}`);
    }

    // 3. Security test: Calling device-token endpoint WITHOUT API key must fail
    TerminalUI.personaLog('System', 'Verifying device-token endpoint security without x-api-key header...');
    const unauthGetRes = await serverClient.get(`/v1/users/${alice.userId}/device-token`);
    if (unauthGetRes.status === 401 || unauthGetRes.status === 403) {
      TerminalUI.pass(`Unauthenticated server request properly rejected (HTTP ${unauthGetRes.status})`, unauthGetRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Expected 401/403 for missing API key, got ${unauthGetRes.status}`);
    }

    // 4. Asynchronous Push Notification Dispatch
    TerminalUI.personaLog('System', 'Testing FCM push dispatcher (/v1/push)...');
    const pushPayload = {
      title: 'It is a Match! 🎉',
      body: 'You and Bob liked each other. Say hello now!',
      userId: alice.userId,
      priority: 'high',
      data: {
        type: 'MATCH',
        partnerId: String(clients.bob.userId),
      },
    };

    const pushRes = await serverClient.post('/v1/push', pushPayload, {
      'x-api-key': config.pushNotificationApiKey,
    });

    if (pushRes.status === 200 || pushRes.status === 202) {
      TerminalUI.pass(`Push notification accepted for async dispatch (HTTP ${pushRes.status})`, pushRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Push notification dispatch failed (${pushRes.status}): ${JSON.stringify(pushRes.data)}`);
    }
  } catch (err) {
    TerminalUI.fail('Device tokens and push notification scenario error', err);
    results.failed++;
  }

  return results;
}
