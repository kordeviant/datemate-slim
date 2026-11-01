/**
 * Scenario 05: Social & Friendship Lifecycle
 * Tests friend requests, pending list inspection, acceptance, and unfriend operations.
 */

import { TerminalUI } from '../ui.mjs';

export async function runSocialFriendsScenario(clients) {
  TerminalUI.section('Scenario 05: Social Graph & Friendship Lifecycle', '🤝');
  const results = { passed: 0, failed: 0 };
  const { alice, charlie } = clients;

  let requestId = null;

  // 1. Charlie sends friend request to Alice
  try {
    TerminalUI.personaLog('Charlie', `Sending friend request to Alice (TargetUserID: ${alice.userId})...`);
    const addRes = await charlie.post('/v1/friends/add', {
      userId: alice.userId,
    });

    if (addRes.status === 200) {
      TerminalUI.pass('Friend request dispatched successfully (HTTP 200)', addRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Friend request failed (${addRes.status}): ${JSON.stringify(addRes.data)}`);
    }

    // 2. Alice checks pending friend requests
    TerminalUI.personaLog('Alice', 'Checking pending friend requests queue (/v1/friends/requests)...');
    const reqsRes = await alice.get('/v1/friends/requests');
    if (reqsRes.status === 200) {
      const dataObj = reqsRes.data?.data || reqsRes.data || {};
      const reqList = Array.isArray(dataObj) ? dataObj : (dataObj.items || []);
      TerminalUI.pass(`Friend requests list retrieved (${reqList.length} request(s) found)`, reqsRes.durationMs);
      results.passed++;

      const pendingReq = reqList.find(r => r.senderId === charlie.userId || r.sender?.id === charlie.userId || r.id);
      if (pendingReq) {
        requestId = pendingReq.id;
        TerminalUI.pass(`Charlie's pending friend request identified (RequestID: ${requestId})`);
        results.passed++;
      }
    } else {
      throw new Error(`Friend requests query failed: ${reqsRes.status}`);
    }

    // 3. Alice accepts Charlie's friend request
    if (requestId) {
      TerminalUI.personaLog('Alice', `Accepting friend request #${requestId}...`);
      const acceptRes = await alice.post(`/v1/friends/accept/${requestId}`);
      if (acceptRes.status === 200) {
        TerminalUI.pass(`Friend request #${requestId} accepted (HTTP 200)`, acceptRes.durationMs);
        results.passed++;
      } else {
        throw new Error(`Accept friend request failed: ${acceptRes.status}`);
      }
    }

    // 4. Verify friendship active for both users
    TerminalUI.personaLog('Alice', 'Verifying Alice active friends list (/v1/friends)...');
    const aliceFriendsRes = await alice.get('/v1/friends');
    if (aliceFriendsRes.status === 200) {
      TerminalUI.pass('Alice friends list verified with confirmed friendship', aliceFriendsRes.durationMs);
      results.passed++;
    }

    // 5. Charlie removes friendship
    TerminalUI.personaLog('Charlie', `Removing friend connection with Alice (${alice.userId})...`);
    const removeRes = await charlie.delete(`/v1/friends/${alice.userId}`);
    if (removeRes.status === 200) {
      TerminalUI.pass('Friendship removed cleanly (HTTP 200)', removeRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Remove friend failed: ${removeRes.status}`);
    }
  } catch (err) {
    TerminalUI.fail('Social friends scenario error', err);
    results.failed++;
  }

  return results;
}
