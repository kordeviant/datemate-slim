/**
 * DateMate E2E - User Personas & Synthetic Test Fixtures
 * Generates realistic profiles, sample images, questions, and device info.
 */

import { config } from './config.mjs';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Compliant (> 10KB) test media fixtures
export const sampleMedia = {
  avatarWebp: fs.readFileSync(path.join(__dirname, 'test_avatar.webp')),
  imagePng: fs.readFileSync(path.join(__dirname, 'test_avatar.png')),
  iconSvg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff4081"/></svg>', 'utf-8'),
};

export function createPersona(name, gender, birthdate, bio, latitude, longitude) {
  const email = `test_${name.toLowerCase()}_${config.testRunId}@datemate-test.local`;
  const password = `TestPass123!_${config.testRunId}`;

  return {
    name,
    gender,
    birthdate, // YYYY-MM-DD
    email,
    password,
    bio,
    latitude,
    longitude,
    deviceInfo: `DateMate-E2E-Simulator (${name}'s Pixel 8)`,
    fcmToken: `fcm_token_${name.toLowerCase()}_${config.testRunId}`,
  };
}

export const personas = {
  alice: createPersona(
    'Alice',
    'FEMALE',
    '2000-05-15',
    'Photographer and UI designer. Love coffee, indie music, and weekend hikes.',
    35.6892,
    51.3890
  ),
  bob: createPersona(
    'Bob',
    'MALE',
    '1998-08-20',
    'Software engineer and trail runner. Looking for deep conversations and adventures.',
    35.7000,
    51.4000
  ),
  charlie: createPersona(
    'Charlie',
    'MALE',
    '1999-11-10',
    'Architecture student and foodie. Let’s find the best espresso spots!',
    35.6950,
    51.3950
  ),
};
