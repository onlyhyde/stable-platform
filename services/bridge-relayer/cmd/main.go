package main

import (
	"context"
	"log"
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
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/middleware"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/monitor"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/mpc"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Set Gin mode
	gin.SetMode(cfg.Server.Mode)

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Ethereum client
	ethClient, err := ethereum.NewClient(cfg.Ethereum)
	if err != nil {
		log.Fatalf("Failed to create Ethereum client: %v", err)
	}

	// Initialize MPC signer client
	mpcClient := mpc.NewSignerClient(cfg.MPC)

	// Initialize event monitor
	eventMonitor := monitor.NewEventMonitor(ethClient, cfg.Monitor, cfg.Contracts)

	// Initialize fraud monitor
	fraudMonitor := fraud.NewFraudMonitor(ethClient, cfg.Contracts)

	// Initialize guardian monitor
	guardianMonitor := guardian.NewGuardianMonitor(ethClient, cfg.Contracts)

	// Initialize bridge executor
	bridgeExecutor := executor.NewBridgeExecutor(ethClient, mpcClient, eventMonitor, cfg.Contracts)

	// Start monitors
	if err := eventMonitor.Start(ctx); err != nil {
		log.Fatalf("Failed to start event monitor: %v", err)
	}

	if err := fraudMonitor.Start(ctx); err != nil {
		log.Fatalf("Failed to start fraud monitor: %v", err)
	}

	if err := guardianMonitor.Start(ctx); err != nil {
		log.Fatalf("Failed to start guardian monitor: %v", err)
	}

	// Start executor
	if err := bridgeExecutor.Start(ctx); err != nil {
		log.Fatalf("Failed to start bridge executor: %v", err)
	}

	// Check MPC signer health
	onlineSigners, err := mpcClient.HealthCheck(ctx)
	if err != nil {
		log.Printf("Warning: MPC health check failed: %v", err)
	} else {
		log.Printf("MPC signers online: %d/%d (threshold: %d)",
			onlineSigners, mpcClient.GetTotalSigners(), mpcClient.GetThreshold())
	}

	// Create Gin router
	r := gin.New()

	// Apply middlewares
	r.Use(middleware.RecoveryMiddleware())
	r.Use(middleware.LoggingMiddleware())
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(middleware.RequestIDMiddleware())
	r.Use(middleware.RateLimitMiddleware(cfg.RateLimit.RequestsPerSecond, cfg.RateLimit.Burst))
	r.Use(middleware.BodyLimitMiddleware(1 << 20)) // 1MB limit

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
		log.Printf("Starting bridge-relayer on port %s", cfg.Server.Port)
		log.Printf("Source chain: %d, Target chain: %d",
			cfg.Ethereum.SourceChainID, cfg.Ethereum.TargetChainID)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down bridge-relayer...")

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
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Bridge-relayer stopped")
}
