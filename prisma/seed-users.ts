/**
 * Seed script to populate test users for DateMate API:
 * 1. Sara Hemati (avatar, 3 gallery images, completed profile)
 * 2. Ali Rezaei (avatar only, completed profile)
 * 3. Neda Karimi (avatar, incomplete profile)
 * 4. Dina Rad (3 images: user-1-1.jpg, user-1-2.jpg, user-1-3.jpg; avatar & selfie, gallery, isProfilePicture, questions, interests)
 * 5. Roya Afshar (5 images: photo_2026-10-12_*.jpg; avatar & selfie, gallery, isProfilePicture, questions, interests)
 * 6. Parisa Tehrani (Lisa) (5 images: SnapInsta.to_*.jpg; avatar & selfie, gallery, isProfilePicture, questions, interests)
 * 7. Elina Moradi (2 images: model-1-avatar.jpg, model-1-gallery.jpg; avatar & selfie, gallery, questions, interests)
 * 8-35. 28 Top Models (Korean, American, Billie Eilish style, European, and Victoria's Secret / Swimwear Glamour models with smooth skin and fit bodies)
 * 36. Admin User (admin@datemate.com)
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
  const passwordHash = await bcrypt.hash('Password123!$#5fsFEFfs', 10);

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
  // USER 7: Elina Moradi (2 images: model-1-avatar.jpg, model-1-gallery.jpg)
  // Avatar & Selfie use model-1-avatar.jpg, gallery has 2 images with isProfilePicture: true on first
  // -------------------------------------------------------------
  console.log('\n👤 Seeding User 7: Elina Moradi (2 images)...');
  const user7Email = 'elina.moradi@datemate.com';
  const user7Username = 'elina_m';
  const user7AvatarFile = 'model-1-avatar.jpg';
  const user7GalleryFiles = [
    {
      file: 'model-1-avatar.jpg',
      desc: 'Summer breeze and garden blooms',
      isProfilePicture: true,
    },
    {
      file: 'model-1-gallery.jpg',
      desc: 'Afternoon walk with bougainvillea flowers',
      isProfilePicture: false,
    },
  ];

  await deleteUserByEmailOrUsername(user7Email, user7Username);

  const user7 = await prisma.user.create({
    data: {
      email: user7Email,
      passwordHash,
      role: 'USER',
      language: 'FA',
      profileValidated: true,
      isPremium: true,
      wallet: 280.0,
      score: 4.92,
      profile: {
        create: {
          fullName: 'الینا مرادی',
          username: user7Username,
          phoneNumber: '+989127778899',
          languages: ['fa', 'en'],
          bio: 'Fashion & portrait model, nature enthusiast, and matcha latte lover. Always looking for genuine conversations and creative inspirations.',
          avatarUrl: `avatars/${user7AvatarFile}`,
          selfieUrl: `selfies/${user7AvatarFile}`,
          profilePictureUrl: `images/${user7AvatarFile}`,
          isPrivate: false,
          relationType: RelationType.LONG,
          latitude: 35.7725,
          longitude: 51.4182,
          isOnline: true,
          lastSeenAt: new Date(),
        },
      },
      demographic: {
        create: {
          birthDate: new Date('2002-07-14'),
          gender: Gender.FEMALE,
          height: 172,
          weight: 53,
          degree: EducationStatus.BACHELOR_DEGREE,
          job: 'Fashion Model & Creator',
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
          starSign: StarSignStatus.CANCER,
        },
      },
      gallery: {
        create: user7GalleryFiles.map((g) => ({
          imageUrl: `images/${g.file}`,
          description: g.desc,
          likesCount: 28,
          isProfilePicture: g.isProfilePicture,
        })),
      },
    },
  });

  await answerAllQuestionsForUser(user7.id, 4);
  await assignInterestsToUser(user7.id, ['Nature', 'Coffee', 'Tea', 'Hiking', 'Yoga', 'Movies']);
  console.log(`  ✅ User 7 created: ID #${user7.id} (${user7.email}) with 2 gallery photos, avatar & selfie, questions, and interests`);

  // -------------------------------------------------------------
  // USERS 8 - 40: 33 Top Models (Korean, American, Billie Eilish style, European, Glamour & Sexy Aesthetics)
  // -------------------------------------------------------------
  const extraModels = [
    {
      email: 'billie.eilish@datemate.com',
      username: 'billie_e',
      fullName: 'بیلی آیلیش',
      avatarFile: 'user-billie-eilish-avatar.jpg',
      galleryFile: 'user-billie-eilish-gallery.jpg',
      avatarDesc: 'Neon aesthetic and authentic vibes on tour',
      galleryDesc: 'Music festival energy under the stage lights',
      phone: '+989128880001',
      bio: 'Grammy & Oscar-winning singer & artist. Neon green aesthetics, heavy basslines, vegan food, and honest conversations.',
      languages: ['en'],
      birthDate: '2001-12-18',
      height: 161,
      weight: 52,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'Artist & Musician',
      relationType: RelationType.OPEN,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.NEVER,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.SAGITTARIUS,
      interests: ['Movies', 'Gaming', 'Fast food', 'Camping', 'Nature'],
      latitude: 35.795,
      longitude: 51.41,
      wallet: 500.0,
      score: 4.95,
    },
    {
      email: 'jennie.kim@datemate.com',
      username: 'jennie_k',
      fullName: 'جنی کیم',
      avatarFile: 'user-korean-jennie-avatar.jpg',
      galleryFile: 'user-korean-jennie-gallery.jpg',
      avatarDesc: 'Editorial fashion portrait in Chanel couture',
      galleryDesc: 'Cozy weekend moment with iced matcha latte',
      phone: '+989128880002',
      bio: 'Fashion icon & global ambassador. Vintage aesthetic, French bakery visits, slow playlists, and high fashion photography.',
      languages: ['en', 'fa'],
      birthDate: '2000-01-16',
      height: 163,
      weight: 48,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Fashion Icon & Performer',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.CAPRICORN,
      interests: ['Coffee', 'Tea', 'Movies', 'Nature', 'Studying'],
      latitude: 35.78,
      longitude: 51.42,
      wallet: 450.0,
      score: 4.96,
    },
    {
      email: 'kim.jisoo@datemate.com',
      username: 'jisoo_k',
      fullName: 'کیم جیسو',
      avatarFile: 'user-korean-jisoo-avatar.jpg',
      galleryFile: 'user-korean-jisoo-gallery.jpg',
      avatarDesc: 'Classic beauty portrait in Dior elegance',
      galleryDesc: 'Spring blossom stroll through scenic gardens',
      phone: '+989128880003',
      bio: 'Actress & global brand ambassador. Sweet smiles, cozy reading corners, gaming marathons, and hot tea on rainy days.',
      languages: ['en', 'fa'],
      birthDate: '1999-01-03',
      height: 162,
      weight: 45,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Actress & Ambassador',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.NEVER,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.SOMEWHERE_IN_BETWEEN,
      starSign: StarSignStatus.CAPRICORN,
      interests: ['Gaming', 'Movies', 'Studying', 'Tea', 'Healthy food'],
      latitude: 35.77,
      longitude: 51.415,
      wallet: 420.0,
      score: 4.94,
    },
    {
      email: 'iu.lee@datemate.com',
      username: 'iu_lee',
      fullName: 'آی‌یو (لی جی‌اون)',
      avatarFile: 'user-korean-iu-avatar.jpg',
      galleryFile: 'user-korean-iu-gallery.jpg',
      avatarDesc: 'Acoustic concert stage warmth & gentle smile',
      galleryDesc: 'Quiet bookshop afternoon and hot chamomile tea',
      phone: '+989128880004',
      bio: 'Singer-songwriter & actress. Gentle acoustic melodies, poetry, retro vinyls, and heartwarming conversations.',
      languages: ['en', 'fa'],
      birthDate: '1998-05-16',
      height: 162,
      weight: 45,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Singer-Songwriter & Actress',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.TAURUS,
      interests: ['Studying', 'Tea', 'Movies', 'Nature', 'Cooking'],
      latitude: 35.765,
      longitude: 51.405,
      wallet: 380.0,
      score: 4.93,
    },
    {
      email: 'karina.yu@datemate.com',
      username: 'karina_y',
      fullName: 'کارینا (یو جی‌مین)',
      avatarFile: 'user-korean-karina-avatar.jpg',
      galleryFile: 'user-korean-karina-gallery.jpg',
      avatarDesc: 'Futuristic visual beauty and runway makeup',
      galleryDesc: 'Studio dance practice and modern streetwear',
      phone: '+989128880005',
      bio: 'K-pop visual leader & model. Anime enthusiast, nighttime city drives, spicy ramen, and modern dance.',
      languages: ['en', 'fa'],
      birthDate: '2000-04-11',
      height: 168,
      weight: 47,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Visual Model & Performer',
      relationType: RelationType.FUN,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.UNDECIDED_ABOUT_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.ARIES,
      interests: ['Gaming', 'Fast food', 'Movies', 'Running', 'Gym'],
      latitude: 35.76,
      longitude: 51.395,
      wallet: 400.0,
      score: 4.95,
    },
    {
      email: 'yuna.park@datemate.com',
      username: 'yuna_p',
      fullName: 'یونا پارک',
      avatarFile: 'user-korean-yuna-avatar.jpg',
      galleryFile: 'user-korean-yuna-gallery.jpg',
      avatarDesc: 'Seoul runway minimalism & glass skin glow',
      galleryDesc: 'Pilates studio morning & fresh cold-pressed juice',
      phone: '+989128880006',
      bio: 'Runway model & certified Pilates trainer. Clean architecture, morning yoga, Scandinavian interiors, and rooftop sunsets.',
      languages: ['en', 'fa'],
      birthDate: '2001-09-22',
      height: 173,
      weight: 51,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Runway Model & Pilates Instructor',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.NEVER,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.SOMEWHERE_IN_BETWEEN,
      starSign: StarSignStatus.VIRGO,
      interests: ['Yoga', 'Gym', 'Healthy food', 'Running', 'Hiking'],
      latitude: 35.755,
      longitude: 51.43,
      wallet: 320.0,
      score: 4.88,
    },
    {
      email: 'minji.han@datemate.com',
      username: 'minji_h',
      fullName: 'مینجی هان',
      avatarFile: 'user-korean-minji-avatar.jpg',
      galleryFile: 'user-korean-minji-gallery.jpg',
      avatarDesc: 'High-fashion editorial pose with bold street edge',
      galleryDesc: 'Golden hour rooftop skate session & vintage camera',
      phone: '+989128880007',
      bio: 'Seoul streetwear & editorial muse. 35mm film photography, hip-hop vinyls, spicy street food, and spontaneous road trips.',
      languages: ['en', 'fa'],
      birthDate: '2002-05-07',
      height: 170,
      weight: 49,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'Editorial Model & Stylist',
      relationType: RelationType.FUN,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.TAURUS,
      interests: ['Camping', 'Movies', 'Fast food', 'Tennis', 'Nature'],
      latitude: 35.748,
      longitude: 51.412,
      wallet: 310.0,
      score: 4.89,
    },
    {
      email: 'kendall.jenner@datemate.com',
      username: 'kendall_j',
      fullName: 'کندال جنر',
      avatarFile: 'user-kendall-jenner-avatar.jpg',
      galleryFile: 'user-kendall-jenner-gallery.jpg',
      avatarDesc: 'Supermodel studio close-up in high fashion chic',
      galleryDesc: 'Equestrian ranch lifestyle and California sunshine',
      phone: '+989128880008',
      bio: 'International top model & 818 founder. Horseback riding at sunrise, vintage muscle cars, Pilates, and Mediterranean holidays.',
      languages: ['en'],
      birthDate: '1998-11-03',
      height: 179,
      weight: 56,
      degree: EducationStatus.HIGH_SCHOOL_DIPLOMA,
      job: 'International Supermodel',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.SCORPIO,
      interests: ['Tennis', 'Gym', 'Nature', 'Healthy food', 'Running'],
      latitude: 35.798,
      longitude: 51.44,
      wallet: 600.0,
      score: 4.97,
    },
    {
      email: 'bella.hadid@datemate.com',
      username: 'bella_h',
      fullName: 'بلا حدید',
      avatarFile: 'user-bella-hadid-avatar.jpg',
      galleryFile: 'user-bella-hadid-gallery.jpg',
      avatarDesc: 'Haute couture runway gaze with sculptured elegance',
      galleryDesc: 'Country ranch escape & equestrian riding boots',
      phone: '+989128880009',
      bio: 'Fashion muse & Kin Euphorics co-founder. Avant-garde tailoring, equine connection, wellness herbs, and poetic journals.',
      languages: ['en'],
      birthDate: '1999-10-09',
      height: 175,
      weight: 53,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'High Fashion Runway Muse',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.NEVER,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.CATS_AND_DOGS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.LIBRA,
      interests: ['Hiking', 'Nature', 'Tea', 'Coffee', 'Studying'],
      latitude: 35.792,
      longitude: 51.435,
      wallet: 550.0,
      score: 4.96,
    },
    {
      email: 'gigi.hadid@datemate.com',
      username: 'gigi_h',
      fullName: 'جی‌جی حدید',
      avatarFile: 'user-gigi-hadid-avatar.jpg',
      galleryFile: 'user-gigi-hadid-gallery.jpg',
      avatarDesc: 'Vogue cover smile radiating golden warmth',
      galleryDesc: 'Farmhouse weekend kitchen & cozy cashmere sweater',
      phone: '+989128880010',
      bio: 'Supermodel & founder of Guest in Residence. Homemade pasta, pottery spinning, countryside air, and effortless style.',
      languages: ['en'],
      birthDate: '1998-04-23',
      height: 178,
      weight: 55,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'Supermodel & Creative Director',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.ALREADY_HAVE_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.TAURUS,
      interests: ['Cooking', 'Studying', 'Nature', 'Coffee', 'Healthy food'],
      latitude: 35.788,
      longitude: 51.428,
      wallet: 530.0,
      score: 4.95,
    },
    {
      email: 'sydney.sweeney@datemate.com',
      username: 'sydney_s',
      fullName: 'سیدنی سوئینی',
      avatarFile: 'user-sydney-sweeney-avatar.jpg',
      galleryFile: 'user-sydney-sweeney-gallery.jpg',
      avatarDesc: 'Hollywood red carpet glam with radiant blue eyes',
      galleryDesc: 'Classic vintage Bronco restoration in the garage',
      phone: '+989128880011',
      bio: 'Emmy-nominated actress & producer. Vintage car mechanic, mixed martial arts training, outdoor water sports, and gripping thriller scripts.',
      languages: ['en'],
      birthDate: '2000-09-12',
      height: 161,
      weight: 53,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Actress & Film Producer',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.VIRGO,
      interests: ['Martial arts', 'Movies', 'Camping', 'Gym', 'Swimming'],
      latitude: 35.782,
      longitude: 51.422,
      wallet: 480.0,
      score: 4.94,
    },
    {
      email: 'zendaya.coleman@datemate.com',
      username: 'zendaya_c',
      fullName: 'زندایا',
      avatarFile: 'user-zendaya-avatar.jpg',
      galleryFile: 'user-zendaya-gallery.jpg',
      avatarDesc: 'Met Gala red-carpet sculpture and high fashion poise',
      galleryDesc: 'Cozy movie premiere afterparty with close friends',
      phone: '+989128880012',
      bio: 'Emmy-winning actress, producer, and style icon. Cinema enthusiast, theater lover, gourmet vegetarian dinners, and genuine wit.',
      languages: ['en'],
      birthDate: '1999-09-01',
      height: 178,
      weight: 54,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Actress & Fashion Icon',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.NEVER,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.VIRGO,
      interests: ['Movies', 'Studying', 'Tennis', 'Healthy food', 'Tea'],
      latitude: 35.775,
      longitude: 51.418,
      wallet: 580.0,
      score: 4.98,
    },
    {
      email: 'barbara.palvin@datemate.com',
      username: 'barbara_p',
      fullName: 'باربارا پالوین',
      avatarFile: 'user-barbara-palvin-avatar.jpg',
      galleryFile: 'user-barbara-palvin-gallery.jpg',
      avatarDesc: 'Victoria Secret angelic portrait with playful smile',
      galleryDesc: 'Gaming room stream setup & cozy oversized hoodie',
      phone: '+989128880013',
      bio: 'Supermodel & Armani beauty face. Full-time gamer, manga reader, spontaneous road trips, and foodie adventures.',
      languages: ['en'],
      birthDate: '1998-10-08',
      height: 175,
      weight: 54,
      degree: EducationStatus.HIGH_SCHOOL_DIPLOMA,
      job: 'Supermodel & Beauty Ambassador',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.LIBRA,
      interests: ['Gaming', 'Fast food', 'Movies', 'Camping', 'Cooking'],
      latitude: 35.768,
      longitude: 51.411,
      wallet: 440.0,
      score: 4.93,
    },
    {
      email: 'dua.lipa@datemate.com',
      username: 'dua_l',
      fullName: 'دوآ لیپا',
      avatarFile: 'user-dua-lipa-avatar.jpg',
      galleryFile: 'user-dua-lipa-gallery.jpg',
      avatarDesc: 'Radical Optimism arena headline performance aura',
      galleryDesc: 'London vinyl record store & matcha latte break',
      phone: '+989128880014',
      bio: 'Grammy-winning pop titan & Service95 founder. Sun-drenched Mediterranean summers, hot yoga, literature, and bold dance choreography.',
      languages: ['en'],
      birthDate: '1998-08-22',
      height: 173,
      weight: 55,
      degree: EducationStatus.HIGH_SCHOOL_DIPLOMA,
      job: 'Global Pop Artist & Cultural Curator',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.CATS_AND_DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.LEO,
      interests: ['Yoga', 'Studying', 'Movies', 'Swimming', 'Cooking'],
      latitude: 35.762,
      longitude: 51.407,
      wallet: 510.0,
      score: 4.96,
    },
    {
      email: 'ana.dearmas@datemate.com',
      username: 'ana_d',
      fullName: 'آنا د آرماس',
      avatarFile: 'user-ana-dearmas-avatar.jpg',
      galleryFile: 'user-ana-dearmas-gallery.jpg',
      avatarDesc: 'Venice Film Festival glamorous red carpet portrait',
      galleryDesc: 'Coastal villa terrace at sunset with pet dog',
      phone: '+989128880015',
      bio: 'Academy Award nominee. Warm Caribbean sunshine, espresso mornings, classical literature, and beach walks with my puppy.',
      languages: ['en'],
      birthDate: '1996-04-30',
      height: 168,
      weight: 54,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Actress',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.SOMEWHERE_IN_BETWEEN,
      starSign: StarSignStatus.TAURUS,
      interests: ['Movies', 'Nature', 'Coffee', 'Swimming', 'Studying'],
      latitude: 35.758,
      longitude: 51.402,
      wallet: 470.0,
      score: 4.92,
    },
    {
      email: 'margot.robbie@datemate.com',
      username: 'margot_r',
      fullName: 'مارگو رابی',
      avatarFile: 'user-margot-robbie-avatar.jpg',
      galleryFile: 'user-margot-robbie-gallery.jpg',
      avatarDesc: 'Award-winning smile and Australian sun-kissed charm',
      galleryDesc: 'Gold Coast morning surf session & acai bowl',
      phone: '+989128880016',
      bio: 'Producer & actress behind global box-office wonders. Surfing, barbecue with friends, 90s rock, and ambitious creative films.',
      languages: ['en'],
      birthDate: '1997-07-02',
      height: 168,
      weight: 56,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'Actress & Producer',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.CANCER,
      interests: ['Swimming', 'Movies', 'Fast food', 'Camping', 'Football'],
      latitude: 35.752,
      longitude: 51.398,
      wallet: 560.0,
      score: 4.95,
    },
    {
      email: 'chloe.laurent@datemate.com',
      username: 'chloe_l',
      fullName: 'کلوئی لوران',
      avatarFile: 'user-model-chloe-avatar.jpg',
      galleryFile: 'user-model-chloe-gallery.jpg',
      avatarDesc: 'Parisian fashion week editorial model in silhouette',
      galleryDesc: 'Boulevard Saint-Germain cafe terrace with croissant',
      phone: '+989128880017',
      bio: 'Haute couture runway model based in Paris. Contemporary art galleries, black espresso, jazz vinyls, and French architecture.',
      languages: ['en', 'fa'],
      birthDate: '2001-02-14',
      height: 177,
      weight: 53,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Haute Couture Model',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.AQUARIUS,
      interests: ['Coffee', 'Studying', 'Movies', 'Yoga', 'Nature'],
      latitude: 35.745,
      longitude: 51.392,
      wallet: 360.0,
      score: 4.91,
    },
    {
      email: 'emma.vance@datemate.com',
      username: 'emma_v',
      fullName: 'اما ونس',
      avatarFile: 'user-model-emma-avatar.jpg',
      galleryFile: 'user-model-emma-gallery.jpg',
      avatarDesc: 'British elegance in classic trench coat portrait',
      galleryDesc: 'Notting Hill antique market walk on foggy Sunday',
      phone: '+989128880018',
      bio: 'London commercial model & English literature grad. Autumn walks through Hyde Park, vintage tea sets, acoustic folk music, and classic novels.',
      languages: ['en', 'fa'],
      birthDate: '2002-11-20',
      height: 171,
      weight: 52,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Commercial Fashion Model',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.NEVER,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.SOMEWHERE_IN_BETWEEN,
      starSign: StarSignStatus.SCORPIO,
      interests: ['Studying', 'Tea', 'Movies', 'Hiking', 'Cooking'],
      latitude: 35.738,
      longitude: 51.388,
      wallet: 290.0,
      score: 4.88,
    },
    {
      email: 'sophia.miller@datemate.com',
      username: 'sophia_m',
      fullName: 'سوفیا میلر',
      avatarFile: 'user-model-sophia-avatar.jpg',
      galleryFile: 'user-model-sophia-gallery.jpg',
      avatarDesc: 'Manhattan street style portrait with confident poise',
      galleryDesc: 'SoHo ceramics studio crafting porcelain vases',
      phone: '+989128880019',
      bio: 'New York runway model & contemporary ceramist. Brooklyn weekend brunch, loft studio clay work, cold brew, and modern pop art.',
      languages: ['en', 'fa'],
      birthDate: '2000-08-15',
      height: 176,
      weight: 55,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Runway Model & Ceramist',
      relationType: RelationType.OPEN,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.UNDECIDED_ABOUT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.LEO,
      interests: ['Coffee', 'Gym', 'Cycling', 'Healthy food', 'Running'],
      latitude: 35.732,
      longitude: 51.382,
      wallet: 340.0,
      score: 4.9,
    },
    {
      email: 'mia.thorne@datemate.com',
      username: 'mia_t',
      fullName: 'میا ثورن',
      avatarFile: 'user-model-mia-avatar.jpg',
      galleryFile: 'user-model-mia-gallery.jpg',
      avatarDesc: 'Sun-drenched Malibu beach portrait with ocean glow',
      galleryDesc: 'Sunset beach volleyball match with team friends',
      phone: '+989128880020',
      bio: 'Swimwear model & beach volleyball athlete. Tropical fruit smoothies, California surf breaks, coastal highway drives, and positive energy.',
      languages: ['en', 'fa'],
      birthDate: '2003-03-10',
      height: 174,
      weight: 56,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'Swimwear Model & Athlete',
      relationType: RelationType.FUN,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.PISCES,
      interests: ['Swimming', 'Running', 'Gym', 'Nature', 'Healthy food'],
      latitude: 35.726,
      longitude: 51.378,
      wallet: 300.0,
      score: 4.87,
    },
    {
      email: 'olivia.sterling@datemate.com',
      username: 'olivia_s',
      fullName: 'اولیویا استرلینگ',
      avatarFile: 'user-model-olivia-avatar.jpg',
      galleryFile: 'user-model-olivia-gallery.jpg',
      avatarDesc: 'Vogue editorial portrait with statuesque poise',
      galleryDesc: 'Grand piano rehearsal in historic concert hall',
      phone: '+989128880021',
      bio: 'International top model & classical concert pianist. Chopin nocturnes, candlelight dinner parties, opera nights, and bespoke fashion tailoring.',
      languages: ['en', 'fa'],
      birthDate: '1999-12-05',
      height: 178,
      weight: 54,
      degree: EducationStatus.MASTER_DEGREE,
      job: 'Runway Model & Concert Pianist',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.SAGITTARIUS,
      interests: ['Studying', 'Coffee', 'Tennis', 'Movies', 'Tea'],
      latitude: 35.72,
      longitude: 51.372,
      wallet: 410.0,
      score: 4.93,
    },
    {
      email: 'zoey.vance@datemate.com',
      username: 'zoey_v',
      fullName: 'زویی ونس',
      avatarFile: 'user-model-zoey-avatar.jpg',
      galleryFile: 'user-model-zoey-gallery.jpg',
      avatarDesc: 'Indie grunge aesthetic portrait with neon highlights',
      galleryDesc: 'Vintage cassette tape store & electric guitar jam',
      phone: '+989128880022',
      bio: 'Alt fashion stylist & indie singer. Thrift shop denim, bass pedals, indie game dev, cold brew coffee, and underground music festivals.',
      languages: ['en', 'fa'],
      birthDate: '2002-06-25',
      height: 166,
      weight: 50,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'Alt Stylist & Indie Musician',
      relationType: RelationType.FUN,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.DO_NOT_WANT_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.CANCER,
      interests: ['Gaming', 'Fast food', 'Camping', 'Movies', 'Nature'],
      latitude: 35.714,
      longitude: 51.366,
      wallet: 320.0,
      score: 4.89,
    },
    {
      email: 'valentina.rossi@datemate.com',
      username: 'valentina_r',
      fullName: 'والنتینا رُسی',
      avatarFile: 'user-glamour-valentina-avatar.jpg',
      galleryFile: 'user-glamour-valentina-gallery.jpg',
      avatarDesc: 'Saint-Tropez beach club golden hour vibes',
      galleryDesc: 'Sunset Spritz by the marina yachts',
      phone: '+989128880023',
      bio: 'Italian-Brazilian fitness & swimwear model. Living between beaches and gym studios. Aperol spritz at sunset, ocean swims, and Pilates mornings.',
      languages: ['en', 'fa'],
      birthDate: '2001-08-14',
      height: 175,
      weight: 57,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Swimwear Model & Fitness Coach',
      relationType: RelationType.FUN,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.LEO,
      interests: ['Swimming', 'Gym', 'Yoga', 'Healthy food', 'Nature'],
      latitude: 35.786,
      longitude: 51.424,
      wallet: 490.0,
      score: 4.97,
    },
    {
      email: 'emily.ratajkowski@datemate.com',
      username: 'emrata',
      fullName: 'امیلی راتایکوفسکی',
      avatarFile: 'user-glamour-emily-avatar.jpg',
      galleryFile: 'user-glamour-emily-gallery.jpg',
      avatarDesc: 'Summer beauty portrait with radiant sun-kissed skin',
      galleryDesc: 'Emmy Awards red carpet evening couture gown',
      phone: '+989128880024',
      bio: 'High-fashion model, New York Times bestselling author & podcast host. Beach sunset swims, contemporary art, pasta dinners, and Pilates.',
      languages: ['en'],
      birthDate: '1998-06-07',
      height: 171,
      weight: 54,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Supermodel & Author',
      relationType: RelationType.FUN,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.GEMINI,
      interests: ['Swimming', 'Gym', 'Yoga', 'Healthy food', 'Nature'],
      latitude: 35.789,
      longitude: 51.428,
      wallet: 520.0,
      score: 4.97,
    },
    {
      email: 'candice.swanepoel@datemate.com',
      username: 'candice_s',
      fullName: 'کندیس سوان‌پول',
      avatarFile: 'user-glamour-candice-avatar.jpg',
      galleryFile: 'user-glamour-candice-gallery.jpg',
      avatarDesc: 'Victoria Secret Angel golden glow and blue eyes',
      galleryDesc: 'Max Factor campaign beauty and natural elegance',
      phone: '+989128880025',
      bio: 'Victoria’s Secret Angel & Tropic of C founder. South African safari lover, ocean waves, yoga flow, and clean organic living.',
      languages: ['en'],
      birthDate: '1998-10-20',
      height: 177,
      weight: 55,
      degree: EducationStatus.HIGH_SCHOOL_DIPLOMA,
      job: 'Supermodel & Swimwear Founder',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.LIBRA,
      interests: ['Yoga', 'Swimming', 'Nature', 'Healthy food', 'Tea'],
      latitude: 35.784,
      longitude: 51.422,
      wallet: 550.0,
      score: 4.98,
    },
    {
      email: 'irina.shayk@datemate.com',
      username: 'irina_s',
      fullName: 'ایرینا شایک',
      avatarFile: 'user-glamour-irina-avatar.jpg',
      galleryFile: 'user-glamour-irina-gallery.jpg',
      avatarDesc: 'Sports Illustrated cover queen portrait with green eyes',
      galleryDesc: 'Cannes Film Festival red carpet luxury glamour',
      phone: '+989128880026',
      bio: 'International runway icon & swimsuit cover model. Haute couture runways from Milan to Paris, banya wellness sessions, and dark chocolate.',
      languages: ['en', 'fa'],
      birthDate: '1996-01-06',
      height: 178,
      weight: 55,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'High Fashion Runway Queen',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.CAPRICORN,
      interests: ['Gym', 'Movies', 'Fashion', 'Studying', 'Healthy food'],
      latitude: 35.779,
      longitude: 51.417,
      wallet: 600.0,
      score: 4.99,
    },
    {
      email: 'sara.sampaio@datemate.com',
      username: 'sara_s',
      fullName: 'سارا سامپایو',
      avatarFile: 'user-glamour-sara-avatar.jpg',
      galleryFile: 'user-glamour-sara-gallery.jpg',
      avatarDesc: 'Portuguese supermodel beauty with emerald gaze',
      galleryDesc: 'Venice rooftop evening with ocean breeze',
      phone: '+989128880027',
      bio: 'Victoria’s Secret Angel & Sports Illustrated model. Karate black belt, coastal surf spots, sushi nights, and spontaneous travel.',
      languages: ['en'],
      birthDate: '1999-07-21',
      height: 172,
      weight: 54,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Supermodel & Actress',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.CANCER,
      interests: ['Martial arts', 'Swimming', 'Fast food', 'Movies', 'Camping'],
      latitude: 35.773,
      longitude: 51.412,
      wallet: 480.0,
      score: 4.96,
    },
    {
      email: 'adriana.lima@datemate.com',
      username: 'adriana_l',
      fullName: 'آدریانا لیما',
      avatarFile: 'user-glamour-adriana-avatar.jpg',
      galleryFile: 'user-glamour-adriana-gallery.jpg',
      avatarDesc: 'Legendary Victoria’s Secret angel close-up with intense eyes',
      galleryDesc: 'Cannes Film Festival elegance under the Riviera sun',
      phone: '+989128880028',
      bio: 'Longest-running Victoria’s Secret Angel & boxing athlete. Intense boxing workouts, meditation, Bahia rhythms, and timeless high fashion.',
      languages: ['en'],
      birthDate: '1996-06-12',
      height: 178,
      weight: 58,
      degree: EducationStatus.SOME_COLLEGE,
      job: 'Legendary Supermodel & Boxing Athlete',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.GEMINI,
      interests: ['Martial arts', 'Gym', 'Running', 'Yoga', 'Healthy food'],
      latitude: 35.768,
      longitude: 51.408,
      wallet: 650.0,
      score: 4.99,
    },
    {
      email: 'daria.ivanova@datemate.com',
      username: 'daria_i',
      fullName: 'داریا ایوانوا',
      avatarFile: 'user-daria-avatar.jpg',
      galleryFile: 'user-daria-gallery.jpg',
      avatarDesc: 'Doll-like blonde beauty with creamy porcelain skin and sunny garden warmth',
      galleryDesc: 'High-fashion editorial elegance with luminous blonde hair and captivating gaze',
      phone: '+989128880029',
      bio: 'High-fashion runway & commercial model. Natural aesthetic, porcelain skin routines, garden walks, Pilates, and specialty matcha lattes.',
      languages: ['en', 'ru'],
      birthDate: '2002-04-18',
      height: 175,
      weight: 53,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Fashion Model & Beauty Influencer',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.INTROVERT,
      starSign: StarSignStatus.ARIES,
      interests: ['Nature', 'Coffee', 'Yoga', 'Photography', 'Startups', 'Painting'],
      latitude: 35.782,
      longitude: 51.422,
      wallet: 550.0,
      score: 4.98,
    },
    {
      email: 'maya.farhadi@datemate.com',
      username: 'maya_f',
      fullName: 'مایا فرهادی',
      avatarFile: 'user-maya-avatar.jpg',
      galleryFile: 'user-maya-gallery.jpg',
      avatarDesc: 'Sleek high ponytail profile with designer black eyeglasses and sculpted jawline',
      galleryDesc: 'Chic runway portrait with expressive gaze, radiant skin and modern haute couture',
      phone: '+989128880030',
      bio: 'Architectural designer & fashion stylist. Sharp jawlines, black-frame optics, minimalist contemporary design, dark roast espresso, and museum dates.',
      languages: ['fa', 'en'],
      birthDate: '2001-09-15',
      height: 174,
      weight: 54,
      degree: EducationStatus.MASTER_DEGREE,
      job: 'Architectural Designer & Stylist',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.VIRGO,
      interests: ['Coffee', 'City trips', 'Photography', 'Cultural trips', 'Philosophy', 'Painting'],
      latitude: 35.791,
      longitude: 51.415,
      wallet: 620.0,
      score: 4.97,
    },
    {
      email: 'sirena.rostami@datemate.com',
      username: 'sirena_r',
      fullName: 'سیرنا رستمی',
      avatarFile: 'user-sirena-avatar.jpg',
      galleryFile: 'user-sirena-gallery.jpg',
      avatarDesc: 'Shimmering fringe two-piece evening outfit, sun-kissed glowing skin, and toned figure',
      galleryDesc: 'Venice Film Festival red carpet glamour in flowing haute couture gown',
      phone: '+989128880031',
      bio: 'Glamour model & fitness enthusiast. Golden bronze skin, festival fringe sparkles, rooftop DJ sets, weight training, and coastal weekend escapes.',
      languages: ['fa', 'en'],
      birthDate: '2000-08-05',
      height: 176,
      weight: 56,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Glamour Model & Fitness Creator',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.LEO,
      interests: ['Gym', 'Swimming', 'Electronic', 'Beach', 'Pop', 'Adventure'],
      latitude: 35.798,
      longitude: 51.428,
      wallet: 700.0,
      score: 4.99,
    },
    {
      email: 'chiara.moretti@datemate.com',
      username: 'chiara_m',
      fullName: 'کیارا مورتی',
      avatarFile: 'user-chiara-avatar.jpg',
      galleryFile: 'user-chiara-gallery.jpg',
      avatarDesc: 'Emerald swimsuit by Positano cliffside infinity pool with radiant sunlit smile and fit physique',
      galleryDesc: 'Sunset Aperol Spritz on Italian yacht dock in elegant halter-neck white dress',
      phone: '+989128880032',
      bio: 'Swimwear designer & Mediterranean resort model. Amalfi coast sun, emerald bikinis, sailing the Riviera, Italian gastronomy, and fit active lifestyle.',
      languages: ['it', 'en'],
      birthDate: '2001-05-22',
      height: 173,
      weight: 52,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'Swimwear Designer & Resort Model',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.MAYBE_SOME_DAY_WANT_KIDS,
      pets: PetsStatus.CATS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.GEMINI,
      interests: ['Swimming', 'Healthy food', 'Yoga', 'Photography', 'Beach', 'Cooking'],
      latitude: 35.789,
      longitude: 51.436,
      wallet: 580.0,
      score: 4.99,
    },
    {
      email: 'alina.skriver@datemate.com',
      username: 'alina_s',
      fullName: 'آلینا اسکریور',
      avatarFile: 'user-alina-avatar.jpg',
      galleryFile: 'user-alina-gallery.jpg',
      avatarDesc: 'Angelic supermodel close-up with porcelain smooth skin and captivating green eyes',
      galleryDesc: 'New York street style elegance with natural glow and effortless chic poise',
      phone: '+989128880033',
      bio: 'International runway supermodel. Copenhagen minimalism, runway fitness, smooth skincare routines, cycling through city parks, and acoustic music.',
      languages: ['en', 'da'],
      birthDate: '1999-11-14',
      height: 179,
      weight: 55,
      degree: EducationStatus.BACHELOR_DEGREE,
      job: 'International Runway Supermodel',
      relationType: RelationType.LONG,
      relationStatus: RelationshipStatus.SINGLE,
      drinking: DrinkStatus.SOCIALLY,
      smoking: SmokeStatus.NO,
      kids: KidsStatus.LOVE_KIDS,
      pets: PetsStatus.DOGS,
      mood: MoodStatus.EXTROVERT,
      starSign: StarSignStatus.SCORPIO,
      interests: ['Gym', 'Running', 'Nature', 'Cycling', 'City trips', 'Coffee'],
      latitude: 35.776,
      longitude: 51.419,
      wallet: 680.0,
      score: 4.99,
    },
  ];

  for (let idx = 0; idx < extraModels.length; idx++) {
    const m = extraModels[idx];
    const userNum = 8 + idx;
    console.log(`\n👤 Seeding User ${userNum}: ${m.fullName} (${m.username})...`);
    await deleteUserByEmailOrUsername(m.email, m.username);

    const newUser = await prisma.user.create({
      data: {
        email: m.email,
        passwordHash,
        role: 'USER',
        language: 'FA',
        profileValidated: true,
        // isPremium: true,
        wallet: m.wallet,
        score: m.score,
        profile: {
          create: {
            fullName: m.fullName,
            username: m.username,
            phoneNumber: m.phone,
            languages: m.languages,
            bio: m.bio,
            avatarUrl: `avatars/${m.avatarFile}`,
            selfieUrl: `selfies/${m.avatarFile}`,
            profilePictureUrl: `images/${m.avatarFile}`,
            isPrivate: false,
            relationType: m.relationType,
            latitude: m.latitude,
            longitude: m.longitude,
            isOnline: true,
            lastSeenAt: new Date(),
          },
        },
        demographic: {
          create: {
            birthDate: new Date(m.birthDate),
            gender: Gender.FEMALE,
            height: m.height,
            weight: m.weight,
            degree: m.degree,
            job: m.job,
            relationStatus: m.relationStatus,
            cityId,
          },
        },
        preferences: {
          create: {
            relation: m.relationType,
            drinking: m.drinking,
            smoking: m.smoking,
            kids: m.kids,
            pets: m.pets,
          },
        },
        personality: {
          create: {
            mood: m.mood,
            starSign: m.starSign,
          },
        },
        gallery: {
          create: [
            {
              imageUrl: `images/${m.avatarFile}`,
              description: m.avatarDesc,
              likesCount: 25 + (idx % 15),
              isProfilePicture: true,
            },
            {
              imageUrl: `images/${m.galleryFile}`,
              description: m.galleryDesc,
              likesCount: 18 + (idx % 12),
              isProfilePicture: false,
            },
          ],
        },
      },
    });

    await answerAllQuestionsForUser(newUser.id, (idx + 5) % 10);
    await assignInterestsToUser(newUser.id, m.interests);
    console.log(`  ✅ User ${userNum} created: ID #${newUser.id} (${newUser.email}) with 2 gallery photos, avatar & selfie, questions, and interests`);
  }

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
