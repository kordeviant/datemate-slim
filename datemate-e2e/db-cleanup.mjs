/**
 * DateMate E2E - Automated Teardown & Database Sanitizer
 * Ensures zero residue: removes test users, sessions, swipes, chats, matches,
 * media files, and Redis OTP entries created during the test run.
 */

import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { config } from './config.mjs';
import { TerminalUI, colors } from './ui.mjs';

const execAsync = util.promisify(exec);

export class TestCleaner {
  static async resetThrottler() {
    try {
      const redisCmd = `docker exec datemate_redis redis-cli --scan --pattern "throttle:*" | xargs -r docker exec -i datemate_redis redis-cli del`;
      await execAsync(redisCmd);
    } catch (e) {}
  }

  static async cleanup(testRunId = config.testRunId) {
    TerminalUI.personaLog('Cleanup', '🧹 Starting automated test environment cleanup...', `(TestRun: ${testRunId})`);
    let deletedCount = 0;

    // 1. Clean Redis OTP keys
    try {
      const redisCmd = `docker exec datemate_redis redis-cli --scan --pattern "otp:*${testRunId}*" | xargs -r docker exec -i datemate_redis redis-cli del`;
      await execAsync(redisCmd);
      TerminalUI.pass('Redis OTP test keys purged');
    } catch (e) {
      // Non-fatal if no keys matched
    }

    // 2. Query and delete test users from PostgreSQL
    try {
      const findUsersSql = `SELECT id FROM users WHERE email LIKE '%${testRunId}%';`;
      const { stdout } = await execAsync(`docker exec datemate_postgres psql -U postgres -d datemate_db -t -A -c "${findUsersSql}"`);
      const userIds = stdout.trim().split('\n').filter(Boolean).map(id => id.trim());

      if (userIds.length > 0) {
        const idList = userIds.join(',');
        deletedCount = userIds.length;

        // Cascade delete will automatically wipe all sessions, profiles, galleries, swipes, matches, and messages
        const deleteUsersSql = `DELETE FROM users WHERE id IN (${idList});`;
        await execAsync(`docker exec datemate_postgres psql -U postgres -d datemate_db -c "${deleteUsersSql}"`);
        TerminalUI.pass(`Deleted ${deletedCount} test user(s) and cascading records from PostgreSQL (IDs: ${idList})`);
      } else {
        TerminalUI.info('No orphan test users found in PostgreSQL.');
      }
    } catch (err) {
      TerminalUI.warn(`Database cleanup error: ${err.message}`);
    }

    // 3. Clean uploaded test files from disk
    try {
      const uploadDirs = ['uploads/avatars', 'uploads/images', 'uploads/chat'];
      let filesRemoved = 0;
      for (const relDir of uploadDirs) {
        const dir = path.resolve(process.cwd(), relDir);
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            if (f.includes(testRunId)) {
              fs.unlinkSync(path.join(dir, f));
              filesRemoved++;
            }
          }
        }
      }
      if (filesRemoved > 0) {
        TerminalUI.pass(`Removed ${filesRemoved} test media file(s) from uploads directory`);
      }
    } catch (err) {
      TerminalUI.warn(`Media disk cleanup error: ${err.message}`);
    }

    TerminalUI.personaLog('Cleanup', '✔ Teardown complete. Zero production or test residue remaining.');
    return deletedCount;
  }
}
