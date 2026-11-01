package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/modules/admin"
	"datemate/internal/modules/auth"
	"datemate/internal/modules/chat"
	"datemate/internal/modules/friends"
	"datemate/internal/modules/interests"
	"datemate/internal/modules/matching"
	"datemate/internal/modules/media"
	"datemate/internal/modules/notifications"
	"datemate/internal/modules/questions"
	"datemate/internal/modules/recommended"
	"datemate/internal/modules/system"
	"datemate/internal/modules/users"
	"datemate/internal/platform/database"
	"datemate/internal/platform/fcm"
	"datemate/internal/platform/geo"
	"datemate/internal/platform/mail"
	platformRedis "datemate/internal/platform/redis"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	log.Println("Starting DateMate Modular Monolith (Go 1.23+)...")

	// 1. Load configuration
	cfg := config.Load()

	ctx := context.Background()

	// 2. Initialize PostgreSQL connection pool
	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to initialize database pool: %v", err)
	}
	defer pool.Close()

	// 3. Run database migrations automatically
	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "migrations"
	}
	if err := database.RunMigrations(ctx, pool, migrationsDir); err != nil {
		log.Printf("Warning: Migration runner: %v", err)
	} else {
		log.Println("Database migrations applied cleanly.")
	}

	// 4. Initialize Redis
	rdb, err := platformRedis.NewClient(ctx, cfg.RedisHost, cfg.RedisPort, cfg.RedisPassword)
	if err != nil {
		log.Fatalf("Failed to initialize Redis client: %v", err)
	}
	defer rdb.Close()

	// 5. Initialize Storage Engine
	var storageEngine storage.Engine
	if cfg.StorageDriver == "s3" {
		s3Eng, err := storage.NewS3Engine(ctx, cfg.S3Endpoint, cfg.S3AccessKey, cfg.S3SecretKey, cfg.S3Bucket, cfg.S3UseSSL)
		if err != nil {
			log.Fatalf("Failed to initialize S3 storage engine: %v", err)
		}
		storageEngine = s3Eng
		log.Println("Using S3/MinIO Storage Engine")
	} else {
		localEng, err := storage.NewLocalEngine(cfg.UploadsDir)
		if err != nil {
			log.Fatalf("Failed to initialize local storage engine: %v", err)
		}
		storageEngine = localEng
		log.Printf("Using Local Storage Engine at %s", cfg.UploadsDir)
	}

	// 6. Initialize Geo Service
	geoService := geo.NewService(cfg.GeoDataDir)

	// 7. Initialize Mailer Service
	mailer := mail.NewService(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPFrom)

	// 8. Initialize FCM Push Dispatcher
	fcmDispatcher := fcm.NewDispatcher(pool, cfg.FCMMockMode, 4, 1000)
	defer fcmDispatcher.Close()

	// 9. Initialize Domain Services
	authSvc := auth.NewService(cfg, pool, rdb, mailer)
	userSvc := users.NewService(cfg, pool, geoService, storageEngine)
	matchingSvc := matching.NewService(cfg, pool, rdb, geoService, fcmDispatcher)
	recommendedSvc := recommended.NewService(cfg, pool, rdb, geoService, userSvc)
	friendsSvc := friends.NewService(cfg, pool, fcmDispatcher)
	chatSvc := chat.NewService(cfg, pool, rdb, fcmDispatcher, storageEngine)
	questionsSvc := questions.NewService(cfg, pool)
	interestsSvc := interests.NewService(cfg, pool)
	adminSvc := admin.NewService(cfg, pool, rdb)

	// 10. Initialize Handlers
	authHandler := auth.NewHandler(authSvc, cfg, pool)
	usersHandler := users.NewHandler(userSvc, cfg, pool)
	matchingHandler := matching.NewHandler(matchingSvc, cfg, pool)
	recommendedHandler := recommended.NewHandler(recommendedSvc, cfg, pool)
	friendsHandler := friends.NewHandler(friendsSvc, cfg, pool)
	chatHandler := chat.NewHandler(chatSvc, cfg, pool)
	chatGateway := chat.NewGateway(chatSvc, cfg, pool, rdb)
	mediaHandler := media.NewHandler(cfg, storageEngine)
	notificationsHandler := notifications.NewHandler(cfg, fcmDispatcher)
	questionsHandler := questions.NewHandler(questionsSvc, cfg, pool)
	interestsHandler := interests.NewHandler(interestsSvc, cfg, pool)
	adminHandler := admin.NewHandler(adminSvc, cfg, pool)
	systemHandler := system.NewHandler("docs")
	geoHandler := geo.NewHandler(geoService)

	// 11. Root Router & Global Middlewares
	r := chi.NewRouter()

	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.TransformEnvelope())

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "x-api-key", "if-none-match"},
		ExposedHeaders:   []string{"Link", "ETag", "Content-Disposition"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Sliding window rate limiter
	r.Use(middleware.Throttler(rdb, cfg))

	// Docs protection (IP whitelist & HTTP Basic Auth)
	r.Use(middleware.DocsProtection(cfg))

	// Mount Socket.IO server on /socket.io/ and /chat
	socketHandler := chatGateway.ServeHandler()
	r.Mount("/socket.io", socketHandler)
	r.Mount("/chat", socketHandler)

	// Helper to register all domain routes
	registerDomainRoutes := func(sub chi.Router) {
		authHandler.RegisterRoutes(sub)
		usersHandler.RegisterRoutes(sub)
		matchingHandler.RegisterRoutes(sub)
		recommendedHandler.RegisterRoutes(sub)
		friendsHandler.RegisterRoutes(sub)
		chatHandler.RegisterRoutes(sub)
		mediaHandler.RegisterRoutes(sub)
		notificationsHandler.RegisterRoutes(sub)
		questionsHandler.RegisterRoutes(sub)
		interestsHandler.RegisterRoutes(sub)
		adminHandler.RegisterRoutes(sub)
		systemHandler.RegisterRoutes(sub)
		geoHandler.RegisterRoutes(sub)
	}

	// Mount static file serving for /static/* from geoService.GetDataDir()
	staticDir := geoService.GetDataDir()
	if staticDir != "" {
		r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
	}

	// Register version-neutral routes (e.g. /health, /auth/signin, /assets/..., etc.)
	registerDomainRoutes(r)

	// Register /v1/ prefixed routes (e.g. /v1/health, /v1/auth/signin, /v1/feed, etc.)
	r.Route("/v1", func(v1 chi.Router) {
		if staticDir != "" {
			v1.Handle("/static/*", http.StripPrefix("/v1/static/", http.FileServer(http.Dir(staticDir))))
		}
		registerDomainRoutes(v1)
	})

	// 12. Start HTTP server
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("Server listening on http://%s (Port %s)", addr, cfg.Port)
		serverErrors <- srv.ListenAndServe()
	}()

	// 13. Graceful shutdown
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		log.Fatalf("Server error: %v", err)

	case sig := <-shutdown:
		log.Printf("Shutdown signal received (%v), commencing graceful shutdown...", sig)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("Graceful shutdown failed: %v", err)
			_ = srv.Close()
		}
		log.Println("Server gracefully stopped.")
	}
}
