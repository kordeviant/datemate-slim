/**
 * Seed script to populate test users for DateMate API:
 * 1. Sara Hemati (avatar, 3 gallery images, completed profile)
 * 2. Ali Rezaei (avatar only, completed profile)
 * 3. Neda Karimi (avatar, incomplete profile)
 * 4. Dina Rad (3 images: user-1-1.jpg, user-1-2.jpg, user-1-3.jpg; avatar & selfie, gallery, isProfilePicture, questions, interests)
 * 5. Roya Afshar (5 images: photo_2026-10-12_*.jpg; avatar & selfie, gallery, isProfilePicture, questions, interests)
 * 6. Parisa Tehrani (Lisa) (5 images: SnapInsta.to_*.jpg; avatar & selfie, gallery, isProfilePicture, questions, interests)
 * 7. Admin User (admin@datemate.com)
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
  const selfiesDir = path.join(rootDir, 'uploads', 'selfies');
  const imagesDir = path.join(rootDir, 'uploads', 'images');

  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }
  if (!fs.existsSync(selfiesDir)) {
    fs.mkdirSync(selfiesDir, { recursive: true });
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
  let selfiesCopied = 0;
  let imagesCopied = 0;

  for (const file of files) {
    const srcFile = path.join(sourceDir, file);
    if (!fs.statSync(srcFile).isFile()) continue;

    // Copy to avatars
    const destAvatar = path.join(avatarsDir, file);
    fs.copyFileSync(srcFile, destAvatar);
    avatarsCopied++;

    // Copy to selfies
    const destSelfie = path.join(selfiesDir, file);
    fs.copyFileSync(srcFile, destSelfie);
    selfiesCopied++;

    // Copy to images (gallery)
    const destImage = path.join(imagesDir, file);
    fs.copyFileSync(srcFile, destImage);
    imagesCopied++;
  }

  console.log(`📁 Prepared seed images: copied ${avatarsCopied} to avatars/, ${selfiesCopied} to selfies/, and ${imagesCopied} to images/`);
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

async function deleteUserByEmailOrUsername(email: string, username?: string) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    await prisma.user.delete({ where: { id: existingUser.id } });
    return;
  }
  if (username) {
    const existingProfile = await prisma.profile.findUnique({ where: { username } });
    if (existingProfile) {
      await prisma.user.delete({ where: { id: existingProfile.userId } });
    }
  }
}

async function answerAllQuestionsForUser(userId: number, answerOffset = 0) {
  const questions = await prisma.question.findMany({
    include: { answers: true },
  });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.answers.length > 0) {
      const answerIndex = (i + answerOffset) % q.answers.length;
      const selectedAnswer = q.answers[answerIndex];
      await prisma.userQuestionAnswer.upsert({
        where: {
          userId_questionAnswerId: {
            userId,
            questionAnswerId: selectedAnswer.id,
          },
        },
        create: {
          userId,
          questionAnswerId: selectedAnswer.id,
        },
        update: {},
      });
    }
  }
}

async function assignInterestsToUser(userId: number, interestKeywords: string[] = []) {
  let matchedInterests = await prisma.interest.findMany({
    where: {
      OR: interestKeywords.map((keyword) => ({
        OR: [
          { nameEn: { contains: keyword, mode: 'insensitive' } },
          { nameFa: { contains: keyword } },
        ],
      })),
    },
    take: 6,
  });

  // If none matched or none requested, pick any available interests
  if (matchedInterests.length === 0) {
    matchedInterests = await prisma.interest.findMany({ take: 5 });
  }

  for (const item of matchedInterests) {
    await prisma.userInterest.upsert({
      where: {
        userId_interestId: {
          userId,
          interestId: item.id,
        },
      },
      create: {
        userId,
        interestId: item.id,
        isLiked: true,
      },
      update: {},
    });
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

  await deleteUserByEmailOrUsername(user1Email, 'sara_h');

  const user1 = await prisma.user.create({
    data: {
      email: user1Email,
      passwordHash,
      role: 'USER',
      language: 'FA',
      profileValidated: true,
      isPremium: true,
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
          selfieUrl: `selfies/${user1AvatarFile}`,
          profilePictureUrl: `images/${user1GalleryFiles[0].file}`,
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
        create: user1GalleryFiles.map((g, idx) => ({
          imageUrl: `images/${g.file}`,
          description: g.desc,
          likesCount: 12,
          isProfilePicture: idx === 0,
        })),
      },
    },
  });

  await answerAllQuestionsForUser(user1.id, 0);
  await assignInterestsToUser(user1.id, ['Coffee', 'Fast food', 'Camping', 'Movies']);
  console.log(`  ✅ User 1 created: ID #${user1.id} (Email: ${user1.email}) with avatar, 3 gallery photos, and completed profile`);

  // -------------------------------------------------------------
  // USER 2: Avatar Only (no gallery) + Completed Profile
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 2: Avatar Only + Completed Profile...');
  const user2Email = 'ali.rezaei@datemate.com';
  const user2AvatarFile = 'photo-1507003211169-0a1dd7228f2d.webp';

  await deleteUserByEmailOrUsername(user2Email, 'ali_r');

  const user2 = await prisma.user.create({
    data: {
      email: user2Email,
      passwordHash,
      role: 'USER',
      language: 'EN',
      profileValidated: false,
      isPremium: false,
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
          selfieUrl: `selfies/${user2AvatarFile}`,
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

  await answerAllQuestionsForUser(user2.id, 1);
  await assignInterestsToUser(user2.id, ['Gym', 'Football', 'Running', 'Studying']);
  console.log(`  ✅ User 2 created: ID #${user2.id} (Email: ${user2.email}) with avatar only (0 gallery) and completed profile`);

  // -------------------------------------------------------------
  // USER 3: Avatar + Incomplete Profile (only username, fullName, BOD, city)
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 3: Avatar + Incomplete Profile (only username, fullName, BOD, city)...');
  const user3Email = 'neda.karimi@datemate.com';
  const user3AvatarFile = 'photo-1534528741775-53994a69daeb.webp';

  await deleteUserByEmailOrUsername(user3Email, 'neda_k');

  const user3 = await prisma.user.create({
    data: {
      email: user3Email,
      passwordHash,
      role: 'USER',
      language: 'FA',
      profileValidated: false,
      isPremium: false,
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
  // USER 4: Dina Rad (3 images: user-1-1.jpg, user-1-2.jpg, user-1-3.jpg)
  // Avatar & Selfie both use user-1-2.jpg, gallery has 3 images with isProfilePicture: true
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 4: Dina Rad (3 images)...');
  const user4Email = 'dina.rad@datemate.com';
  const user4Username = 'dina_r';
  const user4PrimaryImage = 'user-1-2.jpg';
  const user4GalleryFiles = [
    { file: 'user-1-2.jpg', desc: 'A cozy evening dinner in style', isProfilePicture: true },
    { file: 'user-1-1.jpg', desc: 'Night out in town with besties', isProfilePicture: false },
    { file: 'user-1-3.jpg', desc: 'Weekend relaxation and cocktails', isProfilePicture: false },
  ];

  await deleteUserByEmailOrUsername(user4Email, user4Username);

  const user4 = await prisma.user.create({
    data: {
      email: user4Email,
      passwordHash,
      role: 'USER',
      language: 'FA',
      profileValidated: true,
      isPremium: true,
      wallet: 200.0,
      score: 4.9,
      profile: {
        create: {
          fullName: 'دینا راد',
          username: user4Username,
          phoneNumber: '+989123334455',
          languages: ['fa', 'en'],
          bio: 'Fashion designer and wine lover. Passionate about art exhibitions, cozy jazz cafes, and travel.',
          avatarUrl: `avatars/${user4PrimaryImage}`,
          selfieUrl: `selfies/${user4PrimaryImage}`,
          profilePictureUrl: `images/${user4PrimaryImage}`,
          isPrivate: false,
          relationType: RelationType.LONG,
          latitude: 35.7905,
          longitude: 51.4253,
          isOnline: true,
          lastSeenAt: new Date(),
        },
      },
      demographic: {
        create: {
          birthDate: new Date('1999-06-12'),
          gender: Gender.FEMALE,
          height: 172,
          weight: 56,
          degree: EducationStatus.BACHELOR_DEGREE,
          job: 'Fashion Designer',
          relationStatus: RelationshipStatus.SINGLE,
          cityId,
        },
      },
      preferences: {
        create: {
          relation: RelationType.LONG,
          drinking: DrinkStatus.SOCIALLY,
          smoking: SmokeStatus.NO,
          kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
          pets: PetsStatus.CATS,
        },
      },
      personality: {
        create: {
          mood: MoodStatus.EXTROVERT,
          starSign: StarSignStatus.GEMINI,
        },
      },
      gallery: {
        create: user4GalleryFiles.map((g) => ({
          imageUrl: `images/${g.file}`,
          description: g.desc,
          likesCount: 15,
          isProfilePicture: g.isProfilePicture,
        })),
      },
    },
  });

  await answerAllQuestionsForUser(user4.id, 1);
  await assignInterestsToUser(user4.id, ['Coffee', 'Tea', 'Fast food', 'Movies', 'Camping']);
  console.log(`  ✅ User 4 created: ID #${user4.id} (${user4.email}) with 3 gallery photos, avatar & selfie, questions, and interests`);

  // -------------------------------------------------------------
  // USER 5: Roya Afshar (5 images: photo_2026-10-12_10-43-*.jpg)
  // Avatar & Selfie both use photo_2026-10-12_10-43-46.jpg, gallery has 5 images with isProfilePicture: true
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 5: Roya Afshar (5 images)...');
  const user5Email = 'roya.afshar@datemate.com';
  const user5Username = 'roya_af';
  const user5PrimaryImage = 'photo_2026-10-12_10-43-46.jpg';
  const user5GalleryFiles = [
    { file: 'photo_2026-10-12_10-43-46.jpg', desc: 'Sunny morning portrait with blooming flowers', isProfilePicture: true },
    { file: 'photo_2026-10-12_10-43-50.jpg', desc: 'Walking through green leafy alleys', isProfilePicture: false },
    { file: 'photo_2026-10-12_10-43-54.jpg', desc: 'Gentle smiles and peaceful thoughts', isProfilePicture: false },
    { file: 'photo_2026-10-12_10-43-57.jpg', desc: 'Cozy indoor afternoon vibes', isProfilePicture: false },
    { file: 'photo_2026-10-12_10-43-59.jpg', desc: 'Catching warm sunlight rays', isProfilePicture: false },
  ];

  await deleteUserByEmailOrUsername(user5Email, user5Username);

  const user5 = await prisma.user.create({
    data: {
      email: user5Email,
      passwordHash,
      role: 'USER',
      language: 'FA',
      profileValidated: true,
      isPremium: false,
      wallet: 80.0,
      score: 4.7,
      profile: {
        create: {
          fullName: 'رویا افشار',
          username: user5Username,
          phoneNumber: '+989124445566',
          languages: ['fa', 'en'],
          bio: 'Botanical illustrator & dreamer. Lover of curly hair, sunshine, wildflower bouquets, and reading poetry.',
          avatarUrl: `avatars/${user5PrimaryImage}`,
          selfieUrl: `selfies/${user5PrimaryImage}`,
          profilePictureUrl: `images/${user5PrimaryImage}`,
          isPrivate: false,
          relationType: RelationType.LONG,
          latitude: 35.7324,
          longitude: 51.4187,
          isOnline: true,
          lastSeenAt: new Date(),
        },
      },
      demographic: {
        create: {
          birthDate: new Date('2002-09-18'),
          gender: Gender.FEMALE,
          height: 165,
          weight: 52,
          degree: EducationStatus.BACHELOR_DEGREE,
          job: 'Illustrator & Artist',
          relationStatus: RelationshipStatus.SINGLE,
          cityId,
        },
      },
      preferences: {
        create: {
          relation: RelationType.LONG,
          drinking: DrinkStatus.NEVER,
          smoking: SmokeStatus.NO,
          kids: KidsStatus.LOVE_KIDS,
          pets: PetsStatus.CATS_AND_DOGS,
        },
      },
      personality: {
        create: {
          mood: MoodStatus.INTROVERT,
          starSign: StarSignStatus.VIRGO,
        },
      },
      gallery: {
        create: user5GalleryFiles.map((g) => ({
          imageUrl: `images/${g.file}`,
          description: g.desc,
          likesCount: 18,
          isProfilePicture: g.isProfilePicture,
        })),
      },
    },
  });

  await answerAllQuestionsForUser(user5.id, 2);
  await assignInterestsToUser(user5.id, ['Nature', 'Studying', 'Healthy food', 'Yoga', 'Swimming']);
  console.log(`  ✅ User 5 created: ID #${user5.id} (${user5.email}) with 5 gallery photos, avatar & selfie, questions, and interests`);

  // -------------------------------------------------------------
  // USER 6: Parisa Tehrani (Lisa) (5 images: SnapInsta.to_*.jpg)
  // Avatar & Selfie both use SnapInsta.to_684260407_18350760460265211_7242444006404710195_n.jpg
  // gallery has 5 images with isProfilePicture: true
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 6: Parisa Tehrani (Lisa) (5 images)...');
  const user6Email = 'parisa.tehrani@datemate.com';
  const user6Username = 'parisa_t';
  const user6PrimaryImage = 'SnapInsta.to_684260407_18350760460265211_7242444006404710195_n.jpg';
  const user6GalleryFiles = [
    {
      file: 'SnapInsta.to_684260407_18350760460265211_7242444006404710195_n.jpg',
      desc: 'Hallway elegance in white tailored suit',
      isProfilePicture: true,
    },
    {
      file: 'SnapInsta.to_683628993_18350760487265211_7402676734606740483_n.jpg',
      desc: 'High fashion pose ready for the gala',
      isProfilePicture: false,
    },
    {
      file: 'SnapInsta.to_683803849_18350760619265211_3726269816044105467_n.jpg',
      desc: 'Golden hotel lights & evening glam',
      isProfilePicture: false,
    },
    {
      file: 'SnapInsta.to_685022535_18350760535265211_1652659791642735140_n.jpg',
      desc: 'Confidence and sparkle on the runway walk',
      isProfilePicture: false,
    },
    {
      file: 'SnapInsta.to_687772176_18350760592265211_2651926306311709985_n.jpg',
      desc: 'Chic corridor portrait with crystal clutch',
      isProfilePicture: false,
    },
  ];

  await deleteUserByEmailOrUsername(user6Email, user6Username);

  const user6 = await prisma.user.create({
    data: {
      email: user6Email,
      passwordHash,
      role: 'USER',
      language: 'EN',
      profileValidated: true,
      isPremium: true,
      wallet: 350.0,
      score: 4.95,
      profile: {
        create: {
          fullName: 'پریسا تهرانی',
          username: user6Username,
          phoneNumber: '+989125556677',
          languages: ['en', 'fa'],
          bio: 'International model, dancer & music enthusiast. High fashion, grand stages, and always inspiring positive energy.',
          avatarUrl: `avatars/${user6PrimaryImage}`,
          selfieUrl: `selfies/${user6PrimaryImage}`,
          profilePictureUrl: `images/${user6PrimaryImage}`,
          isPrivate: false,
          relationType: RelationType.LONG,
          latitude: 35.7512,
          longitude: 51.4021,
          isOnline: true,
          lastSeenAt: new Date(),
        },
      },
      demographic: {
        create: {
          birthDate: new Date('2001-03-27'),
          gender: Gender.FEMALE,
          height: 170,
          weight: 50,
          degree: EducationStatus.BACHELOR_DEGREE,
          job: 'Model & Performer',
          relationStatus: RelationshipStatus.SINGLE,
          cityId,
        },
      },
      preferences: {
        create: {
          relation: RelationType.LONG,
          drinking: DrinkStatus.SOCIALLY,
          smoking: SmokeStatus.NO,
          kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
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
        create: user6GalleryFiles.map((g) => ({
          imageUrl: `images/${g.file}`,
          description: g.desc,
          likesCount: 25,
          isProfilePicture: g.isProfilePicture,
        })),
      },
    },
  });

  await answerAllQuestionsForUser(user6.id, 3);
  await assignInterestsToUser(user6.id, ['Gaming', 'Movies', 'Tennis', 'Running', 'Cooking']);
  console.log(`  ✅ User 6 created: ID #${user6.id} (${user6.email}) with 5 gallery photos, avatar & selfie, questions, and interests`);

  // -------------------------------------------------------------
  // ADMIN USER: Role ADMIN + Username 'admin' + Email 'admin@datemate.com'
  // -------------------------------------------------------------
  console.log('\n👑 Seeding Admin User: admin@datemate.com (username: admin)...');
  const adminEmail = 'admin@datemate.com';
  await deleteUserByEmailOrUsername(adminEmail, 'admin');

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      language: 'EN',
      profileValidated: true,
      isPremium: true,
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
