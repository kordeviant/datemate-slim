/**
 * Seed script to populate the database with initial PERSONALITY questions
 * from the provided English/Persian question data files.
 *
 * Usage: npx ts-node prisma/seed-questions.ts
 */
import { PrismaClient, QuestionType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const prisma = new PrismaClient();

interface QuestionSeed {
  type: QuestionType;
  nameEn: string;
  nameFa: string;
  icon?: string;
  iconAlt?: string;
  answers: Array<{ answerEn: string; answerFa: string }>;
}

const preferencesQuestions: QuestionSeed[] = [
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'How do you take care of yourself?',
  //   nameFa: 'چگونه از خود مراقبت می‌کنید؟',
  //   answers: [
  //     { answerEn: 'Meditation and mindfulness practices.', answerFa: 'مراقبه و تمرین‌های ذهن‌آگاهی.' },
  //     { answerEn: 'Spending time with loved ones.', answerFa: 'وقت گذراندن با عزیزان.' },
  //     { answerEn: 'Exploring nature on a hike or walk.', answerFa: 'کشف طبیعت در یک پیاده‌روی یا کوه‌پیمایی.' },
  //     { answerEn: 'Eating a meal and watching a movie.', answerFa: 'خوردن غذا و تماشای فیلم.' },
  //     { answerEn: 'Catching up on sleep is essential.', answerFa: 'جبران خواب ضروری است.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'What should someone be aware of before dating you?',
  //   nameFa: 'قبل از قرار گذاشتن با شما، طرف مقابل باید چه چیزی را بداند؟',
  //   answers: [
  //     { answerEn: 'I need my alone time.', answerFa: 'من به زمان تنهایی‌ام نیاز دارم.' },
  //     { answerEn: 'I have a busy work schedule, so I need someone who understands that.', answerFa: 'من برنامه کاری پرمشغله‌ای دارم، بنابراین به کسی نیاز دارم که این را درک کند.' },
  //     { answerEn: 'I love adventure and trying new things, so be prepared for spontaneity.', answerFa: 'من عاشق ماجراجویی و امتحان کردن چیزهای جدید هستم، پس برای غافلگیری آماده باشید.' },
  //     { answerEn: 'Communication is very important to me, so I appreciate openness and honesty.', answerFa: 'ارتباط برای من خیلی مهم است، بنابراین از صراحت و صداقت قدردانی می‌کنم.' },
  //     { answerEn: 'My friends and family are a big part of my life, and I value spending time with them.', answerFa: 'دوستان و خانواده‌ام بخش بزرگی از زندگی من هستند و برای وقت گذراندن با آن‌ها ارزش قائلم.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: "What's one thing on your wish list?",
  //   nameFa: 'یک چیز در لیست آرزوهای شما چیست؟',
  //   answers: [
  //     { answerEn: 'Master playing a musical instrument.', answerFa: 'تسلط بر نواختن یک ساز موسیقی.' },
  //     { answerEn: 'Learn a new language.', answerFa: 'یادگیری یک زبان جدید.' },
  //     { answerEn: 'Write a book.', answerFa: 'نوشتن یک کتاب.' },
  //     { answerEn: 'Launch my own company.', answerFa: 'راه‌اندازی شرکت خودم.' },
  //     { answerEn: 'Relocate to another country.', answerFa: 'مهاجرت به کشور دیگر.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: "What's one thing others should know about you?",
  //   nameFa: 'یک چیز که دیگران باید درباره شما بدانند چیست؟',
  //   answers: [
  //     { answerEn: 'Meeting my best friend is a must.', answerFa: 'ملاقات با بهترین دوستم ضروری است.' },
  //     { answerEn: "I'm secretly passionate about something.", answerFa: 'من در خفا به چیزی علاقه‌مندم.' },
  //     { answerEn: "I'm quite the homebody.", answerFa: 'من کاملاً خانه‌نشین هستم.' },
  //     { answerEn: 'I have a great sense of humor.', answerFa: 'من حس شوخ‌طبعی خوبی دارم.' },
  //     { answerEn: "I'm always up for an adventure.", answerFa: 'من همیشه آماده ماجراجویی هستم.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'How would your best friend describe you?',
  //   nameFa: 'بهترین دوستتان شما را چگونه توصیف می‌کند؟',
  //   answers: [
  //     { answerEn: 'Extremely caring.', answerFa: 'بسیار مراقب و دلسوز.' },
  //     { answerEn: 'An excellent cook.', answerFa: 'یک آشپز عالی.' },
  //     { answerEn: 'The center of the party.', answerFa: 'مرکز توجه مهمانی.' },
  //     { answerEn: 'Always on time.', answerFa: 'همیشه سر وقت.' },
  //     { answerEn: 'A natural problem solver.', answerFa: 'یک حلال مشکلات طبیعی.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: "What's your vision of an ideal life?",
  //   nameFa: 'دیدگاه شما از یک زندگی ایده‌آل چیست؟',
  //   answers: [
  //     { answerEn: 'Making a meaningful difference.', answerFa: 'ایجاد تفاوتی معنادار.' },
  //     { answerEn: 'Traveling extensively.', answerFa: 'سفر فراوان.' },
  //     { answerEn: 'A career that fulfills me.', answerFa: 'شغلی که مرا ارضا کند.' },
  //     { answerEn: 'A large home and a fancy vehicle.', answerFa: 'یک خانه بزرگ و یک ماشین شیک.' },
  //     { answerEn: 'Big family gatherings.', answerFa: 'دورهمی‌های بزرگ خانوادگی.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: "What's your perfect first date?",
  //   nameFa: 'اولین قرار کامل شما چگونه است؟',
  //   answers: [
  //     { answerEn: 'Wine and dine me.', answerFa: 'شام و نوشیدنی.' },
  //     { answerEn: 'Coffee and good conversation.', answerFa: 'قهوه و گفتگوی خوب.' },
  //     { answerEn: 'Something active — count me in!', answerFa: 'انجام یک فعالیت پر انرژی!' },
  //     { answerEn: 'I enjoy surprises.', answerFa: 'از سورپرایز لذت می‌برم.' },
  //     { answerEn: 'Doing something we both enjoy.', answerFa: 'انجام کاری که هر دو دوست داریم.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'How do you feel about astrology?',
  //   nameFa: 'نظر شما در مورد طالع‌بینی چیست؟',
  //   answers: [
  //     { answerEn: 'I find it fascinating and often accurate.', answerFa: 'برایم جذاب است و اغلب هم دقیق به نظر می‌رسد.' },
  //     { answerEn: "I'm skeptical but curious about it.", answerFa: 'نسبت به آن تردید دارم اما کنجکاو هستم.' },
  //     { answerEn: 'I enjoy reading horoscopes for fun.', answerFa: 'خواندن طالع‌بینی‌ها برایم سرگرم‌کننده است.' },
  //     { answerEn: 'I believe it offers valuable insights into personalities.', answerFa: 'معتقدم که بینش‌های ارزشمندی درباره شخصیت‌ها ارائه می‌دهد.' },
  //     { answerEn: "I don't pay much attention to it.", answerFa: 'خیلی به آن توجه نمی‌کنم.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: "What's your favorite trait about yourself?",
  //   nameFa: 'بهترین ویژگی خودتان چیست؟',
  //   answers: [
  //     { answerEn: 'My unwavering loyalty.', answerFa: 'وفاداری استوارم.' },
  //     { answerEn: 'My sense of humor.', answerFa: 'حس شوخ‌طبعی‌ام.' },
  //     { answerEn: 'My resilience in tough situations.', answerFa: 'تاب‌آوری‌ام در موقعیت‌های سخت.' },
  //     { answerEn: 'My empathy and compassion for others.', answerFa: 'همدلی و دلسوزی‌ام برای دیگران.' },
  //     { answerEn: 'My creativity and imagination.', answerFa: 'خلاقیت و تخیل‌ام.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'What are you seeking?',
  //   nameFa: 'به دنبال چه چیزی هستید؟',
  //   answers: [
  //     { answerEn: 'New adventures.', answerFa: 'ماجراجویی‌های جدید.' },
  //     { answerEn: 'Meaningful connections only.', answerFa: 'فقط ارتباطات معنادار.' },
  //     { answerEn: 'Genuine friendships.', answerFa: 'دوستی‌های واقعی.' },
  //     { answerEn: 'Fun nights on the town.', answerFa: 'شب‌های سرگرم‌کننده در شهر.' },
  //     { answerEn: 'Something laid-back and casual.', answerFa: 'چیزی آرام و غیررسمی.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'What are you proud of?',
  //   nameFa: 'به چه چیزی افتخار می‌کنید؟',
  //   answers: [
  //     { answerEn: 'My ambition and drive.', answerFa: 'اشتیاق و انگیزه‌ام.' },
  //     { answerEn: 'Learning to love myself.', answerFa: 'یاد گرفته ام به خودم عشق بورزم.' },
  //     { answerEn: 'My efforts to stay fit and healthy.', answerFa: 'تلاش‌های من برای حفظ تناسب و سلامت.' },
  //     { answerEn: 'Standing up for my beliefs.', answerFa: 'ایستادگی در باورهایم.' },
  //     { answerEn: 'Overcoming challenges and adversity.', answerFa: 'غلبه بر چالش‌ها و سختی‌ها.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'What impresses you?',
  //   nameFa: 'چه چیزی شما را تحت تأثیر قرار می‌دهد؟',
  //   answers: [
  //     { answerEn: 'Acts of kindness and generosity', answerFa: 'اعمال مهربانی و سخاوت' },
  //     { answerEn: 'People who are passionate about what they do.', answerFa: 'افرادی که درباره کارشان شور و شوق دارند' },
  //     { answerEn: 'Intelligence and a good sense of humor.', answerFa: 'هوش و حس شوخ‌طبعی خوب' },
  //     { answerEn: 'Creativity and artistic talent.', answerFa: 'خلاقیت و استعداد هنری' },
  //     { answerEn: 'Someone who listens attentively and empathizes with others.', answerFa: 'کسی که به دقت گوش می‌دهد و با دیگران همدلی می‌کند' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: "What's a cause you're passionate about?",
  //   nameFa: 'کدام موضوع برای شما اهمیت زیادی دارد؟',
  //   answers: [
  //     { answerEn: 'Mental well-being.', answerFa: 'سلامت روان.' },
  //     { answerEn: 'Volunteering.', answerFa: 'فعالیت های داوطلبانه.' },
  //     { answerEn: 'Equality for all genders.', answerFa: 'برابری برای همه جنسیت‌ها.' },
  //     { answerEn: 'Climate action.', answerFa: 'اقدامات اقلیمی.' },
  //     { answerEn: 'Animal welfare.', answerFa: 'رفاه حیوانات.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'What should we agree on?',
  //   nameFa: 'ما باید در چه موردی موافقت کنیم؟',
  //   answers: [
  //     { answerEn: 'Communication Style', answerFa: 'چگونگی بیان افکار و احساسات' },
  //     { answerEn: 'Future Goals', answerFa: 'اهداف آینده' },
  //     { answerEn: 'Values and Morals', answerFa: 'ارزش‌ها و اخلاقیات' },
  //     { answerEn: 'Lifestyle Choices', answerFa: 'انتخاب‌های سبک زندگی' },
  //     { answerEn: 'Time Together vs. Time Apart', answerFa: 'زمان با هم بودن در مقابل زمان جدا بودن' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'What does love mean to you?',
  //   nameFa: 'برای شما عشق به چه معناست؟',
  //   answers: [
  //     { answerEn: 'Sharing daily laughter.', answerFa: 'به اشتراک گذاشتن خنده‌های روزانه.' },
  //     { answerEn: 'Continuously supporting each other.', answerFa: 'پشتیبانی مداوم از یکدیگر.' },
  //     { answerEn: 'Being accepted as you are.', answerFa: 'پذیرفتن شما همانطوری که هستید.' },
  //     { answerEn: 'Being transparent and sincere.', answerFa: 'شفاف و صادق بودن.' },
  //     { answerEn: 'Trying to create quality moments together.', answerFa: 'تلاش برای ایجاد لحظات با کیفیت با یکدیگر.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: "What's your biggest dealBreaker?",
  //   nameFa: 'بزرگ‌ترین عامل جدایی از طرف مقابلتان برای شما چه میتواند باشد؟',
  //   answers: [
  //     { answerEn: 'Dishonesty', answerFa: 'بی‌صداقتی' },
  //     { answerEn: 'Poor Communication', answerFa: 'ارتباط ضعیف' },
  //     { answerEn: 'Disrespect', answerFa: 'بی‌احترامی' },
  //     { answerEn: 'Different Life Goals', answerFa: 'اهداف زندگی متفاوت' },
  //     { answerEn: "If you're into non-monogamy.", answerFa: 'پایبند نبودن به تک عشقی.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'What do you value most in a partner?',
  //   nameFa: 'در شریک زندگی خود بیش از همه به چه چیزی ارزش می‌نهید؟',
  //   answers: [
  //     { answerEn: 'A close relationship with family.', answerFa: 'رابطه نزدیک با خانواده.' },
  //     { answerEn: 'Encouraging of my aspirations.', answerFa: 'تشویق به آرزوهایم.' },
  //     { answerEn: 'Honest yet gentle.', answerFa: 'صادق اما ملایم بودن.' },
  //     { answerEn: 'Clear communicator.', answerFa: 'ارتباط‌ برقرار کردن واضح.' },
  //     { answerEn: 'Adventurous spirit.', answerFa: 'روحیه ماجراجویانه.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: 'What makes you laugh?',
  //   nameFa: 'چه چیزی شما را می‌خنداند؟',
  //   answers: [
  //     { answerEn: 'Silky dad jokes.', answerFa: 'جوک‌های پدری آبکی.' },
  //     { answerEn: 'My go-to comedian.', answerFa: 'کمدین مورد علاقه‌ام.' },
  //     { answerEn: "You've gotta be sarcastic.", answerFa: 'باید طعنه‌آمیز باشی.' },
  //     { answerEn: 'Share your funniest memes.', answerFa: 'به اشتراک گذاشتن خنده‌دارترین میم‌هایت.' },
  //     { answerEn: 'Try and see.', answerFa: 'سعی کن و ببین.' },
  //   ],
  // },
  // {
  //   type: QuestionType.PREFERENCES,
  //   nameEn: "What's your dating goal this year?",
  //   nameFa: 'هدف شما از قرارهای ملاقات در امسال چیست؟',
  //   icon: 'icons/goal.svg',
  //   iconAlt: 'Dating goal',
  //   answers: [
  //     { answerEn: 'Understand what I truly desire.', answerFa: 'فهمیدن آنچه که واقعاً می‌خواهم.' },
  //     { answerEn: 'Meet a wide variety of people.', answerFa: 'شناخت انواع مختلفی از افراد.' },
  //     { answerEn: 'Find a lifelong partner.', answerFa: 'یافتن شریک زندگی مادام‌العمر.' },
  //     { answerEn: 'Find a partner for a Specific period of time.', answerFa: 'پیدا کردن یک پارتنر برای یک بازه ی زمانی مشخص.' },
  //     { answerEn: 'Building meaningful relationships.', answerFa: 'ساختن روابط معنادار.' },
  //   ],
  // },
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

const personalityQuestions: QuestionSeed[] = [
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'What is your relationship status?',
    nameFa: 'وضعیت تاهل یا رابطه شما چیست؟',
    icon: 'icons/relationship-status.svg',
    iconAlt: 'Relationship status',
    answers: [
      { answerEn: 'Single', answerFa: 'مجرد' },
      { answerEn: 'In a relationship', answerFa: 'در رابطه' },
      { answerEn: 'Married', answerFa: 'متاهل' },
      { answerEn: "It's complicated", answerFa: 'پیچیده است' },
      { answerEn: 'Open relationship', answerFa: 'رابطه باز' },
      { answerEn: 'Divorced', answerFa: 'جدا شده / طلاق گرفته' },
      { answerEn: 'Widowed', answerFa: 'همسر فوت شده' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'How often do you drink?',
    nameFa: 'چقدر نوشیدنی الکلی مصرف می‌کنید؟',
    icon: 'icons/drink.svg',
    iconAlt: 'Drink',
    answers: [
      { answerEn: 'Socially', answerFa: 'در جمع‌های دوستانه و مهمانی‌ها' },
      { answerEn: 'Never', answerFa: 'هرگز' },
      { answerEn: 'Occasionally', answerFa: 'گاهی اوقات' },
      { answerEn: 'Regularly', answerFa: 'به‌طور منظم' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'Do you smoke?',
    nameFa: 'آیا سیگار یا دخانیات مصرف می‌کنید؟',
    icon: 'icons/smoke.svg',
    iconAlt: 'Smoke',
    answers: [
      { answerEn: 'Yes', answerFa: 'بله' },
      { answerEn: 'No', answerFa: 'خیر' },
      { answerEn: 'Sometimes', answerFa: 'گاهی اوقات' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'What are your thoughts on having kids?',
    nameFa: 'دیدگاه شما درباره داشتن فرزند چیست؟',
    icon: 'icons/kids.svg',
    iconAlt: 'Kids',
    answers: [
      { answerEn: 'Love kids', answerFa: 'عاشق بچه‌ها هستم' },
      { answerEn: 'Maybe someday want kids', answerFa: 'شاید در آینده بچه بخواهم' },
      { answerEn: 'Undecided about kids', answerFa: 'هنوز تصمیم نگرفته‌ام' },
      { answerEn: 'Do not want kids', answerFa: 'بچه نمی‌خواهم' },
      { answerEn: 'Already have kids', answerFa: 'در حال حاضر فرزند دارم' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'What is your highest level of education?',
    nameFa: 'بالاترین مدرک تحصیلی شما چیست؟',
    icon: 'icons/education.svg',
    iconAlt: 'Education',
    answers: [
      { answerEn: 'High school diploma', answerFa: 'دیپلم دبیرستان' },
      { answerEn: 'Some college', answerFa: 'دانشجو یا انصرافی' },
      { answerEn: 'Associate degree', answerFa: 'کاردانی / فوق دیپلم' },
      { answerEn: "Bachelor's degree", answerFa: 'کارشناسی / لیسانس' },
      { answerEn: "Master's degree", answerFa: 'کارشناسی ارشد / فوق لیسانس' },
      { answerEn: 'Doctorate', answerFa: 'دکتری' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'How would you describe your personality type?',
    nameFa: 'تیپ شخصیتی خود را چگونه توصیف می‌کنید؟',
    icon: 'icons/mood.svg',
    iconAlt: 'Personality',
    answers: [
      { answerEn: 'Introvert', answerFa: 'درون‌گرا' },
      { answerEn: 'Extrovert', answerFa: 'برون‌گرا' },
      { answerEn: 'Somewhere in between', answerFa: 'میانه‌رو / میان‌گرا' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'What is your zodiac star sign?',
    nameFa: 'ماه تولد یا نماد زودیاک شما چیست؟',
    icon: 'icons/star-sign.svg',
    iconAlt: 'Zodiac',
    answers: [
      { answerEn: 'Aries', answerFa: 'حمل (فروردین)' },
      { answerEn: 'Taurus', answerFa: 'ثور (اردیبهشت)' },
      { answerEn: 'Gemini', answerFa: 'جوزا (خرداد)' },
      { answerEn: 'Cancer', answerFa: 'سرطان (تیر)' },
      { answerEn: 'Leo', answerFa: 'اسد (مرداد)' },
      { answerEn: 'Virgo', answerFa: 'سنبله (شهریور)' },
      { answerEn: 'Libra', answerFa: 'میزان (مهر)' },
      { answerEn: 'Scorpio', answerFa: 'عقرب (آبان)' },
      { answerEn: 'Sagittarius', answerFa: 'قوس (آذر)' },
      { answerEn: 'Capricorn', answerFa: 'جدی (دی)' },
      { answerEn: 'Aquarius', answerFa: 'دلو (بهمن)' },
      { answerEn: 'Pisces', answerFa: 'حوت (اسفند)' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'Do you have any pets?',
    nameFa: 'آیا حیوان خانگی دارید؟',
    icon: 'icons/pets.svg',
    iconAlt: 'Pets',
    answers: [
      { answerEn: 'Cats', answerFa: 'گربه' },
      { answerEn: 'Dogs', answerFa: 'سگ' },
      { answerEn: 'Both cats and dogs', answerFa: 'هم گربه و هم سگ' },
      { answerEn: 'Other animals', answerFa: 'سایر حیوانات' },
      { answerEn: 'No pets', answerFa: 'حیوان خانگی ندارم' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
  {
    type: QuestionType.PERSONALITY,
    nameEn: 'What are your religious or spiritual beliefs?',
    nameFa: 'باورهای مذهبی یا معنوی شما چیست؟',
    icon: 'icons/religion.svg',
    iconAlt: 'Religion',
    answers: [
      { answerEn: 'Christianity', answerFa: 'مسیحیت' },
      { answerEn: 'Islam', answerFa: 'اسلام' },
      { answerEn: 'Hinduism', answerFa: 'هندوئیسم' },
      { answerEn: 'Buddhism', answerFa: 'بودیسم' },
      { answerEn: 'Judaism', answerFa: 'یهودیت' },
      { answerEn: 'Spirituality', answerFa: 'معنوی (اسپیریچوال)' },
      { answerEn: 'Agnostic', answerFa: 'ندانم‌گرا (آگنوستیک)' },
      { answerEn: 'Atheism', answerFa: 'خداناباور (آتئیست)' },
      { answerEn: 'Other', answerFa: 'سایر موارد' },
      { answerEn: 'Prefer not to say', answerFa: 'ترجیح می‌دهم نگویم' },
    ],
  },
];

function seedIcons() {
  console.log('🎨 Seeding question icons into media storage...');
  const targetDir = path.join(process.cwd(), 'uploads', 'icons');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Candidate directories: root project seed-icons (committed to repo for CI/CD), then local Downloads/icons
  const candidateDirs = [
    path.join(process.cwd(), 'seed-icons'),
    path.join(os.homedir(), 'Downloads', 'icons'),
    path.join(process.cwd(), 'scratch', 'icons'),
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
    console.log(`  📁 Copied ${copiedTotal} icons into uploads/icons/`);
  } else {
    console.warn('⚠️  Icons source directory not found. Skipping file copy.');
  }
}

async function seedQuestions() {
  seedIcons();

  console.log('\n🌱 Seeding questions...');

  const allQuestions = [...preferencesQuestions, ...personalityQuestions];

  for (const question of allQuestions) {
    const existing = await prisma.question.findFirst({
      where: { nameEn: question.nameEn },
    });

    if (existing) {
      await prisma.question.update({
        where: { id: existing.id },
        data: {
          type: question.type,
          icon: question.icon || existing.icon,
          iconAlt: question.iconAlt !== undefined ? question.iconAlt : (existing as any).iconAlt,
        },
      });
      console.log(`  🔄 Updated question #${existing.id} (${question.nameEn}) - icon: ${question.icon || 'none'}`);
      continue;
    }

    const created = await prisma.question.create({
      data: {
        type: question.type,
        nameEn: question.nameEn,
        nameFa: question.nameFa,
        icon: question.icon,
        iconAlt: question.iconAlt,
        answers: {
          create: question.answers.map((a) => ({
            answerEn: a.answerEn,
            answerFa: a.answerFa,
          })),
        },
      },
      include: { answers: true },
    });
    console.log(`  ✅ Created question #${created.id} (${created.type}): "${created.nameEn}" - icon: ${created.icon}`);
  }

  const finalCounts = await prisma.question.groupBy({
    by: ['type'],
    _count: true,
  });
  console.log(`\n🎉 Seeding finished! Current question distribution:`, finalCounts);
}

seedQuestions()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
