package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/stable-net/shared/health"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/handler"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/logger"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/middleware"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/service"
)

func main() {
	// Initialize structured logger
	log := logger.New(logger.Config{
		Level:  getEnv("LOG_LEVEL", "info"),
		Format: getEnv("LOG_FORMAT", "json"),
		Name:   "onramp-simulator",
	})

	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Info("No .env file found, using environment variables")
	}

	// Load and validate configuration
	cfg, err := config.Load()
	if err != nil {
		log.Error("Failed to load configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Create onramp service
	onrampService := service.NewOnRampService(cfg)

	// Set Gin mode
	if getEnv("GIN_MODE", "") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin router
	r := gin.New()

	// Add security middleware
	r.Use(gin.Recovery())
	r.Use(middleware.DefaultRateLimiter().Middleware()) // Rate limiting: 100 req/min per IP
	r.Use(bodyLimitMiddleware(1024 * 1024))             // 1MB max body size

	// Health check endpoints (shared package)
	checker := health.NewChecker("onramp-simulator", "1.0.0")
	checker.RegisterRoutes(r)

	// Prometheus metrics endpoint
	startTime := time.Now()
	var requestCount, errorCount int64
	r.GET("/metrics", func(c *gin.Context) {
		uptime := time.Since(startTime).Seconds()
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.String(200, `# HELP onramp_simulator_up Service up status
# TYPE onramp_simulator_up gauge
onramp_simulator_up{service="onramp-simulator"} 1
# HELP onramp_simulator_uptime_seconds Service uptime in seconds
# TYPE onramp_simulator_uptime_seconds gauge
onramp_simulator_uptime_seconds{service="onramp-simulator"} %f
# HELP onramp_simulator_requests_total Total HTTP requests
# TYPE onramp_simulator_requests_total counter
onramp_simulator_requests_total{service="onramp-simulator"} %d
# HELP onramp_simulator_errors_total Total HTTP errors
# TYPE onramp_simulator_errors_total counter
onramp_simulator_errors_total{service="onramp-simulator"} %d
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

	// Register onramp routes
	onrampHandler := handler.NewOnRampHandler(onrampService)
	onrampHandler.RegisterRoutes(r)

	// Start server
	log.Info("OnRamp Simulator starting", slog.String("port", cfg.Port))
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Error("Failed to start server", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

// bodyLimitMiddleware limits the request body size
func bodyLimitMiddleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": "request body too large",
			})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
