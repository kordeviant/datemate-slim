package main

import (
	"context"
	"flag"
	"log"
	"time"

	"datemate/internal/config"
	"datemate/internal/platform/database"
	"datemate/internal/platform/database/seeder"
)

func main() {
	var (
		runAll       = flag.Bool("all", false, "Run all seeders (geo, icons, questions, interests, users, admin)")
		runGeo       = flag.Bool("geo", false, "Seed geographic data (countries, states, cities)")
		runIcons     = flag.Bool("icons", false, "Copy seed icons and profile pictures into uploads directory")
		runQuestions = flag.Bool("questions", false, "Seed questions and predefined answers")
		runInterests = flag.Bool("interests", false, "Seed interest categories and interests")
		runUsers     = flag.Bool("users", false, "Seed test users, profiles, demographics, and initial swipes")
		runAdmin     = flag.Bool("admin", false, "Ensure admin user exists with credentials")
	)
	flag.Parse()

	if !*runAll && !*runGeo && !*runIcons && !*runQuestions && !*runInterests && !*runUsers && !*runAdmin {
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
		if err := seeder.CopyIconsAndProfiles(uploadsDir, seedIconsDir); err != nil {
			log.Printf("Warning: Failed copying seed icons: %v", err)
		}
	}

	if *runAll || *runGeo {
		log.Println("=== 2. Seeding Geographic Dataset ===")
		if err := seeder.SeedGeo(ctx, pool, geoDir); err != nil {
			log.Fatalf("Geo seeding failed: %v", err)
		}
	}

	if *runAll || *runQuestions {
		log.Println("=== 3. Seeding Questions & Answers ===")
		if err := seeder.SeedQuestions(ctx, pool); err != nil {
			log.Fatalf("Questions seeding failed: %v", err)
		}
	}

	if *runAll || *runInterests {
		log.Println("=== 4. Seeding Interest Categories & Interests ===")
		if err := seeder.SeedInterests(ctx, pool); err != nil {
			log.Fatalf("Interests seeding failed: %v", err)
		}
	}

	if *runAll || *runUsers {
		log.Println("=== 5. Seeding Test Users & Profiles ===")
		if err := seeder.SeedUsers(ctx, pool); err != nil {
			log.Fatalf("Users seeding failed: %v", err)
		}
	}

	if *runAll || *runAdmin {
		log.Println("=== 6. Ensuring Admin User ===")
		if err := seeder.EnsureAdminUser(ctx, pool); err != nil {
			log.Fatalf("Admin seeding failed: %v", err)
		}
	}

	log.Println("🎉 Database seeding completed successfully!")
}
