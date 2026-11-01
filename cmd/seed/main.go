package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/platform/database"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type CountryItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

type StateItem struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	CountryID int    `json:"countryId"`
}

type CityItem struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	StateID int    `json:"stateId"`
}

func main() {
	var (
		runAll       = flag.Bool("all", false, "Run all seeders (geo, icons, questions, interests, users)")
		runGeo       = flag.Bool("geo", false, "Seed geographic data (countries, states, cities)")
		runIcons     = flag.Bool("icons", false, "Copy seed icons and profile pictures into uploads directory")
		runQuestions = flag.Bool("questions", false, "Seed questions and predefined answers")
		runInterests = flag.Bool("interests", false, "Seed interest categories and interests")
		runUsers     = flag.Bool("users", false, "Seed test users, profiles, demographics, and initial swipes")
	)
	flag.Parse()

	if !*runAll && !*runGeo && !*runIcons && !*runQuestions && !*runInterests && !*runUsers {
		log.Println("No seed flag provided. Defaulting to --all")
		*runAll = true
	}

	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	uploadsDir := cfg.UploadsDir
	seedIconsDir := "seed-icons"
	geoDir := cfg.GeoDataDir

	if *runAll || *runIcons {
		log.Println("=== 1. Seeding Icons & Profile Images ===")
		if err := copyIconsAndProfiles(uploadsDir, seedIconsDir); err != nil {
			log.Printf("Warning: Failed copying seed icons: %v", err)
		}
	}

	if *runAll || *runGeo {
		log.Println("=== 2. Seeding Geographic Dataset ===")
		if err := seedGeo(ctx, pool, geoDir); err != nil {
			log.Fatalf("Geo seeding failed: %v", err)
		}
	}

	if *runAll || *runQuestions {
		log.Println("=== 3. Seeding Questions & Answers ===")
		if err := seedQuestions(ctx, pool); err != nil {
			log.Fatalf("Questions seeding failed: %v", err)
		}
	}

	if *runAll || *runInterests {
		log.Println("=== 4. Seeding Interest Categories & Interests ===")
		if err := seedInterests(ctx, pool); err != nil {
			log.Fatalf("Interests seeding failed: %v", err)
		}
	}

	if *runAll || *runUsers {
		log.Println("=== 5. Seeding Test Users & Profiles ===")
		if err := seedUsers(ctx, pool); err != nil {
			log.Fatalf("Users seeding failed: %v", err)
		}
	}

	log.Println("🎉 Database seeding completed successfully!")
}

func copyIconsAndProfiles(uploadsDir, seedIconsDir string) error {
	dirs := []string{
		filepath.Join(uploadsDir, "icons"),
		filepath.Join(uploadsDir, "avatars"),
		filepath.Join(uploadsDir, "selfies"),
		filepath.Join(uploadsDir, "images"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0755); err != nil {
			return err
		}
	}

	copyFile := func(src, dst string) error {
		in, err := os.Open(src)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.Create(dst)
		if err != nil {
			return err
		}
		defer out.Close()
		_, err = io.Copy(out, in)
		return err
	}

	// Copy root icons to uploads/icons
	if entries, err := os.ReadDir(seedIconsDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				src := filepath.Join(seedIconsDir, e.Name())
				dst := filepath.Join(uploadsDir, "icons", e.Name())
				_ = copyFile(src, dst)
			}
		}
	}

	// Copy interest icons
	interestsDir := filepath.Join(seedIconsDir, "interests")
	if entries, err := os.ReadDir(interestsDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				src := filepath.Join(interestsDir, e.Name())
				dst := filepath.Join(uploadsDir, "icons", e.Name())
				_ = copyFile(src, dst)
			}
		}
	}

	// Copy profile pictures to avatars, selfies, and images
	profilesDir := filepath.Join(seedIconsDir, "profiles")
	if entries, err := os.ReadDir(profilesDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				src := filepath.Join(profilesDir, e.Name())
				_ = copyFile(src, filepath.Join(uploadsDir, "avatars", e.Name()))
				_ = copyFile(src, filepath.Join(uploadsDir, "selfies", e.Name()))
				_ = copyFile(src, filepath.Join(uploadsDir, "images", e.Name()))
			}
		}
	}

	log.Println("Icons and profile images copied to uploads/")
	return nil
}

