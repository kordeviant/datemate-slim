package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	// App & Server
	Host       string
	Port       string
	NodeEnv    string
	BaseURL    string
	AssetBaseURL string
	TrustProxy string

	// SMTP & Email
	SMTPHost   string
	SMTPPort   int
	SMTPUser   string
	SMTPPass   string
	SMTPSecure bool
	SMTPFrom   string

	// Rate Limiting
	ThrottleTTL       int
	ThrottleLimit     int
	ThrottleAuthLimit int

	// Database
	DatabaseURL string

	// Redis
	RedisHost            string
	RedisPort            string
	RedisPassword        string
	RedisURL             string
	RecommendedCacheTTL  int

	// JWT
	JWTAccessSecret     string
	JWTAccessExpiresIn  string
	JWTRefreshSecret    string
	JWTRefreshExpiresIn string

	// Documentation Protection
	DocsProtectionEnabled bool
	DocsAuthEnabled       bool
	DocsUsername          string
	DocsPassword          string
	DocsIPWhitelistEnabled bool
	DocsAllowedIPs        []string

	// Internal API Keys
	InternalAPIKey        string
	DeviceTokenAPIKey     string
	PushNotificationAPIKey string

	// Storage & Upload
	StorageDriver      string
	UploadsDir         string
	ChatUploadsDir     string
	NginxAccelRedirect bool
	S3Endpoint         string
	S3AccessKey        string
	S3SecretKey        string
	S3Bucket           string
	S3UseSSL           bool

	// Business & Discovery Limits
	PaginationDefaultLimit      int
	PaginationMaxLimit          int
	MatchingDailyFreeSwipeLimit int
	MatchingMinAge              int
	MatchingMaxAge              int
	MatchingDefaultMaxDistanceKM int
	MatchingMaxDistanceKM        int
	RequireSelfieForMatching    bool

	// Chat Limits & Settings
	ChatMaxMessageLength         int
	ChatMaxAttachmentsPerMessage int
	ChatMaxGroupTitleLength      int
	ChatMaxGroupDescriptionLength int
	ChatMinGroupMembers          int
	ChatMaxGroupMembers          int
	ChatMaxGroupsPerUser         int
	ChatPresenceDebounceMS       int
	ChatWSPingIntervalMS         int
	ChatWSPingTimeoutMS          int

	// Push Notifications & FCM
	FCMMockMode                  bool
	FirebaseCredentialsPath      string
	FirebaseServiceAccountJSON   string
	PushDefaultPriority          string
	PushNotificationTimeoutMS    int
	PushMaxBatchSize             int

	// Geo Data
	GeoDataDir string
}

