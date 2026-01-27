package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/ethereum"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/executor"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/fraud"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/guardian"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/handler"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/logger"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/middleware"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/monitor"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/mpc"
)

func main() {
	// Initialize structured logger
	log := logger.New(logger.Config{
		Level:  getEnv("LOG_LEVEL", "info"),
		Format: getEnv("LOG_FORMAT", "json"),
		Name:   "bridge-relayer",
	})

	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Info("No .env file found, using environment variables")
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Error("Failed to load configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Set Gin mode
	gin.SetMode(cfg.Server.Mode)

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Ethereum client
	ethClient, err := ethereum.NewClient(cfg.Ethereum)
	if err != nil {
		log.Error("Failed to create Ethereum client", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Initialize MPC signer client
	mpcClient := mpc.NewSignerClient(cfg.MPC)

	// Initialize event monitor
	eventMonitor := monitor.NewEventMonitor(ethClient, cfg.Monitor, cfg.Contracts)

	// Initialize fraud monitor
	fraudMonitor := fraud.NewFraudMonitor(ethClient, cfg.Contracts)

	// Initialize guardian monitor
	guardianMonitor := guardian.NewGuardianMonitor(ethClient, cfg.Contracts)

	// Initialize event tracker for deduplication
	eventTracker := middleware.NewProcessedEventTracker(middleware.DefaultIdempotencyTTL)

	// Initialize bridge executor
	bridgeExecutor := executor.NewBridgeExecutor(ethClient, mpcClient, eventMonitor, cfg.Contracts, eventTracker)

	// Start monitors
	if err := eventMonitor.Start(ctx); err != nil {
		log.Error("Failed to start event monitor", slog.String("error", err.Error()))
		os.Exit(1)
	}

	if err := fraudMonitor.Start(ctx); err != nil {
		log.Error("Failed to start fraud monitor", slog.String("error", err.Error()))
		os.Exit(1)
	}

	if err := guardianMonitor.Start(ctx); err != nil {
		log.Error("Failed to start guardian monitor", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Start executor
	if err := bridgeExecutor.Start(ctx); err != nil {
		log.Error("Failed to start bridge executor", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Check MPC signer health
	onlineSigners, err := mpcClient.HealthCheck(ctx)
	if err != nil {
		log.Warn("MPC health check failed", slog.String("error", err.Error()))
	} else {
		log.Info("MPC signers online",
			slog.Int("online", onlineSigners),
			slog.Int("total", mpcClient.GetTotalSigners()),
			slog.Int("threshold", mpcClient.GetThreshold()),
		)
	}

	// Create Gin router
	r := gin.New()

	// Initialize idempotency store for API layer
	idempotencyStore := middleware.NewIdempotencyStore(middleware.DefaultIdempotencyTTL)

	// Apply middlewares
	r.Use(middleware.RecoveryMiddleware())
	r.Use(middleware.LoggingMiddleware())
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(middleware.RequestIDMiddleware())
	r.Use(middleware.RateLimitMiddleware(cfg.RateLimit.RequestsPerSecond, cfg.RateLimit.Burst))
	r.Use(middleware.BodyLimitMiddleware(1 << 20)) // 1MB limit
	r.Use(middleware.IdempotencyMiddleware(idempotencyStore))

	// Create handler and register routes
	h := handler.NewHandler(bridgeExecutor, eventMonitor, fraudMonitor, guardianMonitor, mpcClient)
	h.RegisterRoutes(r)

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Start server in goroutine
	go func() {
		log.Info("Bridge Relayer starting",
			slog.String("port", cfg.Server.Port),
			slog.Uint64("sourceChain", cfg.Ethereum.SourceChainID),
			slog.Uint64("targetChain", cfg.Ethereum.TargetChainID),
		)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("Failed to start server", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down bridge-relayer")

	// Cancel context to stop all monitors
	cancel()

	// Stop components
	bridgeExecutor.Stop()
	eventMonitor.Stop()
	fraudMonitor.Stop()
	guardianMonitor.Stop()

	// Shutdown HTTP server with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("Server forced to shutdown", slog.String("error", err.Error()))
	}

	log.Info("Bridge-relayer stopped")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
