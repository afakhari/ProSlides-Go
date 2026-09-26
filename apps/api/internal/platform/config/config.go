package config

import (
	"fmt"
	"log/slog"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config contains only process-wide configuration. Domain configuration belongs
// to its owning module, not to this package.
type Config struct {
	Environment             string
	HTTPAddr                string
	LogLevel                slog.Level
	DatabaseURL             string
	DatabasePoolMaxConns    int
	DatabasePoolMinConns    int
	DatabaseConnMaxLifetime time.Duration
	DatabaseConnMaxIdleTime time.Duration
	RedisURL                string
	DependencyCheckTimeout  time.Duration
	MigrationTimeout        time.Duration
	LiveRequestTimeout      time.Duration
	SessionTTL              time.Duration
	AuthRequireVerification bool
	EmailVerificationTTL    time.Duration
	EmailResendDelay        time.Duration
	EmailMaxAttempts        int
	EmailVerificationPepper string
	PasswordResetBaseURL    string
	PasswordResetTTL        time.Duration
	SMTPHost                string
	SMTPPort                int
	SMTPUsername            string
	SMTPPassword            string
	SMTPFromAddress         string
	SMTPFromName            string
	SMTPUseTLS              bool
	SMTPUseSSL              bool
	GoogleClientID          string
	GoogleJWKSURL           string
	TrustedProxyCIDRs       []netip.Prefix
}

func Load() (Config, error) {
	cfg := Config{
		Environment: valueOrDefault("APP_ENV", "development"),
		HTTPAddr:    valueOrDefault("HTTP_ADDR", ":8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
	}

	sessionTTL, err := time.ParseDuration(valueOrDefault("SESSION_TTL", "168h"))
	if err != nil || sessionTTL <= 0 {
		return Config{}, fmt.Errorf("SESSION_TTL must be a positive duration")
	}
	cfg.SessionTTL = sessionTTL

	cfg.AuthRequireVerification, err = boolValue("AUTH_REQUIRE_EMAIL_VERIFICATION", false)
	if err != nil {
		return Config{}, err
	}
	cfg.EmailVerificationTTL, err = positiveDuration("EMAIL_VERIFICATION_TTL", "10m")
	if err != nil {
		return Config{}, err
	}
	cfg.EmailResendDelay, err = positiveDuration("EMAIL_VERIFICATION_RESEND_DELAY", "60s")
	if err != nil {
		return Config{}, err
	}
	cfg.PasswordResetTTL, err = positiveDuration("PASSWORD_RESET_TTL", "15m")
	if err != nil {
		return Config{}, err
	}
	cfg.EmailMaxAttempts, err = positiveInt("EMAIL_VERIFICATION_MAX_ATTEMPTS", 5)
	if err != nil {
		return Config{}, err
	}
	cfg.SMTPPort, err = positiveInt("SMTP_PORT", 25)
	if err != nil {
		return Config{}, err
	}
	cfg.SMTPUseTLS, err = boolValue("SMTP_USE_TLS", false)
	if err != nil {
		return Config{}, err
	}
	cfg.SMTPUseSSL, err = boolValue("SMTP_USE_SSL", false)
	if err != nil {
		return Config{}, err
	}
	if cfg.SMTPUseTLS && cfg.SMTPUseSSL {
		return Config{}, fmt.Errorf("SMTP_USE_TLS and SMTP_USE_SSL cannot both be true")
	}
	cfg.PasswordResetBaseURL = strings.TrimRight(os.Getenv("PUBLIC_WEB_URL"), "/")
	cfg.SMTPHost = os.Getenv("SMTP_HOST")
	cfg.SMTPUsername = os.Getenv("SMTP_USERNAME")
	cfg.SMTPPassword = os.Getenv("SMTP_PASSWORD")
	cfg.SMTPFromAddress = os.Getenv("SMTP_FROM_ADDRESS")
	cfg.SMTPFromName = valueOrDefault("SMTP_FROM_NAME", "ProSlides")
	cfg.EmailVerificationPepper = os.Getenv("EMAIL_VERIFICATION_PEPPER")
	cfg.GoogleClientID = os.Getenv("GOOGLE_CLIENT_ID")
	cfg.GoogleJWKSURL = valueOrDefault("GOOGLE_JWKS_URL", "https://www.googleapis.com/oauth2/v3/certs")
	cfg.TrustedProxyCIDRs, err = prefixList("TRUSTED_PROXY_CIDRS")
	if err != nil {
		return Config{}, err
	}
	if (cfg.SMTPHost == "") != (cfg.SMTPFromAddress == "") {
		return Config{}, fmt.Errorf("SMTP_HOST and SMTP_FROM_ADDRESS must be configured together")
	}
	if cfg.Environment == "production" {
		databaseURL, parseErr := url.Parse(cfg.DatabaseURL)
		if parseErr != nil ||
			(databaseURL.Scheme != "postgres" && databaseURL.Scheme != "postgresql") ||
			databaseURL.Host == "" {
			return Config{}, fmt.Errorf("DATABASE_URL must be a PostgreSQL URL in production")
		}
		switch databaseURL.Query().Get("sslmode") {
		case "require", "verify-ca", "verify-full":
		default:
			return Config{}, fmt.Errorf("DATABASE_URL must require PostgreSQL TLS in production")
		}

		redisURL, redisErr := url.Parse(cfg.RedisURL)
		if redisErr != nil || redisURL.Scheme != "rediss" || redisURL.Host == "" {
			return Config{}, fmt.Errorf("REDIS_URL must use rediss:// in production")
		}

		publicURL, parseErr := url.Parse(cfg.PasswordResetBaseURL)
		if parseErr != nil ||
			publicURL.Scheme != "https" ||
			publicURL.Host == "" ||
			publicURL.User != nil ||
			(publicURL.Path != "" && publicURL.Path != "/") ||
			publicURL.RawQuery != "" ||
			publicURL.Fragment != "" {
			return Config{}, fmt.Errorf("PUBLIC_WEB_URL must be an HTTPS origin in production")
		}
		if len(cfg.TrustedProxyCIDRs) == 0 {
			return Config{}, fmt.Errorf("TRUSTED_PROXY_CIDRS must be configured in production")
		}
		if cfg.GoogleClientID != "" {
			jwksURL, jwksErr := url.Parse(cfg.GoogleJWKSURL)
			if jwksErr != nil || jwksURL.Scheme != "https" || jwksURL.Host == "" {
				return Config{}, fmt.Errorf("GOOGLE_JWKS_URL must use HTTPS when Google login is enabled in production")
			}
		}
	}
	if cfg.AuthRequireVerification && cfg.SMTPHost == "" {
		return Config{}, fmt.Errorf("SMTP is required when AUTH_REQUIRE_EMAIL_VERIFICATION is true")
	}
	if cfg.AuthRequireVerification && len(cfg.EmailVerificationPepper) < 32 {
		return Config{}, fmt.Errorf("EMAIL_VERIFICATION_PEPPER must contain at least 32 characters when verification is required")
	}

	dependencyCheckTimeout, err := time.ParseDuration(valueOrDefault("DEPENDENCY_CHECK_TIMEOUT", "2s"))
	if err != nil || dependencyCheckTimeout <= 0 {
		return Config{}, fmt.Errorf("DEPENDENCY_CHECK_TIMEOUT must be a positive duration")
	}
	cfg.DependencyCheckTimeout = dependencyCheckTimeout
	cfg.MigrationTimeout, err = positiveDuration("MIGRATION_TIMEOUT", "2m")
	if err != nil {
		return Config{}, err
	}
	cfg.LiveRequestTimeout, err = positiveDuration("LIVE_REQUEST_TIMEOUT", "10s")
	if err != nil {
		return Config{}, err
	}
	cfg.DatabasePoolMaxConns, err = positiveInt("DATABASE_POOL_MAX_CONNS", 50)
	if err != nil {
		return Config{}, err
	}
	cfg.DatabasePoolMinConns, err = nonnegativeInt("DATABASE_POOL_MIN_CONNS", 5)
	if err != nil || cfg.DatabasePoolMinConns > cfg.DatabasePoolMaxConns {
		return Config{}, fmt.Errorf("DATABASE_POOL_MIN_CONNS must be non-negative and no greater than DATABASE_POOL_MAX_CONNS")
	}
	cfg.DatabaseConnMaxLifetime, err = positiveDuration("DATABASE_CONN_MAX_LIFETIME", "30m")
	if err != nil {
		return Config{}, err
	}
	cfg.DatabaseConnMaxIdleTime, err = positiveDuration("DATABASE_CONN_MAX_IDLE_TIME", "5m")
	if err != nil {
		return Config{}, err
	}

	level, err := parseLogLevel(valueOrDefault("LOG_LEVEL", "INFO"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = level

	if cfg.DatabaseURL == "" || cfg.RedisURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL and REDIS_URL are required")
	}
	return cfg, nil
}

func prefixList(key string) ([]netip.Prefix, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	prefixes := make([]netip.Prefix, 0, len(parts))
	for _, part := range parts {
		prefix, err := netip.ParsePrefix(strings.TrimSpace(part))
		if err != nil {
			return nil, fmt.Errorf("%s must contain valid comma-separated CIDRs", key)
		}
		prefixes = append(prefixes, prefix.Masked())
	}
	return prefixes, nil
}

func positiveDuration(key, fallback string) (time.Duration, error) {
	value, err := time.ParseDuration(valueOrDefault(key, fallback))
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive duration", key)
	}
	return value, nil
}

func positiveInt(key string, fallback int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", key)
	}
	return value, nil
}

func nonnegativeInt(key string, fallback int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		return 0, fmt.Errorf("%s must be a non-negative integer", key)
	}
	return value, nil
}

func boolValue(key string, fallback bool) (bool, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, fmt.Errorf("%s must be a boolean", key)
	}
	return value, nil
}

func valueOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseLogLevel(raw string) (slog.Level, error) {
	switch strings.ToUpper(raw) {
	case "DEBUG":
		return slog.LevelDebug, nil
	case "INFO":
		return slog.LevelInfo, nil
	case "WARN", "WARNING":
		return slog.LevelWarn, nil
	case "ERROR":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("invalid LOG_LEVEL %q", raw)
	}
}