func Load() *Config {
	_ = godotenv.Load(".env")

	port := getEnv("PORT", "3000")
	defaultBase := fmt.Sprintf("http://localhost:%s", port)
	baseURL := strings.TrimRight(getEnv("BASE_URL", ""), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(getEnv("APP_BASE_URL", defaultBase), "/")
	}

	assetBaseURL := strings.TrimRight(getEnv("ASSET_BASE_URL", ""), "/")
	if assetBaseURL == "" {
		assetBaseURL = strings.TrimRight(getEnv("MEDIA_BASE_URL", ""), "/")
	}
	if assetBaseURL == "" {
		assetBaseURL = baseURL
	}

	dbURL := getEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/datemate_verify_db?sslmode=disable")
	if dbHost := getEnv("DATABASE_HOST", ""); dbHost != "" {
		if parsedURL, err := url.Parse(dbURL); err == nil {
			port := parsedURL.Port()
			if dbPort := getEnv("DATABASE_PORT", ""); dbPort != "" {
				port = dbPort
			} else if port == "" || port == "5433" {
				port = "5432"
			}
			parsedURL.Host = net.JoinHostPort(dbHost, port)
			dbURL = parsedURL.String()
		}
	}

	redisHost := getEnv("REDIS_HOST", "localhost")
	redisPort := getEnv("REDIS_PORT", "6379")
	if _, err := os.Stat("/.dockerenv"); err == nil {
		if redisHost == "localhost" || redisHost == "127.0.0.1" {
			redisHost = "redis"
			redisPort = "6379"
		}
	}

	cfg := &Config{
		Host:         getEnv("HOST", "0.0.0.0"),
		Port:         port,
		NodeEnv:      getEnv("NODE_ENV", "development"),
		BaseURL:      baseURL,
		AssetBaseURL: assetBaseURL,
		TrustProxy:   getEnv("TRUST_PROXY", "loopback"),

		SMTPHost:   getEnv("SMTP_HOST", ""),
		SMTPPort:   getEnvInt("SMTP_PORT", 587),
		SMTPUser:   getEnv("SMTP_USER", getEnv("SMTP_USERNAME", getEnv("MAIL_USER", ""))),
		SMTPPass:   getEnv("SMTP_PASS", getEnv("SMTP_PASSWORD", getEnv("MAIL_PASS", ""))),
		SMTPSecure: getEnvBool("SMTP_SECURE", false),
		SMTPFrom:   getEnv("SMTP_FROM", "DateMate <noreply@datemate.app>"),

		ThrottleTTL:       getEnvInt("THROTTLE_TTL", 60000),
		ThrottleLimit:     getEnvInt("THROTTLE_LIMIT", 120),
		ThrottleAuthLimit: getEnvInt("THROTTLE_AUTH_LIMIT", 15),

		DatabaseURL: dbURL,

		RedisHost:            redisHost,
		RedisPort:            redisPort,
		RedisPassword:        getEnv("REDIS_PASSWORD", ""),
		RecommendedCacheTTL:  getEnvInt("RECOMMENDED_CACHE_TTL", 86400),

		JWTAccessSecret:     getEnv("JWT_ACCESS_SECRET", "datemate_jwt_access_super_secret_key_2026"),
		JWTAccessExpiresIn:  getEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
		JWTRefreshSecret:    getEnv("JWT_REFRESH_SECRET", "datemate_jwt_refresh_super_secret_key_2026"),
		JWTRefreshExpiresIn: getEnv("JWT_REFRESH_EXPIRES_IN", "30d"),

		DocsProtectionEnabled: getEnvBool("DOCS_PROTECTION_ENABLED", false),
		DocsAuthEnabled:       getEnvBool("DOCS_AUTH_ENABLED", true),
		DocsUsername:          getEnv("DOCS_USERNAME", "admin"),
		DocsPassword:          getEnv("DOCS_PASSWORD", "datemate_docs_password_2026"),
		DocsIPWhitelistEnabled: getEnvBool("DOCS_IP_WHITELIST_ENABLED", false),
		DocsAllowedIPs:        splitList(getEnv("DOCS_ALLOWED_IPS", "127.0.0.1,::1")),

		InternalAPIKey:        getEnv("INTERNAL_API_KEY", "datemate_internal_api_key_2026"),
		DeviceTokenAPIKey:     getEnv("DEVICE_TOKEN_API_KEY", "datemate_device_token_api_key_2026"),
		PushNotificationAPIKey: getEnv("PUSH_NOTIFICATION_API_KEY", "datemate_push_notification_api_key_2026"),

		StorageDriver:      getEnv("STORAGE_DRIVER", "local"),
		UploadsDir:         getEnv("UPLOADS_DIR", "uploads"),
		ChatUploadsDir:     getEnv("CHAT_UPLOADS_DIR", "uploads/chat"),
		NginxAccelRedirect: getEnvBool("NGINX_ACCEL_REDIRECT", false),
		S3Endpoint:         getEnv("S3_ENDPOINT", "localhost:9000"),
		S3AccessKey:        getEnv("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey:        getEnv("S3_SECRET_KEY", "minioadmin"),
		S3Bucket:           getEnv("S3_BUCKET", "datemate-uploads"),
		S3UseSSL:           getEnvBool("S3_USE_SSL", false),

		PaginationDefaultLimit:      getEnvInt("PAGINATION_DEFAULT_LIMIT", 20),
		PaginationMaxLimit:          getEnvInt("PAGINATION_MAX_LIMIT", 100),
		MatchingDailyFreeSwipeLimit: getEnvInt("MATCHING_DAILY_FREE_SWIPE_LIMIT", 100),
		MatchingMinAge:              getEnvInt("MATCHING_MIN_AGE", 18),
		MatchingMaxAge:              getEnvInt("MATCHING_MAX_AGE", 100),
		MatchingDefaultMaxDistanceKM: getEnvInt("MATCHING_DEFAULT_MAX_DISTANCE_KM", 100),
		MatchingMaxDistanceKM:        getEnvInt("MATCHING_MAX_DISTANCE_KM", 500),
		RequireSelfieForMatching:    getEnvBool("REQUIRE_SELFIE_FOR_MATCHING", false),

		ChatMaxMessageLength:         getEnvInt("CHAT_MAX_MESSAGE_LENGTH", 4000),
		ChatMaxAttachmentsPerMessage: getEnvInt("CHAT_MAX_ATTACHMENTS_PER_MESSAGE", 10),
		ChatMaxGroupTitleLength:      getEnvInt("CHAT_MAX_GROUP_TITLE_LENGTH", 100),
		ChatMaxGroupDescriptionLength: getEnvInt("CHAT_MAX_GROUP_DESCRIPTION_LENGTH", 500),
		ChatMinGroupMembers:          getEnvInt("CHAT_MIN_GROUP_MEMBERS", 2),
		ChatMaxGroupMembers:          getEnvInt("CHAT_MAX_GROUP_MEMBERS", 100),
		ChatMaxGroupsPerUser:         getEnvInt("CHAT_MAX_GROUPS_PER_USER", 50),
		ChatPresenceDebounceMS:       getEnvInt("CHAT_PRESENCE_DEBOUNCE_MS", 3000),
		ChatWSPingIntervalMS:         getEnvInt("CHAT_WS_PING_INTERVAL_MS", 30000),
		ChatWSPingTimeoutMS:          getEnvInt("CHAT_WS_PING_TIMEOUT_MS", 25000),

		FCMMockMode:                getEnvBool("FCM_MOCK_MODE", true),
		FirebaseCredentialsPath:    getEnvAny([]string{"FIREBASE_CREDENTIALS_PATH", "GOOGLE_APPLICATION_CREDENTIALS"}, ""),
		FirebaseServiceAccountJSON: getEnvAny([]string{"FIREBASE_SERVICE_ACCOUNT", "FIREBASE_SERVICE_ACCOUNT_DEV", "FIREBASE_SERVICE_ACCOUNT_JSON", "FIREBASE_CONFIG", "FIREBASE_CREDENTIALS"}, ""),
		PushDefaultPriority:        getEnv("PUSH_DEFAULT_PRIORITY", "normal"),
		PushNotificationTimeoutMS:  getEnvInt("PUSH_NOTIFICATION_TIMEOUT_MS", 5000),
		PushMaxBatchSize:           getEnvInt("PUSH_MAX_BATCH_SIZE", 500),

		GeoDataDir: getEnv("GEO_DATA_DIR", "data/geo"),
	}

	return cfg
}

func getEnv(key, def string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return def
}

func getEnvAny(keys []string, def string) string {
	for _, k := range keys {
		if val := strings.TrimSpace(os.Getenv(k)); val != "" {
			return val
		}
	}
	return def
}

func getEnvInt(key string, def int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return def
}

func getEnvBool(key string, def bool) bool {
	if val := os.Getenv(key); val != "" {
		return strings.EqualFold(val, "true") || val == "1"
	}
	return def
}

func splitList(val string) []string {
	if val == "" {
		return nil
	}
	parts := strings.Split(val, ",")
	res := make([]string, 0, len(parts))
	for _, p := range parts {
		clean := strings.TrimSpace(p)
		if clean != "" {
			res = append(res, clean)
		}
	}
	return res
}
