package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stable-net/shared/health"
	"github.com/stablenet/stable-platform/services/order-router/internal/config"
	"github.com/stablenet/stable-platform/services/order-router/internal/handler"
	"github.com/stablenet/stable-platform/services/order-router/internal/logger"
	"github.com/stablenet/stable-platform/services/order-router/internal/middleware"
	"github.com/stablenet/stable-platform/services/order-router/internal/service"
)

func main() {
	// Initialize structured logger
	log := logger.New(logger.Config{
		Level:  getEnv("LOG_LEVEL", "info"),
		Format: getEnv("LOG_FORMAT", "json"),
		Name:   "order-router",
	})

	// Load and validate configuration
	cfg, err := config.Load()
	if err != nil {
		log.Error("Failed to load configuration",
			slog.String("error", err.Error()),
		)
		os.Exit(1)
	}

	// Initialize router service
	routerService := service.NewRouterService(cfg)

	// Set Gin mode based on environment
	if getEnv("GIN_MODE", "") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin router
	r := gin.New()

	// Use recovery middleware with structured logging
	r.Use(gin.Recovery())
	r.Use(middleware.DefaultRateLimiter().Middleware()) // 100 requests per minute per IP
	r.Use(middleware.DefaultBodyLimit())                // 1MB max body size

	// Health check endpoints (shared package)
	checker := health.NewChecker("order-router", "1.0.0")
	checker.RegisterRoutes(r)

	// Prometheus metrics endpoint
	startTime := time.Now()
	var requestCount, errorCount int64
	r.GET("/metrics", func(c *gin.Context) {
		uptime := time.Since(startTime).Seconds()
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.String(http.StatusOK, `# HELP order_router_up Service up status
# TYPE order_router_up gauge
order_router_up{service="order-router"} 1
# HELP order_router_uptime_seconds Service uptime in seconds
# TYPE order_router_uptime_seconds gauge
order_router_uptime_seconds{service="order-router"} %f
# HELP order_router_requests_total Total HTTP requests
# TYPE order_router_requests_total counter
order_router_requests_total{service="order-router"} %d
# HELP order_router_errors_total Total HTTP errors
# TYPE order_router_errors_total counter
order_router_errors_total{service="order-router"} %d
`, uptime, requestCount, errorCount)
	})

	// Metrics middleware
	r.Use(func(c *gin.Context) {
		requestCount++
		c.Next()
		if c.Writer.Status() >= 400 {
			errorCount++
		}
	})

	// Initialize handler and register routes
	routerHandler := handler.NewRouterHandler(routerService)
	routerHandler.RegisterRoutes(r)

	// Log startup info
	log.Info("Order Router Service starting",
		slog.String("port", cfg.Port),
		slog.Int("chainId", cfg.ChainID),
		slog.Any("protocols", routerService.GetSupportedProtocols()),
	)

	// Start server
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Error("Failed to start server",
			slog.String("error", err.Error()),
		)
		os.Exit(1)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
