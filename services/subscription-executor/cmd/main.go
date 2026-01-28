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
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/metrics"
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
	executorService := service.NewExecutorService(cfg, repo, log)

	// Start executor service in background
	go executorService.Start(ctx)

	// Set Gin mode
	if getEnv("GIN_MODE", "") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize Prometheus metrics
	m := metrics.NewMetrics()

	// Create Gin router
	r := gin.New()
	r.Use(gin.Recovery())

	// Add metrics middleware (before other middleware to capture all requests)
	r.Use(metrics.HTTPMetricsMiddleware(m))

	// Add security middleware
	r.Use(middleware.DefaultRateLimiter().Middleware())                  // Rate limiting: 100 req/min per IP
	r.Use(middleware.NewIdempotencyMiddleware(repo).Middleware()) // API idempotency

	// Health check endpoints (Kubernetes probes compatible)
	startTime := time.Now()
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
			"status":    status,
			"service":   "subscription-executor",
			"version":   "1.0.0",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"uptime":    time.Since(startTime).String(),
			"database":  dbStatus,
		})
	})
	r.GET("/ready", func(c *gin.Context) {
		// Check if database is ready
		pingCtx, pingCancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer pingCancel()

		ready := true
		if err := repo.Ping(pingCtx); err != nil {
			ready = false
		}

		statusCode := 200
		if !ready {
			statusCode = 503
		}

		c.JSON(statusCode, gin.H{
			"ready":   ready,
			"service": "subscription-executor",
		})
	})
	r.GET("/live", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"alive":   true,
			"service": "subscription-executor",
		})
	})

	// Prometheus metrics endpoint - use the real Prometheus handler
	r.GET("/metrics", metrics.GinMetricsHandler())

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
