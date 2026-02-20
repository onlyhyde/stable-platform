package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/stable-net/shared/health"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/handler"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/logger"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/middleware"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/service"
)

func main() {
	// Initialize structured logger
	log := logger.New(logger.Config{
		Level:  getEnv("LOG_LEVEL", "info"),
		Format: getEnv("LOG_FORMAT", "json"),
		Name:   "bank-simulator",
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

	// Create bank service
	bankService := service.NewBankService(cfg)

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
	checker := health.NewChecker("bank-simulator", "1.0.0")
	checker.RegisterRoutes(r)

	// Prometheus metrics endpoint
	startTime := time.Now()
	var requestCount, errorCount int64
	r.GET("/metrics", func(c *gin.Context) {
		uptime := time.Since(startTime).Seconds()
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.String(200, `# HELP bank_simulator_up Service up status
# TYPE bank_simulator_up gauge
bank_simulator_up{service="bank-simulator"} 1
# HELP bank_simulator_uptime_seconds Service uptime in seconds
# TYPE bank_simulator_uptime_seconds gauge
bank_simulator_uptime_seconds{service="bank-simulator"} %f
# HELP bank_simulator_requests_total Total HTTP requests
# TYPE bank_simulator_requests_total counter
bank_simulator_requests_total{service="bank-simulator"} %d
# HELP bank_simulator_errors_total Total HTTP errors
# TYPE bank_simulator_errors_total counter
bank_simulator_errors_total{service="bank-simulator"} %d
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

	// Register bank routes
	bankHandler := handler.NewBankHandler(bankService)
	bankHandler.RegisterRoutes(r)

	// Start server
	log.Info("Bank Simulator starting", slog.String("port", cfg.Port))
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
