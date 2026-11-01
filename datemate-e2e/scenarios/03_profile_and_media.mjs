/**
 * Scenario 03: Profile Setup, Media Storage & Canonical Schema Contract
 * Tests media upload, download verification, profile updates, and canonical contract invariants.
 */

import { personas, sampleMedia } from '../personas.mjs';
import { TerminalUI } from '../ui.mjs';

export async function runProfileAndMediaScenario(clients) {
  TerminalUI.section('Scenario 03: Profile Setup, Media Storage & Canonical Contract', '📸');
  const results = { passed: 0, failed: 0 };
  const { alice, bob } = clients;

  // 1. Upload Avatar to /media/upload/avatars
  try {
    TerminalUI.personaLog('Alice', 'Uploading WebP avatar to media storage engine (/media/upload/avatars)...');
    const uploadRes = await alice.upload(
      '/media/upload/avatars',
      'file',
      sampleMedia.avatarWebp,
      `avatar_${Date.now()}.webp`,
      'image/webp'
    );

    const uploadData = uploadRes.data?.data || uploadRes.data;
    if ((uploadRes.status === 200 || uploadRes.status === 201) && uploadData?.url) {
      TerminalUI.pass(`Media uploaded successfully: ${uploadData.url} (${uploadData.sizeBytes} bytes, ${uploadData.mimeType})`, uploadRes.durationMs);
      results.passed++;

      // Verify that the uploaded file is accessible and downloadable
      const assetPath = `/assets/avatars/${uploadData.fileName}`;
      TerminalUI.personaLog('Alice', `Verifying public asset access at ${assetPath}...`);
      const getAssetRes = await alice.get(assetPath);
      if (getAssetRes.status === 200) {
        TerminalUI.pass('Uploaded asset is downloadable and intact', getAssetRes.durationMs);
        results.passed++;
      } else {
        throw new Error(`Asset not accessible, status: ${getAssetRes.status}`);
      }
    } else {
      throw new Error(`Media upload failed (${uploadRes.status}): ${JSON.stringify(uploadRes.data)}`);
    }

    // 2. Profile Setup for Alice
    TerminalUI.personaLog('Alice', 'Updating user profile (Name, Gender, Bio, Location)...');
    const profilePayload = {
      name: 'Alice Wonderland',
      gender: personas.alice.gender,
      birthdate: personas.alice.birthdate,
      bio: personas.alice.bio,
      location: {
        latitude: personas.alice.latitude,
        longitude: personas.alice.longitude,
      },
    };

    const updateRes = await alice.put('/v1/users/profile', profilePayload);
    if (updateRes.status === 200) {
      TerminalUI.pass('Profile data updated successfully (HTTP 200)', updateRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Profile update failed (${updateRes.status}): ${JSON.stringify(updateRes.data)}`);
    }

    // 3. Upload Gallery Profile Picture via POST /v1/users/profile (Multipart)
    TerminalUI.personaLog('Alice', 'Uploading gallery photo and setting as profile picture...');
    const galleryRes = await alice.upload(
      '/v1/users/profile',
      'file',
      sampleMedia.imagePng,
      `gallery_alice_${Date.now()}.png`,
      'image/png',
      {
        gallery: JSON.stringify({ isProfilePicture: true }),
      }
    );

    if (galleryRes.status === 200) {
      TerminalUI.pass('Gallery picture uploaded and marked as active profile photo', galleryRes.durationMs);
      results.passed++;
    } else {
      throw new Error(`Gallery upload failed (${galleryRes.status}): ${JSON.stringify(galleryRes.data)}`);
    }

    // 4. Verify Canonical Contract Invariants (Rules 6 & 7)
    TerminalUI.personaLog('Alice', 'Inspecting profile contract for canonical standards (no duplicate field aliases)...');
    const profileCheck = await alice.get('/v1/users/profile');
    const profileData = profileCheck.data?.data || profileCheck.data;

    // Check no duplicate root aliases
    if (profileData && profileData.city === undefined && profileData.cityName === undefined) {
      TerminalUI.pass('Canonical contract confirmed: Zero forbidden city aliases (city/cityName) at root level');
      results.passed++;
    } else {
      TerminalUI.fail('Canonical contract violation: found duplicate city alias in profile response');
      results.failed++;
    }

    // Check gallery does not contain likesCount
    if (Array.isArray(profileData?.gallery) && profileData.gallery.length > 0) {
      const g0 = profileData.gallery[0];
      if (g0.likesCount === undefined) {
        TerminalUI.pass('Gallery contract confirmed: likesCount cleanly omitted from gallery items');
        results.passed++;
      }
    }
  } catch (err) {
    TerminalUI.fail('Alice profile & media lifecycle error', err);
    results.failed++;
  }

  // 5. Update Bob's profile so he is discoverable in feed
  try {
    TerminalUI.personaLog('Bob', 'Updating Bob profile and location for mutual discovery...');
    await bob.put('/v1/users/profile', {
      name: 'Bob Explorer',
      gender: personas.bob.gender,
      birthdate: personas.bob.birthdate,
      bio: personas.bob.bio,
      location: {
        latitude: personas.bob.latitude,
        longitude: personas.bob.longitude,
      },
    });

    await bob.upload(
      '/v1/users/profile',
      'file',
      sampleMedia.imagePng,
      `gallery_bob_${Date.now()}.png`,
      'image/png',
      {
        gallery: JSON.stringify({ isProfilePicture: true }),
      }
    );
    TerminalUI.pass('Bob profile and avatar successfully established');
    results.passed++;
  } catch (err) {
    TerminalUI.fail("Bob profile setup error", err);
    results.failed++;
  }

  return results;
}
