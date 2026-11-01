#!/usr/bin/env node

/**
 * DateMate E2E - Master Test Orchestrator
 * Simulates real user personas across the entire DateMate ecosystem,
 * renders an interactive terminal UI, and guarantees automated teardown.
 */

import { config } from './config.mjs';
import { TerminalUI, colors } from './ui.mjs';
import { TestCleaner } from './db-cleanup.mjs';

import { runSystemHealthScenario } from './scenarios/01_system_health.mjs';
import { runAuthLifecycleScenario } from './scenarios/02_auth_lifecycle.mjs';
import { runProfileAndMediaScenario } from './scenarios/03_profile_and_media.mjs';
import { runDiscoveryAndMatchingScenario } from './scenarios/04_discovery_and_matching.mjs';
import { runSocialFriendsScenario } from './scenarios/05_social_friends.mjs';
import { runRealtimeChatScenario } from './scenarios/06_realtime_chat.mjs';
import { runDeviceTokensAndPushScenario } from './scenarios/07_device_tokens_and_push.mjs';
import { runSecurityAndTraversalScenario } from './scenarios/08_security_and_traversal.mjs';

async function main() {
  const globalStart = Date.now();

  TerminalUI.banner(
    'DATEMATE END-TO-END ECOSYSTEM TEST SUITE',
    `Target: ${config.baseUrl} | Run ID: ${config.testRunId} | Node: ${process.version}`
  );

  const scenarioReports = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let clients = {};

  try {
    // Reset rate limiter keys before test run so suite never gets throttled
    await TestCleaner.resetThrottler();

    // Scenario 01: System Health & Base Verification
    const s1Start = Date.now();
    const s1Res = await runSystemHealthScenario();
    const s1Duration = Date.now() - s1Start;
    TerminalUI.scenarioEnd(s1Res.failed === 0, s1Duration);
    scenarioReports.push(['01. System Health & Platform', s1Res.passed, s1Res.failed, `${s1Duration}ms`, s1Res.failed === 0 ? `${colors.brightGreen}PASS${colors.reset}` : `${colors.brightRed}FAIL${colors.reset}`]);
    totalPassed += s1Res.passed;
    totalFailed += s1Res.failed;

    // Scenario 02: Auth Lifecycle
    const s2Start = Date.now();
    const s2Res = await runAuthLifecycleScenario();
    const s2Duration = Date.now() - s2Start;
    clients = s2Res.clients;
    TerminalUI.scenarioEnd(s2Res.results.failed === 0, s2Duration);
    scenarioReports.push(['02. Auth & Token Management', s2Res.results.passed, s2Res.results.failed, `${s2Duration}ms`, s2Res.results.failed === 0 ? `${colors.brightGreen}PASS${colors.reset}` : `${colors.brightRed}FAIL${colors.reset}`]);
    totalPassed += s2Res.results.passed;
    totalFailed += s2Res.results.failed;

    // Scenario 03: Profile Setup & Media Storage
    const s3Start = Date.now();
    const s3Res = await runProfileAndMediaScenario(clients);
    const s3Duration = Date.now() - s3Start;
    TerminalUI.scenarioEnd(s3Res.failed === 0, s3Duration);
    scenarioReports.push(['03. Profile & Media Storage', s3Res.passed, s3Res.failed, `${s3Duration}ms`, s3Res.failed === 0 ? `${colors.brightGreen}PASS${colors.reset}` : `${colors.brightRed}FAIL${colors.reset}`]);
    totalPassed += s3Res.passed;
    totalFailed += s3Res.failed;

    // Scenario 04: Discovery & Matching
    const s4Start = Date.now();
    const s4Res = await runDiscoveryAndMatchingScenario(clients);
    const s4Duration = Date.now() - s4Start;
    TerminalUI.scenarioEnd(s4Res.failed === 0, s4Duration);
    scenarioReports.push(['04. Discovery, Feed & Swipes', s4Res.passed, s4Res.failed, `${s4Duration}ms`, s4Res.failed === 0 ? `${colors.brightGreen}PASS${colors.reset}` : `${colors.brightRed}FAIL${colors.reset}`]);
    totalPassed += s4Res.passed;
    totalFailed += s4Res.failed;

    // Scenario 05: Social Graph & Friends
    const s5Start = Date.now();
    const s5Res = await runSocialFriendsScenario(clients);
    const s5Duration = Date.now() - s5Start;
    TerminalUI.scenarioEnd(s5Res.failed === 0, s5Duration);
    scenarioReports.push(['05. Social Graph & Friends', s5Res.passed, s5Res.failed, `${s5Duration}ms`, s5Res.failed === 0 ? `${colors.brightGreen}PASS${colors.reset}` : `${colors.brightRed}FAIL${colors.reset}`]);
    totalPassed += s5Res.passed;
    totalFailed += s5Res.failed;

    // Scenario 06: Real-Time Chat & Multimedia
    const s6Start = Date.now();
    const s6Res = await runRealtimeChatScenario(clients);
    const s6Duration = Date.now() - s6Start;
    TerminalUI.scenarioEnd(s6Res.failed === 0, s6Duration);
    scenarioReports.push(['06. Real-Time Chat & Gateway', s6Res.passed, s6Res.failed, `${s6Duration}ms`, s6Res.failed === 0 ? `${colors.brightGreen}PASS${colors.reset}` : `${colors.brightRed}FAIL${colors.reset}`]);
    totalPassed += s6Res.passed;
    totalFailed += s6Res.failed;

    // Scenario 07: Device Tokens & Push Notifications
    const s7Start = Date.now();
    const s7Res = await runDeviceTokensAndPushScenario(clients);
    const s7Duration = Date.now() - s7Start;
    TerminalUI.scenarioEnd(s7Res.failed === 0, s7Duration);
    scenarioReports.push(['07. Device Tokens & FCM Push', s7Res.passed, s7Res.failed, `${s7Duration}ms`, s7Res.failed === 0 ? `${colors.brightGreen}PASS${colors.reset}` : `${colors.brightRed}FAIL${colors.reset}`]);
    totalPassed += s7Res.passed;
    totalFailed += s7Res.failed;

    // Scenario 08: Security & Path Traversal
    const s8Start = Date.now();
    const s8Res = await runSecurityAndTraversalScenario(clients);
    const s8Duration = Date.now() - s8Start;
    TerminalUI.scenarioEnd(s8Res.failed === 0, s8Duration);
    scenarioReports.push(['08. Security & Traversal Guards', s8Res.passed, s8Res.failed, `${s8Duration}ms`, s8Res.failed === 0 ? `${colors.brightGreen}PASS${colors.reset}` : `${colors.brightRed}FAIL${colors.reset}`]);
    totalPassed += s8Res.passed;
    totalFailed += s8Res.failed;

  } catch (fatalErr) {
    TerminalUI.fail('Fatal execution unhandled exception', fatalErr);
    totalFailed++;
  } finally {
    // Guaranteed Teardown: purge test users and temporary media
    try {
      await TestCleaner.cleanup(config.testRunId);
    } catch (cleanErr) {
      TerminalUI.warn(`Teardown warning: ${cleanErr.message}`);
    }
  }

  const totalDuration = Date.now() - globalStart;

  // Print Summary Table
  TerminalUI.table(
    ['Scenario', 'Passed', 'Failed', 'Duration', 'Result'],
    scenarioReports
  );

  const allPassed = totalFailed === 0;
  const outcomeText = allPassed
    ? `${colors.bold}${colors.brightGreen}✔ ALL TESTS PASSED SUCCESSFULLY! (${totalPassed} assertions verified in ${totalDuration}ms)${colors.reset}`
    : `${colors.bold}${colors.brightRed}✖ TEST SUITE FAILED WITH ${totalFailed} ERROR(S) (${totalPassed} passed, total time: ${totalDuration}ms)${colors.reset}`;

  console.log(`\n${outcomeText}\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
  console.error('Fatal crash:', e);
  process.exit(1);
});
