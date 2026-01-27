package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/stablenet/stable-platform/services/subscription-executor/internal/config"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/handler"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/logger"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/middleware"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/repository"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/service"
)

func main() {
	// Initialize structured logger
	log := logger.New(logger.Config{
		Level:  getEnv("LOG_LEVEL", "info"),
		Format: getEnv("LOG_FORMAT", "json"),
		Name:   "subscription-executor",
	})

	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Info("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize repository
	var repo repository.SubscriptionRepository
	if cfg.Database.UseInMemory {
		log.Info("Using in-memory repository (development mode)")
		repo = repository.NewInMemoryRepository()
	} else {
		log.Info("Connecting to PostgreSQL database")
		pgConfig := &repository.PostgresConfig{
			DatabaseURL:       cfg.Database.URL,
			MaxConns:          cfg.Database.MaxConns,
			MinConns:          cfg.Database.MinConns,
			MaxConnLifetime:   cfg.Database.MaxConnLifetime,
			MaxConnIdleTime:   cfg.Database.MaxConnIdleTime,
			HealthCheckPeriod: cfg.Database.HealthCheckPeriod,
			ConnectTimeout:    cfg.Database.ConnectTimeout,
			StatementTimeout:  cfg.Database.StatementTimeout,
		}

		pgRepo, err := repository.NewPostgresRepository(ctx, pgConfig)
		if err != nil {
			log.Warn("Failed to connect to database, falling back to in-memory repository",
				slog.String("error", err.Error()),
			)
			repo = repository.NewInMemoryRepository()
		} else {
			repo = pgRepo
			defer pgRepo.Close()
		}
	}

	// Create executor service with repository
	executorService := service.NewExecutorService(cfg, repo)

	// Start executor service in background
	go executorService.Start(ctx)

	// Set Gin mode
	if getEnv("GIN_MODE", "") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin router
	r := gin.New()
	r.Use(gin.Recovery())

	// Add security middleware
	r.Use(middleware.DefaultRateLimiter().Middleware())                  // Rate limiting: 100 req/min per IP
	r.Use(middleware.NewIdempotencyMiddleware(repo).Middleware()) // API idempotency

	// Health check endpoint with database status
	r.GET("/health", func(c *gin.Context) {
		status := "ok"
		dbStatus := "connected"

		// Check database connectivity with timeout
		pingCtx, pingCancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer pingCancel()

		if err := repo.Ping(pingCtx); err != nil {
			dbStatus = "disconnected"
			status = "degraded"
		}

		c.JSON(200, gin.H{
			"status":   status,
			"service":  "subscription-executor",
			"database": dbStatus,
		})
	})

	// Register subscription routes
	subscriptionHandler := handler.NewSubscriptionHandler(executorService)
	subscriptionHandler.RegisterRoutes(r)

	// Handle graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Info("Received shutdown signal")
		cancel()
		executorService.Stop()
	}()

	// Start server
	log.Info("Subscription Executor starting", slog.String("port", cfg.Port))
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Error("Failed to start server", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
