/**
 * Seed script to populate 3 specific test users for DateMate API:
 * 1. User with avatar, 3 gallery images, and completed profile
 * 2. User with only avatar and completed profile
 * 3. User with avatar and incomplete profile (only username, fullName, BOD, city)
 *
 * Usage: npx ts-node prisma/seed-users.ts
 * or npm run seed:users
 */

import {
  PrismaClient,
  Gender,
  RelationType,
  DrinkStatus,
  SmokeStatus,
  KidsStatus,
  PetsStatus,
  MoodStatus,
  StarSignStatus,
  EducationStatus,
  RelationshipStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function copyProfileImages() {
  const rootDir = process.cwd();
  const sourceDir = path.join(rootDir, 'seed-icons', 'profiles');
  const avatarsDir = path.join(rootDir, 'uploads', 'avatars');
  const imagesDir = path.join(rootDir, 'uploads', 'images');

  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  if (!fs.existsSync(sourceDir)) {
    console.warn(`⚠️ Source profiles directory not found at: ${sourceDir}`);
    return;
  }

  const files = fs.readdirSync(sourceDir);
  let avatarsCopied = 0;
  let imagesCopied = 0;

  for (const file of files) {
    const srcFile = path.join(sourceDir, file);
    if (!fs.statSync(srcFile).isFile()) continue;

    // Copy to avatars
    const destAvatar = path.join(avatarsDir, file);
    fs.copyFileSync(srcFile, destAvatar);
    avatarsCopied++;

    // Copy to images (gallery)
    const destImage = path.join(imagesDir, file);
    fs.copyFileSync(srcFile, destImage);
    imagesCopied++;
  }

  console.log(`📁 Prepared seed images: copied ${avatarsCopied} to uploads/avatars/ and ${imagesCopied} to uploads/images/`);
}

async function getOrCreateCityId(): Promise<number> {
  // Look for Tehran or any available city
  const city =
    (await prisma.city.findFirst({
      where: { name: { contains: 'Tehran', mode: 'insensitive' } },
    })) || (await prisma.city.findFirst());

  if (city) {
    return city.id;
  }

  // Fallback: create country, state, city if geo dataset is empty
  const country = await prisma.country.create({
    data: { name: 'Iran', code: 'IR' },
  });
  const state = await prisma.state.create({
    data: { countryId: country.id, name: 'Tehran' },
  });
  const newCity = await prisma.city.create({
    data: { stateId: state.id, name: 'Tehran' },
  });
  return newCity.id;
}

async function answerAllQuestionsForUser(userId: number) {
  const questions = await prisma.question.findMany({
    include: { answers: true },
  });

  for (const q of questions) {
    if (q.answers.length > 0) {
      const firstAnswer = q.answers[0];
      await prisma.userQuestionAnswer.upsert({
        where: {
          userId_questionAnswerId: {
            userId,
            questionAnswerId: firstAnswer.id,
          },
        },
        create: {
          userId,
          questionAnswerId: firstAnswer.id,
        },
        update: {},
      });
    }
  }
}

async function seedUsers() {
  console.log('🌱 Starting user seeding...');
  copyProfileImages();

  const cityId = await getOrCreateCityId();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // -------------------------------------------------------------
  // USER 1: Avatar + 3 Gallery Images + Completed Profile
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 1: Avatar + 3 Gallery Images + Completed Profile...');
  const user1Email = 'sara.hemati@datemate.com';
  const user1AvatarFile = 'avatarbe9c29b29330.webp';
  const user1GalleryFiles = [
    {
      file: 'photo-1517841905240-472988babdf9.webp',
      desc: 'Exploring mountain trails on the weekend',
    },
    {
      file: 'photo-1524504388940-b1c1722653e1.webp',
      desc: 'Sunny afternoon in the city cafe',
    },
    {
      file: 'photo-1529626455594-4ff0802cfb7e.webp',
      desc: 'Golden hour sunset vibes',
    },
  ];

  let user1 = await prisma.user.findUnique({ where: { email: user1Email } });
  if (user1) {
    // Delete old user to re-seed cleanly
    await prisma.user.delete({ where: { id: user1.id } });
  }

  user1 = await prisma.user.create({
    data: {
      email: user1Email,
      passwordHash,
      role: 'USER',
      language: 'FA',
      profileValidated: true,
      wallet: 150.0,
      score: 4.8,
      profile: {
        create: {
          fullName: 'سارا همتی',
          username: 'sara_h',
          phoneNumber: '+989121111111',
          languages: ['fa', 'en'],
          bio: 'I am a UI/UX Designer passionate about digital art, coffee, and mountain hiking.',
          avatarUrl: `avatars/${user1AvatarFile}`,
          isPrivate: false,
          relationType: RelationType.LONG,
          latitude: 35.6892,
          longitude: 51.389,
          isOnline: true,
          lastSeenAt: new Date(),
        },
      },
      demographic: {
        create: {
          birthDate: new Date('2001-04-15'), // 25 years old
          gender: Gender.FEMALE,
          height: 168,
          weight: 58,
          degree: EducationStatus.BACHELOR_DEGREE,
          job: 'UI/UX Designer',
          relationStatus: RelationshipStatus.SINGLE,
          cityId,
        },
      },
      preferences: {
        create: {
          relation: RelationType.LONG,
          drinking: DrinkStatus.SOCIALLY,
          smoking: SmokeStatus.NO,
          kids: KidsStatus.LOVE_KIDS,
          pets: PetsStatus.CATS,
        },
      },
      personality: {
        create: {
          mood: MoodStatus.EXTROVERT,
          starSign: StarSignStatus.ARIES,
        },
      },
      gallery: {
        create: user1GalleryFiles.map((g) => ({
          imageUrl: `images/${g.file}`,
          description: g.desc,
          likesCount: 12,
        })),
      },
    },
  });

  await answerAllQuestionsForUser(user1.id);
  console.log(`  ✅ User 1 created: ID #${user1.id} (Email: ${user1.email}) with avatar, 3 gallery photos, and completed profile`);

  // -------------------------------------------------------------
  // USER 2: Avatar Only (no gallery) + Completed Profile
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 2: Avatar Only + Completed Profile...');
  const user2Email = 'ali.rezaei@datemate.com';
  const user2AvatarFile = 'photo-1507003211169-0a1dd7228f2d.webp';

  let user2 = await prisma.user.findUnique({ where: { email: user2Email } });
  if (user2) {
    await prisma.user.delete({ where: { id: user2.id } });
  }

  user2 = await prisma.user.create({
    data: {
      email: user2Email,
      passwordHash,
      role: 'USER',
      language: 'EN',
      profileValidated: false,
      wallet: 75.0,
      score: 4.5,
      profile: {
        create: {
          fullName: 'علی رضایی',
          username: 'ali_r',
          phoneNumber: '+989122222222',
          languages: ['en', 'fa'],
          bio: 'Software engineer who loves architecture, gym workouts, and sci-fi books.',
          avatarUrl: `avatars/${user2AvatarFile}`,
          isPrivate: false,
          relationType: RelationType.LONG,
          latitude: 35.7152,
          longitude: 51.4043,
          isOnline: true,
          lastSeenAt: new Date(),
        },
      },
      demographic: {
        create: {
          birthDate: new Date('1997-08-20'), // 29 years old
          gender: Gender.MALE,
          height: 182,
          weight: 78,
          degree: EducationStatus.MASTER_DEGREE,
          job: 'Software Engineer',
          relationStatus: RelationshipStatus.SINGLE,
          cityId,
        },
      },
      preferences: {
        create: {
          relation: RelationType.LONG,
          drinking: DrinkStatus.NEVER,
          smoking: SmokeStatus.NO,
          kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
          pets: PetsStatus.DOGS,
        },
      },
      personality: {
        create: {
          mood: MoodStatus.INTROVERT,
          starSign: StarSignStatus.LEO,
        },
      },
    },
  });

  await answerAllQuestionsForUser(user2.id);
  console.log(`  ✅ User 2 created: ID #${user2.id} (Email: ${user2.email}) with avatar only (0 gallery) and completed profile`);

  // -------------------------------------------------------------
  // USER 3: Avatar + Incomplete Profile (only username, fullName, BOD, city)
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 3: Avatar + Incomplete Profile (only username, fullName, BOD, city)...');
  const user3Email = 'neda.karimi@datemate.com';
  const user3AvatarFile = 'photo-1534528741775-53994a69daeb.webp';

  let user3 = await prisma.user.findUnique({ where: { email: user3Email } });
  if (user3) {
    await prisma.user.delete({ where: { id: user3.id } });
  }

  user3 = await prisma.user.create({
    data: {
      email: user3Email,
      passwordHash,
      role: 'USER',
      language: 'FA',
      profileValidated: false,
      wallet: 0.0,
      score: 1.0,
      profile: {
        create: {
          fullName: 'ندا کریمی',
          username: 'neda_k',
          avatarUrl: `avatars/${user3AvatarFile}`,
          latitude: 0,
          longitude: 0,
          isOnline: false,
          lastSeenAt: new Date(),
        },
      },
      demographic: {
        create: {
          birthDate: new Date('2003-11-15'), // 22 years old (BOD)
          gender: Gender.FEMALE,
          cityId,
        },
      },
      // No preferences, no personality, no gallery, no question answers -> Incomplete profile!
    },
  });

  console.log(`  ✅ User 3 created: ID #${user3.id} (Email: ${user3.email}) with avatar and incomplete profile (only username, fullName, BOD, city)`);

  // -------------------------------------------------------------
  // ADMIN USER: Role ADMIN + Username 'admin' + Email 'admin@datemate.com'
  // -------------------------------------------------------------
  console.log('\n👑 Seeding Admin User: admin@datemate.com (username: admin)...');
  const adminEmail = 'admin@datemate.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    await prisma.user.delete({ where: { id: existingAdmin.id } });
  }

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      language: 'EN',
      profileValidated: true,
      wallet: 1000.0,
      score: 5.0,
      profile: {
        create: {
          fullName: 'DateMate Administrator',
          username: 'admin',
          avatarUrl: 'avatars/avatarbe9c29b29330.webp',
          bio: 'DateMate Platform System Administrator',
          latitude: 35.6892,
          longitude: 51.3890,
          isOnline: true,
          lastSeenAt: new Date(),
        },
      },
    },
  });
  console.log(`  ✅ Admin user created: ID #${adminUser.id} (Email: ${adminEmail}, Username: admin, Role: ADMIN, Password: Password123!)`);

  console.log('\n🎉 User seeding completed successfully!');
}

seedUsers()
  .catch((e) => {
    console.error('❌ User seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
