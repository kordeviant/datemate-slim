/**
 * Seed script to populate the database with initial PERSONALITY questions
 * from the provided English/Persian question data files.
 *
 * Usage: npx ts-node prisma/seed-questions.ts
 */
import { PrismaClient, QuestionType } from '@prisma/client';

const prisma = new PrismaClient();

interface QuestionSeed {
  type: QuestionType;
  nameEn: string;
  nameFa: string;
  answers: Array<{ answerEn: string; answerFa: string }>;
}

const personalityQuestions: QuestionSeed[] = [
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'How do you take care of yourself?',
    nameFa: 'چگونه از خود مراقبت می‌کنید؟',
    answers: [
      { answerEn: 'Meditation and mindfulness practices.', answerFa: 'مراقبه و تمرین‌های ذهن‌آگاهی.' },
      { answerEn: 'Spending time with loved ones.', answerFa: 'وقت گذراندن با عزیزان.' },
      { answerEn: 'Exploring nature on a hike or walk.', answerFa: 'کشف طبیعت در یک پیاده‌روی یا کوه‌پیمایی.' },
      { answerEn: 'Eating a meal and watching a movie.', answerFa: 'خوردن غذا و تماشای فیلم.' },
      { answerEn: 'Catching up on sleep is essential.', answerFa: 'جبران خواب ضروری است.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What should someone be aware of before dating you?',
    nameFa: 'قبل از قرار گذاشتن با شما، طرف مقابل باید چه چیزی را بداند؟',
    answers: [
      { answerEn: 'I need my alone time.', answerFa: 'من به زمان تنهایی‌ام نیاز دارم.' },
      { answerEn: 'I have a busy work schedule, so I need someone who understands that.', answerFa: 'من برنامه کاری پرمشغله‌ای دارم، بنابراین به کسی نیاز دارم که این را درک کند.' },
      { answerEn: 'I love adventure and trying new things, so be prepared for spontaneity.', answerFa: 'من عاشق ماجراجویی و امتحان کردن چیزهای جدید هستم، پس برای غافلگیری آماده باشید.' },
      { answerEn: 'Communication is very important to me, so I appreciate openness and honesty.', answerFa: 'ارتباط برای من خیلی مهم است، بنابراین از صراحت و صداقت قدردانی می‌کنم.' },
      { answerEn: 'My friends and family are a big part of my life, and I value spending time with them.', answerFa: 'دوستان و خانواده‌ام بخش بزرگی از زندگی من هستند و برای وقت گذراندن با آن‌ها ارزش قائلم.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's one thing on your wish list?",
    nameFa: 'یک چیز در لیست آرزوهای شما چیست؟',
    answers: [
      { answerEn: 'Master playing a musical instrument.', answerFa: 'تسلط بر نواختن یک ساز موسیقی.' },
      { answerEn: 'Learn a new language.', answerFa: 'یادگیری یک زبان جدید.' },
      { answerEn: 'Write a book.', answerFa: 'نوشتن یک کتاب.' },
      { answerEn: 'Launch my own company.', answerFa: 'راه‌اندازی شرکت خودم.' },
      { answerEn: 'Relocate to another country.', answerFa: 'مهاجرت به کشور دیگر.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's one thing others should know about you?",
    nameFa: 'یک چیز که دیگران باید درباره شما بدانند چیست؟',
    answers: [
      { answerEn: 'Meeting my best friend is a must.', answerFa: 'ملاقات با بهترین دوستم ضروری است.' },
      { answerEn: "I'm secretly passionate about something.", answerFa: 'من در خفا به چیزی علاقه‌مندم.' },
      { answerEn: "I'm quite the homebody.", answerFa: 'من کاملاً خانه‌نشین هستم.' },
      { answerEn: 'I have a great sense of humor.', answerFa: 'من حس شوخ‌طبعی خوبی دارم.' },
      { answerEn: "I'm always up for an adventure.", answerFa: 'من همیشه آماده ماجراجویی هستم.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'How would your best friend describe you?',
    nameFa: 'بهترین دوستتان شما را چگونه توصیف می‌کند؟',
    answers: [
      { answerEn: 'Extremely caring.', answerFa: 'بسیار مراقب و دلسوز.' },
      { answerEn: 'An excellent cook.', answerFa: 'یک آشپز عالی.' },
      { answerEn: 'The center of the party.', answerFa: 'مرکز توجه مهمانی.' },
      { answerEn: 'Always on time.', answerFa: 'همیشه سر وقت.' },
      { answerEn: 'A natural problem solver.', answerFa: 'یک حلال مشکلات طبیعی.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's your vision of an ideal life?",
    nameFa: 'دیدگاه شما از یک زندگی ایده‌آل چیست؟',
    answers: [
      { answerEn: 'Making a meaningful difference.', answerFa: 'ایجاد تفاوتی معنادار.' },
      { answerEn: 'Traveling extensively.', answerFa: 'سفر فراوان.' },
      { answerEn: 'A career that fulfills me.', answerFa: 'شغلی که مرا ارضا کند.' },
      { answerEn: 'A large home and a fancy vehicle.', answerFa: 'یک خانه بزرگ و یک ماشین شیک.' },
      { answerEn: 'Big family gatherings.', answerFa: 'دورهمی‌های بزرگ خانوادگی.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's your perfect first date?",
    nameFa: 'اولین قرار کامل شما چگونه است؟',
    answers: [
      { answerEn: 'Wine and dine me.', answerFa: 'شام و نوشیدنی.' },
      { answerEn: 'Coffee and good conversation.', answerFa: 'قهوه و گفتگوی خوب.' },
      { answerEn: 'Something active — count me in!', answerFa: 'انجام یک فعالیت پر انرژی!' },
      { answerEn: 'I enjoy surprises.', answerFa: 'از سورپرایز لذت می‌برم.' },
      { answerEn: 'Doing something we both enjoy.', answerFa: 'انجام کاری که هر دو دوست داریم.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'How do you feel about astrology?',
    nameFa: 'نظر شما در مورد طالع‌بینی چیست؟',
    answers: [
      { answerEn: 'I find it fascinating and often accurate.', answerFa: 'برایم جذاب است و اغلب هم دقیق به نظر می‌رسد.' },
      { answerEn: "I'm skeptical but curious about it.", answerFa: 'نسبت به آن تردید دارم اما کنجکاو هستم.' },
      { answerEn: 'I enjoy reading horoscopes for fun.', answerFa: 'خواندن طالع‌بینی‌ها برایم سرگرم‌کننده است.' },
      { answerEn: 'I believe it offers valuable insights into personalities.', answerFa: 'معتقدم که بینش‌های ارزشمندی درباره شخصیت‌ها ارائه می‌دهد.' },
      { answerEn: "I don't pay much attention to it.", answerFa: 'خیلی به آن توجه نمی‌کنم.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's your favorite trait about yourself?",
    nameFa: 'بهترین ویژگی خودتان چیست؟',
    answers: [
      { answerEn: 'My unwavering loyalty.', answerFa: 'وفاداری استوارم.' },
      { answerEn: 'My sense of humor.', answerFa: 'حس شوخ‌طبعی‌ام.' },
      { answerEn: 'My resilience in tough situations.', answerFa: 'تاب‌آوری‌ام در موقعیت‌های سخت.' },
      { answerEn: 'My empathy and compassion for others.', answerFa: 'همدلی و دلسوزی‌ام برای دیگران.' },
      { answerEn: 'My creativity and imagination.', answerFa: 'خلاقیت و تخیل‌ام.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What are you seeking?',
    nameFa: 'به دنبال چه چیزی هستید؟',
    answers: [
      { answerEn: 'New adventures.', answerFa: 'ماجراجویی‌های جدید.' },
      { answerEn: 'Meaningful connections only.', answerFa: 'فقط ارتباطات معنادار.' },
      { answerEn: 'Genuine friendships.', answerFa: 'دوستی‌های واقعی.' },
      { answerEn: 'Fun nights on the town.', answerFa: 'شب‌های سرگرم‌کننده در شهر.' },
      { answerEn: 'Something laid-back and casual.', answerFa: 'چیزی آرام و غیررسمی.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What are you proud of?',
    nameFa: 'به چه چیزی افتخار می‌کنید؟',
    answers: [
      { answerEn: 'My ambition and drive.', answerFa: 'اشتیاق و انگیزه‌ام.' },
      { answerEn: 'Learning to love myself.', answerFa: 'یاد گرفته ام به خودم عشق بورزم.' },
      { answerEn: 'My efforts to stay fit and healthy.', answerFa: 'تلاش‌های من برای حفظ تناسب و سلامت.' },
      { answerEn: 'Standing up for my beliefs.', answerFa: 'ایستادگی در باورهایم.' },
      { answerEn: 'Overcoming challenges and adversity.', answerFa: 'غلبه بر چالش‌ها و سختی‌ها.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What impresses you?',
    nameFa: 'چه چیزی شما را تحت تأثیر قرار می‌دهد؟',
    answers: [
      { answerEn: 'Acts of kindness and generosity', answerFa: 'اعمال مهربانی و سخاوت' },
      { answerEn: 'People who are passionate about what they do.', answerFa: 'افرادی که درباره کارشان شور و شوق دارند' },
      { answerEn: 'Intelligence and a good sense of humor.', answerFa: 'هوش و حس شوخ‌طبعی خوب' },
      { answerEn: 'Creativity and artistic talent.', answerFa: 'خلاقیت و استعداد هنری' },
      { answerEn: 'Someone who listens attentively and empathizes with others.', answerFa: 'کسی که به دقت گوش می‌دهد و با دیگران همدلی می‌کند' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's a cause you're passionate about?",
    nameFa: 'کدام موضوع برای شما اهمیت زیادی دارد؟',
    answers: [
      { answerEn: 'Mental well-being.', answerFa: 'سلامت روان.' },
      { answerEn: 'Volunteering.', answerFa: 'فعالیت های داوطلبانه.' },
      { answerEn: 'Equality for all genders.', answerFa: 'برابری برای همه جنسیت‌ها.' },
      { answerEn: 'Climate action.', answerFa: 'اقدامات اقلیمی.' },
      { answerEn: 'Animal welfare.', answerFa: 'رفاه حیوانات.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What should we agree on?',
    nameFa: 'ما باید در چه موردی موافقت کنیم؟',
    answers: [
      { answerEn: 'Communication Style', answerFa: 'چگونگی بیان افکار و احساسات' },
      { answerEn: 'Future Goals', answerFa: 'اهداف آینده' },
      { answerEn: 'Values and Morals', answerFa: 'ارزش‌ها و اخلاقیات' },
      { answerEn: 'Lifestyle Choices', answerFa: 'انتخاب‌های سبک زندگی' },
      { answerEn: 'Time Together vs. Time Apart', answerFa: 'زمان با هم بودن در مقابل زمان جدا بودن' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What does love mean to you?',
    nameFa: 'برای شما عشق به چه معناست؟',
    answers: [
      { answerEn: 'Sharing daily laughter.', answerFa: 'به اشتراک گذاشتن خنده‌های روزانه.' },
      { answerEn: 'Continuously supporting each other.', answerFa: 'پشتیبانی مداوم از یکدیگر.' },
      { answerEn: 'Being accepted as you are.', answerFa: 'پذیرفتن شما همانطوری که هستید.' },
      { answerEn: 'Being transparent and sincere.', answerFa: 'شفاف و صادق بودن.' },
      { answerEn: 'Trying to create quality moments together.', answerFa: 'تلاش برای ایجاد لحظات با کیفیت با یکدیگر.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's your biggest dealBreaker?",
    nameFa: 'بزرگ‌ترین عامل جدایی از طرف مقابلتان برای شما چه میتواند باشد؟',
    answers: [
      { answerEn: 'Dishonesty', answerFa: 'بی‌صداقتی' },
      { answerEn: 'Poor Communication', answerFa: 'ارتباط ضعیف' },
      { answerEn: 'Disrespect', answerFa: 'بی‌احترامی' },
      { answerEn: 'Different Life Goals', answerFa: 'اهداف زندگی متفاوت' },
      { answerEn: "If you're into non-monogamy.", answerFa: 'پایبند نبودن به تک عشقی.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What do you value most in a partner?',
    nameFa: 'در شریک زندگی خود بیش از همه به چه چیزی ارزش می‌نهید؟',
    answers: [
      { answerEn: 'A close relationship with family.', answerFa: 'رابطه نزدیک با خانواده.' },
      { answerEn: 'Encouraging of my aspirations.', answerFa: 'تشویق به آرزوهایم.' },
      { answerEn: 'Honest yet gentle.', answerFa: 'صادق اما ملایم بودن.' },
      { answerEn: 'Clear communicator.', answerFa: 'ارتباط‌ برقرار کردن واضح.' },
      { answerEn: 'Adventurous spirit.', answerFa: 'روحیه ماجراجویانه.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What makes you laugh?',
    nameFa: 'چه چیزی شما را می‌خنداند؟',
    answers: [
      { answerEn: 'Silky dad jokes.', answerFa: 'جوک‌های پدری آبکی.' },
      { answerEn: 'My go-to comedian.', answerFa: 'کمدین مورد علاقه‌ام.' },
      { answerEn: "You've gotta be sarcastic.", answerFa: 'باید طعنه‌آمیز باشی.' },
      { answerEn: 'Share your funniest memes.', answerFa: 'به اشتراک گذاشتن خنده‌دارترین میم‌هایت.' },
      { answerEn: 'Try and see.', answerFa: 'سعی کن و ببین.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's your dating goal this year?",
    nameFa: 'هدف شما از قرارهای ملاقات در امسال چیست؟',
    answers: [
      { answerEn: 'Understand what I truly desire.', answerFa: 'فهمیدن آنچه که واقعاً می‌خواهم.' },
      { answerEn: 'Meet a wide variety of people.', answerFa: 'شناخت انواع مختلفی از افراد.' },
      { answerEn: 'Find a lifelong partner.', answerFa: 'یافتن شریک زندگی مادام‌العمر.' },
      { answerEn: 'Find a partner for a Specific period of time.', answerFa: 'پیدا کردن یک پارتنر برای یک بازه ی زمانی مشخص.' },
      { answerEn: 'Building meaningful relationships.', answerFa: 'ساختن روابط معنادار.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's your favorite music genre?",
    nameFa: 'ژانر موسیقی مورد علاقه شما چیست؟',
    answers: [
      { answerEn: 'Songs from the past.', answerFa: 'آهنگ‌های قدیمی.' },
      { answerEn: 'Lyric-driven songs.', answerFa: 'آهنگ‌هایی با اشعار برجسته.' },
      { answerEn: 'Danceable tracks.', answerFa: 'ترانه‌های قابل رقص.' },
      { answerEn: 'Relaxing songs.', answerFa: 'موسیقی های آرامش‌بخش.' },
      { answerEn: 'Discovering new tunes.', answerFa: 'کشف آهنگ‌های جدید.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's your dream career?",
    nameFa: 'شغل رویایی شما چیست؟',
    answers: [
      { answerEn: 'Selling my own creations.', answerFa: 'فروش آثار خلاقانه ی خودم.' },
      { answerEn: 'Earning without effort.', answerFa: 'درآمد بدون تلاش.' },
      { answerEn: 'Becoming an influencer.', answerFa: 'تبدیل شدن به یک تأثیرگذار.' },
      { answerEn: 'Being my own boss.', answerFa: 'رئیس خودم بودن.' },
      { answerEn: "I don't aspire to work.", answerFa: 'من علاقه‌ای به کار ندارم.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'What are you currently learning?',
    nameFa: 'در حال حاضر در حال یادگیری چه چیزی هستید؟',
    answers: [
      { answerEn: 'How to start a business.', answerFa: 'چگونگی راه‌اندازی یک کسب و کار.' },
      { answerEn: 'A new creative skill.', answerFa: 'یک مهارت خلاقانه جدید.' },
      { answerEn: 'Honestly, managing my time.', answerFa: 'صادقانه بگویم، مدیریت زمانم.' },
      { answerEn: 'Another language.', answerFa: 'یک زبان دیگر.' },
      { answerEn: 'Culinary skills.', answerFa: 'مهارت‌های آشپزی.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: "What's your perspective on monogamy?",
    nameFa: 'دیدگاه شما درباره تک عشقی چیست؟',
    answers: [
      { answerEn: "It's fine, but not for me.", answerFa: 'خوب است، اما برای من مناسب نیست.' },
      { answerEn: "I'm open to trying it.", answerFa: 'آماده امتحان کردنش هستم.' },
      { answerEn: "I don't support monogamy.", answerFa: 'از تک‌ ‌عشقی حمایت نمی‌کنم.' },
      { answerEn: "It's my only desire.", answerFa: 'تنها آرزوی من است.' },
      { answerEn: 'Depends on my mood.', answerFa: 'بسته به حال و هوای من دارد.' },
    ],
  },
  {
    type: QuestionType.PREFERENCES,
    nameEn: 'How much would you pay on a weekend?',
    nameFa: 'حاظری در یک آخر هفته چقدر پول خرج کنی؟',
    answers: [
      { answerEn: 'Below 10 Dollars.', answerFa: 'کمتر از 10 دلار.' },
      { answerEn: 'Between 10 to 30 Dollars.', answerFa: 'بین 10 تا 30 دلار.' },
      { answerEn: 'Between 30 to 50 Dollars.', answerFa: 'بین 30 تا 50 دلار.' },
      { answerEn: 'More than 50 Dollars.', answerFa: 'بیشتر از 50 دلار.' },
      { answerEn: 'Depends on my mood.', answerFa: 'بستگی به حال و هوای من دارد.' },
    ],
  },
];

async function seedQuestions() {
  console.log('🌱 Seeding personality questions...');

  const existingCount = await prisma.question.count();
  if (existingCount > 0) {
    console.log(`⏭️  Questions table already has ${existingCount} records. Skipping seed.`);
    return;
  }

  for (const question of personalityQuestions) {
    const created = await prisma.question.create({
      data: {
        type: question.type,
        nameEn: question.nameEn,
        nameFa: question.nameFa,
        answers: {
          create: question.answers.map((a) => ({
            answerEn: a.answerEn,
            answerFa: a.answerFa,
          })),
        },
      },
      include: { answers: true },
    });
    console.log(`  ✅ Created question #${created.id}: "${created.nameEn}" (${created.answers.length} answers)`);
  }

  console.log(`\n🎉 Seeded ${personalityQuestions.length} personality questions successfully!`);
}

seedQuestions()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
