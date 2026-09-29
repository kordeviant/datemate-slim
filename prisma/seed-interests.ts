/**
 * Seed script to populate the database with initial interest categories and interests
 * based on the app mockup design.
 *
 * Usage: npx ts-node prisma/seed-interests.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface InterestSeed {
  nameEn: string;
  nameFa: string;
  media?: string;
}

interface InterestCategorySeed {
  nameEn: string;
  nameFa: string;
  media?: string;
  interests: InterestSeed[];
}

const interestCategories: InterestCategorySeed[] = [
  {
    nameEn: 'Food',
    nameFa: 'غذا',
    media: 'icons/Beach With Umbrella.svg',
    interests: [
      { nameEn: 'Gaming', nameFa: 'بازی' },
      { nameEn: 'Camping', nameFa: 'کمپینگ' },
      { nameEn: 'Movies', nameFa: 'فیلم' },
      { nameEn: 'Nature', nameFa: 'طبیعت' },
      { nameEn: 'Studying', nameFa: 'مطالعه' },
      { nameEn: 'Fast food', nameFa: 'فست فود' },
      { nameEn: 'Healthy food', nameFa: 'غذای سالم' },
      { nameEn: 'Cooking', nameFa: 'آشپزی' },
      { nameEn: 'Coffee', nameFa: 'قهوه' },
      { nameEn: 'Tea', nameFa: 'چای' },
    ],
  },
  {
    nameEn: 'Sport',
    nameFa: 'ورزش',
    media: 'icons/Beach With Umbrella (1).svg',
    interests: [
      { nameEn: 'Football', nameFa: 'فوتبال' },
      { nameEn: 'Basketball', nameFa: 'بسکتبال' },
      { nameEn: 'Swimming', nameFa: 'شنا' },
      { nameEn: 'Running', nameFa: 'دویدن' },
      { nameEn: 'Yoga', nameFa: 'یوگا' },
      { nameEn: 'Gym', nameFa: 'باشگاه' },
      { nameEn: 'Tennis', nameFa: 'تنیس' },
      { nameEn: 'Hiking', nameFa: 'کوهنوردی' },
      { nameEn: 'Cycling', nameFa: 'دوچرخه‌سواری' },
      { nameEn: 'Martial arts', nameFa: 'هنرهای رزمی' },
    ],
  },
  {
    nameEn: 'Movie',
    nameFa: 'فیلم',
    media: 'icons/Beach With Umbrella (2).svg',
    interests: [
      { nameEn: 'Action', nameFa: 'اکشن' },
      { nameEn: 'Comedy', nameFa: 'کمدی' },
      { nameEn: 'Drama', nameFa: 'درام' },
      { nameEn: 'Horror', nameFa: 'ترسناک' },
      { nameEn: 'Sci-Fi', nameFa: 'علمی تخیلی' },

      { nameEn: 'Romance', nameFa: 'عاشقانه' },
      { nameEn: 'Documentary', nameFa: 'مستند' },
      { nameEn: 'Animation', nameFa: 'انیمیشن' },
      { nameEn: 'Thriller', nameFa: 'هیجان‌انگیز' },
      { nameEn: 'Series', nameFa: 'سریال' },
    ],
  },
  {
    nameEn: 'Travel',
    nameFa: 'سفر',
    media: 'icons/travel.svg',
    interests: [
      { nameEn: 'Beach', nameFa: 'ساحل' },
      { nameEn: 'Mountain', nameFa: 'کوهستان' },
      { nameEn: 'Camping', nameFa: 'کمپینگ' },
      { nameEn: 'City trips', nameFa: 'سفر شهری' },
      { nameEn: 'Backpacking', nameFa: 'کوله‌گردی' },
      { nameEn: 'Road trips', nameFa: 'سفر جاده‌ای' },
      { nameEn: 'Cultural trips', nameFa: 'سفر فرهنگی' },
      { nameEn: 'Adventure', nameFa: 'ماجراجویی' },
    ],
  },
  // {
  //   nameEn: 'Gaming',
  //   nameFa: 'بازی',
  //   media: 'icons/gaming.svg',
  //   interests: [
  //     { nameEn: 'PC Gaming', nameFa: 'بازی کامپیوتر' },
  //     { nameEn: 'Console', nameFa: 'کنسول' },
  //     { nameEn: 'Mobile games', nameFa: 'بازی موبایل' },
  //     { nameEn: 'Board games', nameFa: 'بازی فکری' },
  //     { nameEn: 'RPG', nameFa: 'نقش‌آفرینی' },
  //     { nameEn: 'FPS', nameFa: 'تیراندازی' },
  //     { nameEn: 'Strategy', nameFa: 'استراتژی' },
  //     { nameEn: 'Sports games', nameFa: 'بازی ورزشی' },
  //   ],
  // },
  // {
  //   nameEn: 'Art',
  //   nameFa: 'هنر',
  //   media: 'icons/art.svg',
  //   interests: [
  //     { nameEn: 'Painting', nameFa: 'نقاشی' },
  //     { nameEn: 'Photography', nameFa: 'عکاسی' },
  //     { nameEn: 'Drawing', nameFa: 'طراحی' },
  //     { nameEn: 'Sculpture', nameFa: 'مجسمه‌سازی' },
  //     { nameEn: 'Theater', nameFa: 'تئاتر' },
  //     { nameEn: 'Poetry', nameFa: 'شعر' },
  //     { nameEn: 'Calligraphy', nameFa: 'خوشنویسی' },
  //     { nameEn: 'Crafts', nameFa: 'صنایع دستی' },
  //   ],
  // },
  // {
  //   nameEn: 'Nature',
  //   nameFa: 'طبیعت',
  //   media: 'icons/nature.svg',
  //   interests: [
  //     { nameEn: 'Gardening', nameFa: 'باغبانی' },
  //     { nameEn: 'Bird watching', nameFa: 'پرنده‌نگری' },
  //     { nameEn: 'Stargazing', nameFa: 'ستاره‌شناسی' },
  //     { nameEn: 'Fishing', nameFa: 'ماهیگیری' },
  //     { nameEn: 'Forests', nameFa: 'جنگل' },
  //     { nameEn: 'Flower arranging', nameFa: 'گل‌آرایی' },
  //     { nameEn: 'Wildlife', nameFa: 'حیات وحش' },
  //   ],
  // },
  // {
  //   nameEn: 'Reading',
  //   nameFa: 'کتاب‌خوانی',
  //   media: 'icons/reading.svg',
  //   interests: [
  //     { nameEn: 'Fiction', nameFa: 'داستانی' },
  //     { nameEn: 'Non-fiction', nameFa: 'غیرداستانی' },
  //     { nameEn: 'Self-help', nameFa: 'خودیاری' },
  //     { nameEn: 'Fantasy', nameFa: 'فانتزی' },
  //     { nameEn: 'History', nameFa: 'تاریخ' },
  //     { nameEn: 'Science', nameFa: 'علم' },
  //     { nameEn: 'Manga', nameFa: 'مانگا' },
  //     { nameEn: 'Philosophy', nameFa: 'فلسفه' },
  //   ],
  // },
  // {
  //   nameEn: 'Technology',
  //   nameFa: 'فناوری',
  //   media: 'icons/technology.svg',
  //   interests: [
  //     { nameEn: 'Programming', nameFa: 'برنامه‌نویسی' },
  //     { nameEn: 'AI', nameFa: 'هوش مصنوعی' },
  //     { nameEn: 'Gadgets', nameFa: 'گجت‌ها' },
  //     { nameEn: 'Web development', nameFa: 'توسعه وب' },
  //     { nameEn: 'Crypto', nameFa: 'ارز دیجیتال' },
  //     { nameEn: 'Robotics', nameFa: 'رباتیک' },
  //     { nameEn: 'Startups', nameFa: 'استارتاپ' },
  //   ],
  // },
];

function seedInterestIcons() {
  console.log('🎨 Seeding interest icons into media storage...');
  const targetDir = path.join(process.cwd(), 'uploads', 'icons');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Candidate directories for interest icons
  const candidateDirs = [
    path.join(process.cwd(), 'seed-icons', 'intersets'),
    path.join(process.cwd(), 'seed-icons', 'interests'),
    path.join(process.cwd(), 'seed-icons'),
  ];


  let copiedTotal = 0;
  const processedFiles = new Set<string>();

  for (const sourceDir of candidateDirs) {
    if (!fs.existsSync(sourceDir)) continue;

    const files = fs.readdirSync(sourceDir);
    for (const file of files) {
      if (processedFiles.has(file)) continue;

      const srcFile = path.join(sourceDir, file);
      if (!fs.statSync(srcFile).isFile()) continue;

      const destFile = path.join(targetDir, file);
      fs.copyFileSync(srcFile, destFile);
      processedFiles.add(file);
      copiedTotal++;
    }
  }

  if (copiedTotal > 0) {
    console.log(`  📁 Copied ${copiedTotal} interest icons into uploads/icons/`);
  } else {
    console.warn('⚠️  Interest icons source directory not found. Skipping file copy.');
  }
}

async function seedInterests() {
  seedInterestIcons();

  console.log('\n🌱 Seeding interest categories...');

  for (const category of interestCategories) {
    const existing = await prisma.interestCategory.findFirst({
      where: { nameEn: category.nameEn },
    });

    if (existing) {
      // Update category media if needed
      await prisma.interestCategory.update({
        where: { id: existing.id },
        data: {
          media: category.media || existing.media,
        },
      });

      // Upsert interests within category
      for (const interest of category.interests) {
        const existingInterest = await prisma.interest.findFirst({
          where: {
            categoryId: existing.id,
            nameEn: interest.nameEn,
          },
        });

        if (!existingInterest) {
          await prisma.interest.create({
            data: {
              categoryId: existing.id,
              nameEn: interest.nameEn,
              nameFa: interest.nameFa,
              media: interest.media,
            },
          });
          console.log(`  ➕ Added interest "${interest.nameEn}" to category "${category.nameEn}"`);
        }
      }

      console.log(`  🔄 Updated category "${category.nameEn}" (#${existing.id})`);
      continue;
    }

    const created = await prisma.interestCategory.create({
      data: {
        nameEn: category.nameEn,
        nameFa: category.nameFa,
        media: category.media,
        interests: {
          create: category.interests.map((i) => ({
            nameEn: i.nameEn,
            nameFa: i.nameFa,
            media: i.media,
          })),
        },
      },
      include: { interests: true },
    });
    console.log(
      `  ✅ Created category "${created.nameEn}" (#${created.id}) with ${created.interests.length} interests`,
    );
  }

  const finalCounts = await prisma.interestCategory.findMany({
    include: { _count: { select: { interests: true } } },
  });
  console.log('\n🎉 Interest seeding finished! Categories:');
  for (const cat of finalCounts) {
    console.log(`  📂 ${cat.nameEn}: ${cat._count.interests} interests`);
  }
}

seedInterests()
  .catch((e) => {
    console.error('❌ Interest seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
