# DateMate E2E Test Suite (`datemate-e2e`)

A dedicated end-to-end test suite for the DateMate ecosystem that simulates real user interactions across Auth, Profile, Discovery, Real-Time Chat, Media Storage, Push Notifications, and Security subsystems.

---

## 🌟 Key Features

1. **Realistic User Personas & Behaviors**:
   - 👩 **Alice** (`e2e_alice_<runId>@datemate.internal`): Female user looking for matches, configures profile with WebP avatar & gallery photos, receives likes, matches, and chats.
   - 👨 **Bob** (`e2e_bob_<runId>@datemate.internal`): Male user looking for matches, browses discovery feed, right-swipes Alice to form mutual match, initiates 1-on-1 conversations and uploads chat media.
   - 🧑 **Charlie** (`e2e_charlie_<runId>@datemate.internal`): Social friend persona, tests friend requests, acceptance, and friend graph management.
   - ⚙️ **System / Admin**: Validates infrastructure endpoints (`/health`, `/time`, `/docs/rules`), verifies service-to-service RPC with Server API Keys, dispatches FCM pushes, and runs security / path traversal tests.
   - 🧹 **Cleanup**: Automatically cleans up all synthetic test data.

2. **Strict Isolation & Zero Production Data**:
   - Each test run generates a unique `testRunId` (e.g. `e2e_1793532061951_7u485`).
   - All test users, media, and Redis keys are scoped exclusively to this `testRunId`.
   - Never touches or relies on existing or production user data.

3. **Guaranteed Automated Teardown**:
   - Automatically executed via a `finally` block even if any test fails or aborts.
   - Deletes all created test users from PostgreSQL (cascading across profiles, likes, matches, conversations, friend requests, device sessions, and notifications).
   - Purges all Redis OTP verification keys (`otp:*<testRunId>*`).
   - Flushes Redis rate limiting buckets (`throttle:*`) preventing test throttling.
   - Deletes uploaded test media files from storage.

4. **Rich Terminal UI & Real-Time Logging**:
   - Color-coded persona badges (`[ALICE]`, `[BOB]`, `[CHARLIE]`, `[SYSTEM]`, `[CLEANUP]`).
   - Real-time logging of user actions with HTTP status codes and exact latency in milliseconds.
   - Scenario section headers and assertion status indicators (`✔`, `✘`, `⚠️`).
   - Final ANSI summary table detailing pass/fail counts and duration per scenario.

5. **Canonical Contract & Backend Invariant Validation**:
   - **Rule 6**: Confirms zero duplicate or alias city fields (`city`, `cityName`) in user profile payloads.
   - **Rule 7**: Tests single-image gallery uploads and profile picture assignment.
   - **Rule 10**: Validates discovery eligibility based on `profileValidated == true` without requiring `selfieUrl`.
   - **Rule 11**: Confirms device token API invariants (strictly `token` and `deviceInfo`).

---

## 📁 Test Scenarios

| Scenario | File | Description |
| :--- | :--- | :--- |
| **01. System Health** | `scenarios/01_system_health.mjs` | Verifies `/health`, server `/time`, `/media/types`, and basic auth rules. |
| **02. Auth Lifecycle** | `scenarios/02_auth_lifecycle.mjs` | Signup, Redis OTP extraction, email verification, sign-in, token refresh rotation, and invalid credential rejection. |
| **03. Profile & Media** | `scenarios/03_profile_and_media.mjs` | Avatar upload (WebP >10KB), asset downloading, profile updates, gallery upload, and contract compliance. |
| **04. Discovery & Matching** | `scenarios/04_discovery_and_matching.mjs` | Feed browsing, flat city schema checks, right swipes (`RIGHT`), likes queue inspection, and mutual match formation. |
| **05. Social & Friends** | `scenarios/05_social_friends.mjs` | Friend request dispatch, pending requests query, acceptance, confirmed friends check, and deletion. |
| **06. Real-Time Chat** | `scenarios/06_realtime_chat.mjs` | Direct conversation creation, message history retrieval, media attachment uploads, and group conversations. |
| **07. Device Tokens & Push** | `scenarios/07_device_tokens_and_push.mjs` | User device token registration (Rule 11), server-to-server retrieval via `x-api-key`, security rejections, and FCM push dispatch. |
| **08. Security & Traversal** | `scenarios/08_security_and_traversal.mjs` | Directory traversal attempts (`../`), forged JWT tokens, unauthenticated route blocks, and active session listing. |

---

## 🚀 Running the Tests

### Quick Start
From the `backend` repository root:
```bash
./run-e2e
```

Or run directly with Node:
```bash
node datemate-e2e/runner.mjs
```

### Environment Configuration
The test runner automatically reads configuration from `.env` in the backend root:
- `API_BASE_URL` (Default: `http://127.0.0.1:2020`)
- `DATABASE_URL` (PostgreSQL connection string for teardown)
- `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (Redis connection for OTP & throttler)
- `SERVER_API_KEY` (Used for privileged service-to-service calls)
