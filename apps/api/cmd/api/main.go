package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/proslides/proslides/internal/identity"
	"github.com/proslides/proslides/internal/live"
	"github.com/proslides/proslides/internal/platform/config"
	"github.com/proslides/proslides/internal/platform/dependency"
	platformhttp "github.com/proslides/proslides/internal/platform/http"
	"github.com/proslides/proslides/internal/platform/migrate"
	"github.com/proslides/proslides/internal/platform/postgres"
	"github.com/proslides/proslides/internal/platform/redis"
	"github.com/proslides/proslides/internal/presentations"
	"github.com/proslides/proslides/internal/reports"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	}))
	slog.SetDefault(logger)
	startupCtx, cancelStartup := context.WithTimeout(context.Background(), cfg.DependencyCheckTimeout)
	defer cancelStartup()

	postgresClient, err := postgres.New(startupCtx, cfg.DatabaseURL, postgres.Options{
		MaxConns: int32(cfg.DatabasePoolMaxConns), MinConns: int32(cfg.DatabasePoolMinConns),
		MaxLifetime: cfg.DatabaseConnMaxLifetime, MaxIdleTime: cfg.DatabaseConnMaxIdleTime,
	})
	if err != nil {
		logger.Error("postgres initialization failed", "error", err)
		os.Exit(1)
	}
	defer postgresClient.Close()
	migrationCtx, cancelMigration := context.WithTimeout(context.Background(), cfg.MigrationTimeout)
	if err := migrate.Apply(migrationCtx, postgresClient.Pool()); err != nil {
		cancelMigration()
		logger.Error("migration failed", "error", err)
		os.Exit(1)
	}
	cancelMigration()

	redisClient, err := redis.New(cfg.RedisURL)
	if err != nil {
		logger.Error("redis initialization failed", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := redisClient.Close(); err != nil {
			logger.Warn("redis close failed", "error", err)
		}
	}()
	var passwordMailer identity.PasswordResetMailer
	var verificationMailer identity.VerificationMailer
	if cfg.SMTPHost != "" || cfg.SMTPFromAddress != "" {
		configuredMailer, mailErr := identity.NewSMTPMailer(identity.SMTPConfig{Host: cfg.SMTPHost, Port: cfg.SMTPPort, Username: cfg.SMTPUsername, Password: cfg.SMTPPassword, FromAddress: cfg.SMTPFromAddress, FromName: cfg.SMTPFromName, UseTLS: cfg.SMTPUseTLS, UseSSL: cfg.SMTPUseSSL, Timeout: 10 * time.Second})
		if mailErr != nil {
			logger.Error("SMTP configuration invalid", "error", mailErr)
			os.Exit(1)
		}
		passwordMailer = configuredMailer
		verificationMailer = configuredMailer
	}

	var liveBroker *live.EventBroker
	server := &http.Server{
		Addr: cfg.HTTPAddr,
		Handler: platformhttp.NewRouterWithRoutes(cfg, []dependency.Dependency{postgresClient, redisClient}, func(m *http.ServeMux) []platformhttp.MetricSource {
			var googleVerifier identity.GoogleVerifier
			if cfg.GoogleClientID != "" {
				googleVerifier = identity.NewGoogleTokenVerifier(cfg.GoogleClientID, cfg.GoogleJWKSURL, nil)
			}
			identityService := identity.NewServiceWithOptions(identity.NewPostgresStore(postgresClient.Pool()), cfg.SessionTTL, identity.ServiceOptions{
				PasswordResetMailer:     passwordMailer,
				VerificationMailer:      verificationMailer,
				GoogleVerifier:          googleVerifier,
				PasswordResetBaseURL:    cfg.PasswordResetBaseURL,
				PasswordResetTTL:        cfg.PasswordResetTTL,
				RequireVerification:     cfg.AuthRequireVerification,
				VerificationTTL:         cfg.EmailVerificationTTL,
				VerificationResendDelay: cfg.EmailResendDelay,
				VerificationMaxAttempts: cfg.EmailMaxAttempts,
				VerificationPepper:      cfg.EmailVerificationPepper,
			})
			liveStore := live.NewPostgresStore(postgresClient.Pool())
			liveService := live.NewService(liveStore, live.DeductionPolicy{})
			liveBroker = live.NewEventBroker(liveStore, 250*time.Millisecond, 256)
			identity.NewHTTP(identityService, cfg.Environment == "production", redisClient).WithTrustedProxyCIDRs(cfg.TrustedProxyCIDRs).Register(m)
			presentations.NewHTTP(identityService, presentations.NewPostgresStore(postgresClient.Pool())).Register(m)
			reports.NewHTTP(identityService, reports.NewPostgresStore(postgresClient.Pool())).Register(m)
			live.NewHTTP(liveService, liveBroker, identityService, cfg.Environment == "production", redisClient).WithRequestTimeout(cfg.LiveRequestTimeout).Register(m)
			return []platformhttp.MetricSource{postgresClient, liveBroker, liveService}
		}),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       75 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
	server.RegisterOnShutdown(func() {
		if liveBroker != nil {
			liveBroker.Close()
		}
	})

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("api server started", "address", cfg.HTTPAddr, "environment", cfg.Environment)
		serverErrors <- server.ListenAndServe()
	}()

	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, syscall.SIGINT, syscall.SIGTERM)

	select {
	case signal := <-shutdownSignal:
		logger.Info("shutdown signal received", "signal", signal.String())
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("api server failed", "error", err)
			os.Exit(1)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
	logger.Info("api server stopped")
}