func seedGeo(ctx context.Context, pool *pgxpool.Pool, geoDir string) error {
	countriesPath := filepath.Join(geoDir, "countries.json")
	statesPath := filepath.Join(geoDir, "states.json")
	citiesPath := filepath.Join(geoDir, "cities.json")

	// 1. Countries
	countryData, err := os.ReadFile(countriesPath)
	if err != nil {
		return fmt.Errorf("read countries: %w", err)
	}
	var countries []CountryItem
	if err := json.Unmarshal(countryData, &countries); err != nil {
		return fmt.Errorf("unmarshal countries: %w", err)
	}

	log.Printf("Seeding %d countries...", len(countries))
	for _, c := range countries {
		code := c.Code
		if code == "" {
			code = fmt.Sprintf("C%d", c.ID)
		}
		if len(c.Name) > 100 {
			c.Name = c.Name[:100]
		}
		if len(code) > 10 {
			code = code[:10]
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO countries (id, name, code)
			VALUES ($1, $2, $3)
			ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code
		`, c.ID, c.Name, code)
		if err != nil {
			return fmt.Errorf("insert country %s: %w", c.Name, err)
		}
	}

	// 2. States
	stateData, err := os.ReadFile(statesPath)
	if err != nil {
		return fmt.Errorf("read states: %w", err)
	}
	var states []StateItem
	if err := json.Unmarshal(stateData, &states); err != nil {
		return fmt.Errorf("unmarshal states: %w", err)
	}

	log.Printf("Seeding %d states...", len(states))
	batchSize := 500
	for i := 0; i < len(states); i += batchSize {
		end := i + batchSize
		if end > len(states) {
			end = len(states)
		}
		chunk := states[i:end]

		query := strings.Builder{}
		query.WriteString("INSERT INTO states (id, country_id, name) VALUES ")
		args := make([]interface{}, 0, len(chunk)*3)
		for j, s := range chunk {
			if j > 0 {
				query.WriteString(", ")
			}
			name := s.Name
			if len(name) > 100 {
				name = name[:100]
			}
			idx := j * 3
			fmt.Fprintf(&query, "($%d, $%d, $%d)", idx+1, idx+2, idx+3)
			args = append(args, s.ID, s.CountryID, name)
		}
		query.WriteString(" ON CONFLICT (id) DO NOTHING")

		if _, err := pool.Exec(ctx, query.String(), args...); err != nil {
			return fmt.Errorf("insert states chunk: %w", err)
		}
	}

	// 3. Cities
	cityData, err := os.ReadFile(citiesPath)
	if err != nil {
		return fmt.Errorf("read cities: %w", err)
	}
	var cities []CityItem
	if err := json.Unmarshal(cityData, &cities); err != nil {
		return fmt.Errorf("unmarshal cities: %w", err)
	}

	log.Printf("Seeding %d cities in chunks of 1000...", len(cities))
	cityBatchSize := 1000
	for i := 0; i < len(cities); i += cityBatchSize {
		end := i + cityBatchSize
		if end > len(cities) {
			end = len(cities)
		}
		chunk := cities[i:end]

		query := strings.Builder{}
		query.WriteString("INSERT INTO cities (id, state_id, name) VALUES ")
		args := make([]interface{}, 0, len(chunk)*3)
		for j, c := range chunk {
			if j > 0 {
				query.WriteString(", ")
			}
			name := c.Name
			if len(name) > 100 {
				name = name[:100]
			}
			idx := j * 3
			fmt.Fprintf(&query, "($%d, $%d, $%d)", idx+1, idx+2, idx+3)
			args = append(args, c.ID, c.StateID, name)
		}
		query.WriteString(" ON CONFLICT (id) DO NOTHING")

		if _, err := pool.Exec(ctx, query.String(), args...); err != nil {
			return fmt.Errorf("insert cities chunk: %w", err)
		}
	}

	// Update sequence counters
	_, _ = pool.Exec(ctx, `SELECT setval(pg_get_serial_sequence('countries', 'id'), COALESCE(MAX(id), 1)) FROM countries;`)
	_, _ = pool.Exec(ctx, `SELECT setval(pg_get_serial_sequence('states', 'id'), COALESCE(MAX(id), 1)) FROM states;`)
	_, _ = pool.Exec(ctx, `SELECT setval(pg_get_serial_sequence('cities', 'id'), COALESCE(MAX(id), 1)) FROM cities;`)

	log.Println("Geo seeding complete.")
	return nil
}

type QuestionSeed struct {
	Type     string
	NameEn   string
	NameFa   string
	Icon     string
	IconAlt  string
	Answers  [][2]string // [En, Fa]
}

func seedQuestions(ctx context.Context, pool *pgxpool.Pool) error {
	questions := []QuestionSeed{
		{
			Type:    "PREFERENCES",
			NameEn:  "What's your favorite music genre?",
			NameFa:  "ژانر موسیقی مورد علاقه شما چیست؟",
			Answers: [][2]string{{"Songs from the past.", "آهنگ‌های قدیمی."}, {"Lyric-driven songs.", "آهنگ‌هایی با اشعار برجسته."}, {"Danceable tracks.", "ترانه‌های قابل رقص."}, {"Relaxing songs.", "موسیقی های آرامش‌بخش."}, {"Discovering new tunes.", "کشف آهنگ‌های جدید."}},
		},
		{
			Type:    "PREFERENCES",
			NameEn:  "What's your dream career?",
			NameFa:  "شغل رویایی شما چیست؟",
			Answers: [][2]string{{"Selling my own creations.", "فروش آثار خلاقانه ی خودم."}, {"Earning without effort.", "درآمد بدون تلاش."}, {"Becoming an influencer.", "تبدیل شدن به یک تأثیرگذار."}, {"Being my own boss.", "رئیس خودم بودن."}, {"I don't aspire to work.", "من علاقه‌ای به کار ندارم."}},
		},
		{
			Type:    "PREFERENCES",
			NameEn:  "What are you currently learning?",
			NameFa:  "در حال حاضر در حال یادگیری چه چیزی هستید؟",
			Answers: [][2]string{{"How to start a business.", "چگونگی راه‌اندازی یک کسب و کار."}, {"A new creative skill.", "یک مهارت خلاقانه جدید."}, {"Honestly, managing my time.", "صادقانه بگویم، مدیریت زمانم."}, {"Another language.", "یک زبان دیگر."}, {"Culinary skills.", "مهارت‌های آشپزی."}},
		},
		{
			Type:    "PREFERENCES",
			NameEn:  "What's your perspective on monogamy?",
			NameFa:  "دیدگاه شما درباره تک عشقی چیست؟",
			Answers: [][2]string{{"It's fine, but not for me.", "خوب است، اما برای من مناسب نیست."}, {"I'm open to trying it.", "آماده امتحان کردنش هستم."}, {"I don't support monogamy.", "از تک‌ ‌عشقی حمایت نمی‌کنم."}, {"It's my only desire.", "تنها آرزوی من است."}, {"Depends on my mood.", "بسته به حال و هوای من دارد."}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "What is your relationship status?",
			NameFa:  "وضعیت تاهل یا رابطه شما چیست؟",
			Icon:    "icons/relationship-status.svg",
			IconAlt: "Relationship status",
			Answers: [][2]string{{"Single", "مجرد"}, {"In a relationship", "در رابطه"}, {"Married", "متاهل"}, {"It's complicated", "پیچیده است"}, {"Open relationship", "رابطه باز"}, {"Divorced", "جدا شده / طلاق گرفته"}, {"Widowed", "همسر فوت شده"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "How often do you drink?",
			NameFa:  "چقدر نوشیدنی الکلی مصرف می‌کنید؟",
			Icon:    "icons/drink.svg",
			IconAlt: "Drink",
			Answers: [][2]string{{"Socially", "در جمع‌های دوستانه و مهمانی‌ها"}, {"Never", "هرگز"}, {"Occasionally", "گاهی اوقات"}, {"Regularly", "به‌طور منظم"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "Do you smoke?",
			NameFa:  "آیا سیگار یا دخانیات مصرف می‌کنید؟",
			Icon:    "icons/smoke.svg",
			IconAlt: "Smoke",
			Answers: [][2]string{{"Yes", "بله"}, {"No", "خیر"}, {"Sometimes", "گاهی اوقات"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "What are your thoughts on having kids?",
			NameFa:  "دیدگاه شما درباره داشتن فرزند چیست؟",
			Icon:    "icons/kids.svg",
			IconAlt: "Kids",
			Answers: [][2]string{{"Love kids", "عاشق بچه‌ها هستم"}, {"Maybe someday want kids", "شاید در آینده بچه بخواهم"}, {"Undecided about kids", "هنوز تصمیم نگرفته‌ام"}, {"Do not want kids", "بچه نمی‌خواهم"}, {"Already have kids", "در حال حاضر فرزند دارم"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "What is your highest level of education?",
			NameFa:  "بالاترین مدرک تحصیلی شما چیست؟",
			Icon:    "icons/education.svg",
			IconAlt: "Education",
			Answers: [][2]string{{"High school diploma", "دیپلم دبیرستان"}, {"Some college", "دانشجو یا انصرافی"}, {"Associate degree", "کاردانی / فوق دیپلم"}, {"Bachelor's degree", "کارشناسی / لیسانس"}, {"Master's degree", "کارشناسی ارشد / فوق لیسانس"}, {"Doctorate", "دکتری"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "How would you describe your personality type?",
			NameFa:  "تیپ شخصیتی خود را چگونه توصیف می‌کنید؟",
			Icon:    "icons/mood.svg",
			IconAlt: "Personality",
			Answers: [][2]string{{"Introvert", "درون‌گرا"}, {"Extrovert", "برون‌گرا"}, {"Somewhere in between", "میانه‌رو / میان‌گرا"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "What is your zodiac star sign?",
			NameFa:  "ماه تولد یا نماد زودیاک شما چیست؟",
			Icon:    "icons/star-sign.svg",
			IconAlt: "Zodiac",
			Answers: [][2]string{{"Aries", "حمل (فروردین)"}, {"Taurus", "ثور (اردیبهشت)"}, {"Gemini", "جوزا (خرداد)"}, {"Cancer", "سرطان (تیر)"}, {"Leo", "اسد (مرداد)"}, {"Virgo", "سنبله (شهریور)"}, {"Libra", "میزان (مهر)"}, {"Scorpio", "عقرب (آبان)"}, {"Sagittarius", "قوس (آذر)"}, {"Capricorn", "جدی (دی)"}, {"Aquarius", "دلو (بهمن)"}, {"Pisces", "حوت (اسفند)"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "Do you have any pets?",
			NameFa:  "آیا حیوان خانگی دارید؟",
			Icon:    "icons/pets.svg",
			IconAlt: "Pets",
			Answers: [][2]string{{"Cats", "گربه"}, {"Dogs", "سگ"}, {"Both cats and dogs", "هم گربه و هم سگ"}, {"Other animals", "سایر حیوانات"}, {"No pets", "حیوان خانگی ندارم"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
		{
			Type:    "PERSONALITY",
			NameEn:  "What are your religious or spiritual beliefs?",
			NameFa:  "باورهای مذهبی یا معنوی شما چیست؟",
			Icon:    "icons/religion.svg",
			IconAlt: "Religion",
			Answers: [][2]string{{"Christianity", "مسیحیت"}, {"Islam", "اسلام"}, {"Hinduism", "هندوئیسم"}, {"Buddhism", "بودیسم"}, {"Judaism", "یهودیت"}, {"Spirituality", "معنوی (اسپیریچوال)"}, {"Agnostic", "ندانم‌گرا (آگنوستیک)"}, {"Atheism", "خداناباور (آتئیست)"}, {"Other", "سایر موارد"}, {"Prefer not to say", "ترجیح می‌دهم نگویم"}},
		},
	}

	for _, q := range questions {
		var questionID int
		err := pool.QueryRow(ctx, `SELECT id FROM questions WHERE name_en = $1`, q.NameEn).Scan(&questionID)
		if err != nil {
			var icon *string
			if q.Icon != "" {
				icon = &q.Icon
			}
			var iconAlt *string
			if q.IconAlt != "" {
				iconAlt = &q.IconAlt
			}
			err = pool.QueryRow(ctx, `
				INSERT INTO questions (type, answer_type, name_en, name_fa, icon, icon_alt)
				VALUES ($1, 'SINGLE', $2, $3, $4, $5)
				RETURNING id
			`, q.Type, q.NameEn, q.NameFa, icon, iconAlt).Scan(&questionID)
			if err != nil {
				return fmt.Errorf("create question %s: %w", q.NameEn, err)
			}
		}

		for _, ans := range q.Answers {
			var ansID int
			err = pool.QueryRow(ctx, `SELECT id FROM question_answers WHERE question_id = $1 AND answer_en = $2`, questionID, ans[0]).Scan(&ansID)
			if err != nil {
				_, err = pool.Exec(ctx, `
					INSERT INTO question_answers (question_id, answer_en, answer_fa)
					VALUES ($1, $2, $3)
				`, questionID, ans[0], ans[1])
				if err != nil {
					return fmt.Errorf("create question answer %s: %w", ans[0], err)
				}
			}
		}
	}

	log.Println("Questions seeding complete.")
	return nil
}

type InterestCategorySeed struct {
	NameEn    string
	NameFa    string
	Media     string
	Interests [][2]string
}

func seedInterests(ctx context.Context, pool *pgxpool.Pool) error {
	cats := []InterestCategorySeed{
		{
			NameEn: "Food",
			NameFa: "غذا",
			Media:  "icons/Beach With Umbrella.svg",
			Interests: [][2]string{
				{"Gaming", "بازی"}, {"Camping", "کمپینگ"}, {"Movies", "فیلم"}, {"Nature", "طبیعت"},
				{"Studying", "مطالعه"}, {"Fast food", "فست فود"}, {"Healthy food", "غذای سالم"},
				{"Cooking", "آشپزی"}, {"Coffee", "قهوه"}, {"Tea", "چای"},
			},
		},
		{
			NameEn: "Sport",
			NameFa: "ورزش",
			Media:  "icons/Beach With Umbrella (1).svg",
			Interests: [][2]string{
				{"Football", "فوتبال"}, {"Basketball", "بسکتبال"}, {"Swimming", "شنا"}, {"Running", "دویدن"},
				{"Yoga", "یوگا"}, {"Gym", "باشگاه"}, {"Tennis", "تنیس"}, {"Hiking", "کوهنوردی"},
				{"Cycling", "دوچرخه‌سواری"}, {"Martial arts", "هنرهای رزمی"},
			},
		},
		{
			NameEn: "Movie",
			NameFa: "فیلم",
			Media:  "icons/Beach With Umbrella (2).svg",
			Interests: [][2]string{
				{"Action", "اکشن"}, {"Comedy", "کمدی"}, {"Drama", "درام"}, {"Horror", "ترسناک"},
				{"Sci-Fi", "علمی تخیلی"}, {"Romance", "عاشقانه"}, {"Documentary", "مستند"},
				{"Animation", "انیمیشن"}, {"Thriller", "هیجان‌انگیز"}, {"Series", "سریال"},
			},
		},
		{
			NameEn: "Travel",
			NameFa: "سفر",
			Media:  "icons/travel.svg",
			Interests: [][2]string{
				{"Beach", "ساحل"}, {"Mountain", "کوهستان"}, {"Camping", "کمپینگ"}, {"City trips", "سفر شهری"},
				{"Backpacking", "کوله‌گردی"}, {"Road trips", "سفر جاده‌ای"}, {"Cultural trips", "سفر فرهنگی"}, {"Adventure", "ماجراجویی"},
			},
		},
	}

	for _, c := range cats {
		var catID int
		err := pool.QueryRow(ctx, `SELECT id FROM interest_categories WHERE name_en = $1`, c.NameEn).Scan(&catID)
		if err != nil {
			err = pool.QueryRow(ctx, `
				INSERT INTO interest_categories (name_en, name_fa, media)
				VALUES ($1, $2, $3)
				RETURNING id
			`, c.NameEn, c.NameFa, c.Media).Scan(&catID)
			if err != nil {
				return fmt.Errorf("create category %s: %w", c.NameEn, err)
			}
		}

		for _, item := range c.Interests {
			var itemID int
			err = pool.QueryRow(ctx, `SELECT id FROM interests WHERE category_id = $1 AND name_en = $2`, catID, item[0]).Scan(&itemID)
			if err != nil {
				_, err = pool.Exec(ctx, `
					INSERT INTO interests (category_id, name_en, name_fa)
					VALUES ($1, $2, $3)
				`, catID, item[0], item[1])
				if err != nil {
					return fmt.Errorf("create interest %s: %w", item[0], err)
				}
			}
		}
	}

	log.Println("Interests seeding complete.")
	return nil
}

func seedUsers(ctx context.Context, pool *pgxpool.Pool) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("Password123!$#5fsFEFfs"), 10)
	if err != nil {
		return err
	}
	hashStr := string(passwordHash)

	// Get a valid city ID (Tehran or first available)
	var cityID int
	err = pool.QueryRow(ctx, `SELECT id FROM cities WHERE name ILIKE '%Tehran%' LIMIT 1`).Scan(&cityID)
	if err != nil {
		err = pool.QueryRow(ctx, `SELECT id FROM cities LIMIT 1`).Scan(&cityID)
		if err != nil {
			// Fallback: create mock country, state, city
			var countryID int
			_ = pool.QueryRow(ctx, `INSERT INTO countries (name, code) VALUES ('Iran', 'IR') RETURNING id`).Scan(&countryID)
			var stateID int
			_ = pool.QueryRow(ctx, `INSERT INTO states (country_id, name) VALUES ($1, 'Tehran') RETURNING id`, countryID).Scan(&stateID)
			_ = pool.QueryRow(ctx, `INSERT INTO cities (state_id, name) VALUES ($1, 'Tehran') RETURNING id`, stateID).Scan(&cityID)
		}
	}

	type UserSpec struct {
		Email     string
		FirstName string
		LastName  string
		Username  string
		Gender    string
		Role      string
		Avatar    string
		Bio       string
		Gallery   []string
	}

	users := []UserSpec{
		{
			Email:     "sara.hemati@datemate.com",
			FirstName: "Sara",
			LastName:  "Hemati",
			Username:  "sara_h",
			Gender:    "FEMALE",
			Role:      "USER",
			Avatar:    "avatarbe9c29b29330.webp",
			Bio:       "Software engineer who loves photography, hiking, and specialty coffee.",
			Gallery:   []string{"user-1-1.jpg", "user-1-2.jpg", "user-1-3.jpg"},
		},
		{
			Email:     "ali.rezaei@datemate.com",
			FirstName: "Ali",
			LastName:  "Rezaei",
			Username:  "ali_r",
			Gender:    "MALE",
			Role:      "USER",
			Avatar:    "model-1-avatar.jpg",
			Bio:       "Architect passionate about design, cinema, and good books.",
			Gallery:   []string{"model-1-gallery.jpg"},
		},
		{
			Email:     "neda.karimi@datemate.com",
			FirstName: "Neda",
			LastName:  "Karimi",
			Username:  "neda_k",
			Gender:    "FEMALE",
			Role:      "USER",
			Avatar:    "photo_2026-10-12_18-50-25.jpg",
			Bio:       "Digital artist exploring nature and ambient sounds.",
			Gallery:   []string{},
		},
		{
			Email:     "dina.rad@datemate.com",
			FirstName: "Dina",
			LastName:  "Rad",
			Username:  "dina_rad",
			Gender:    "FEMALE",
			Role:      "USER",
			Avatar:    "SnapInsta.to_389270653_317424694432170_6609951662497676757_n.jpg",
			Bio:       "Fitness enthusiast and health blogger.",
			Gallery:   []string{"SnapInsta.to_389270653_317424694432170_6609951662497676757_n.jpg"},
		},
		{
			Email:     "admin@datemate.com",
			FirstName: "DateMate",
			LastName:  "Admin",
			Username:  "admin",
			Gender:    "MALE",
			Role:      "ADMIN",
			Avatar:    "",
			Bio:       "DateMate System Administrator",
			Gallery:   nil,
		},
	}

	var userIDs = make(map[string]int64)

	for _, u := range users {
		var uID int64
		err = pool.QueryRow(ctx, `SELECT id FROM users WHERE email = $1`, u.Email).Scan(&uID)
		if err != nil {
			err = pool.QueryRow(ctx, `
				INSERT INTO users (email, password_hash, role, profile_validated, updated_at)
				VALUES ($1, $2, $3, true, NOW())
				RETURNING id
			`, u.Email, hashStr, u.Role).Scan(&uID)
			if err != nil {
				return fmt.Errorf("create user %s: %w", u.Email, err)
			}
		}
		userIDs[u.Email] = uID

		// Profile
		var pID int
		err = pool.QueryRow(ctx, `SELECT id FROM profiles WHERE user_id = $1`, uID).Scan(&pID)
		if err != nil {
			avatarURL := "/assets/avatars/default.png"
			if u.Avatar != "" {
				avatarURL = fmt.Sprintf("/assets/avatars/%s", u.Avatar)
			}
			_, err = pool.Exec(ctx, `
				INSERT INTO profiles (user_id, username, first_name, avatar_url, bio, is_private, relation_type, latitude, longitude, updated_at)
				VALUES ($1, $2, $3, $4, $5, false, 'LONG', 35.6892, 51.3890, NOW())
			`, uID, u.Username, u.FirstName, avatarURL, u.Bio)
			if err != nil {
				return fmt.Errorf("create profile %s: %w", u.Username, err)
			}
		}

		// Demographic
		var dID int
		err = pool.QueryRow(ctx, `SELECT id FROM demographics WHERE user_id = $1`, uID).Scan(&dID)
		if err != nil {
			_, err = pool.Exec(ctx, `
				INSERT INTO demographics (user_id, birth_date, gender, height, weight, city_id, city_name, relation_status, degree)
				VALUES ($1, '1996-05-15', $2, 175, 68, $3, 'Tehran', 'SINGLE', 'BACHELOR_DEGREE')
			`, uID, u.Gender, cityID)
			if err != nil {
				return fmt.Errorf("create demographic %s: %w", u.Username, err)
			}
		}

		// Gallery
		for i, gFile := range u.Gallery {
			isProfilePic := (i == 0)
			imgURL := fmt.Sprintf("/assets/images/%s", gFile)
			_, _ = pool.Exec(ctx, `
				INSERT INTO user_galleries (user_id, image_url, is_profile_picture, created_at)
				VALUES ($1, $2, $3, NOW())
			`, uID, imgURL, isProfilePic)
		}

		// Questions Answer
		var qAnsIDs []int
		rows, err := pool.Query(ctx, `SELECT id FROM question_answers LIMIT 5`)
		if err == nil {
			for rows.Next() {
				var qaID int
				_ = rows.Scan(&qaID)
				qAnsIDs = append(qAnsIDs, qaID)
			}
			rows.Close()
		}
		for _, qaID := range qAnsIDs {
			_, _ = pool.Exec(ctx, `
				INSERT INTO user_question_answers (user_id, question_answer_id)
				VALUES ($1, $2)
				ON CONFLICT (user_id, question_answer_id) DO NOTHING
			`, uID, qaID)
		}

		// Interests
		var interestIDs []int
		iRows, err := pool.Query(ctx, `SELECT id FROM interests LIMIT 4`)
		if err == nil {
			for iRows.Next() {
				var iID int
				_ = iRows.Scan(&iID)
				interestIDs = append(interestIDs, iID)
			}
			iRows.Close()
		}
		for _, iID := range interestIDs {
			_, _ = pool.Exec(ctx, `
				INSERT INTO user_interests (user_id, interest_id, is_liked)
				VALUES ($1, $2, true)
				ON CONFLICT (user_id, interest_id) DO NOTHING
			`, uID, iID)
		}
	}

	// Create mutual match between Sara Hemati (User 1) and Ali Rezaei (User 2)
	u1ID := userIDs["sara.hemati@datemate.com"]
	u2ID := userIDs["ali.rezaei@datemate.com"]
	if u1ID > 0 && u2ID > 0 {
		pairKey, _ := common.CreatePairKey(u1ID, u2ID)
		convUUID := common.GenerateDeterministicConversationID(pairKey)
		minID, maxID := u1ID, u2ID
		if minID > maxID {
			minID, maxID = u2ID, u1ID
		}

		_, _ = pool.Exec(ctx, `
			INSERT INTO swipes (user_pair_key, from_user_id, to_user_id, direction, created_at)
			VALUES ($1, $2, $3, 'RIGHT', NOW())
			ON CONFLICT (from_user_id, to_user_id) DO NOTHING
		`, pairKey, u1ID, u2ID)
		_, _ = pool.Exec(ctx, `
			INSERT INTO swipes (user_pair_key, from_user_id, to_user_id, direction, created_at)
			VALUES ($1, $2, $3, 'RIGHT', NOW())
			ON CONFLICT (from_user_id, to_user_id) DO NOTHING
		`, pairKey, u2ID, u1ID)

		var matchID int64
		err = pool.QueryRow(ctx, `SELECT id FROM matches WHERE user_one_id = $1 AND user_two_id = $2`, minID, maxID).Scan(&matchID)
		if err != nil {
			_ = pool.QueryRow(ctx, `
				INSERT INTO matches (user_one_id, user_two_id, is_active, matched_at)
				VALUES ($1, $2, true, NOW())
				RETURNING id
			`, minID, maxID).Scan(&matchID)
		}

		// Create conversation for chat
		_, _ = pool.Exec(ctx, `
			INSERT INTO conversations (conversation_id, conversation_type, created_by, created_at, updated_at)
			VALUES ($1, 'DIRECT', $2, NOW(), NOW())
			ON CONFLICT (conversation_id) DO NOTHING
		`, convUUID, u1ID)
		_, _ = pool.Exec(ctx, `
			INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
			VALUES ($1, $2, 'MEMBER', NOW()), ($1, $3, 'MEMBER', NOW())
			ON CONFLICT (conversation_id, user_id) DO NOTHING
		`, convUUID, u1ID, u2ID)
		_, _ = pool.Exec(ctx, `
			INSERT INTO direct_conversations_by_pair (canonical_pair_key, conversation_id, created_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (canonical_pair_key) DO NOTHING
		`, pairKey, convUUID)
	}

	log.Println("Users seeding complete.")
	return nil
}
