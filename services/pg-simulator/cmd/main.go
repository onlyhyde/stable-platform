package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/stable-net/shared/health"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/handler"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/logger"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/middleware"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/service"
)

func main() {
	// Initialize structured logger
	log := logger.New(logger.Config{
		Level:  getEnv("LOG_LEVEL", "info"),
		Format: getEnv("LOG_FORMAT", "json"),
		Name:   "pg-simulator",
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

	// Create services
	paymentService := service.NewPaymentService(cfg)
	settlementService := service.NewSettlementService(paymentService)

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
	checker := health.NewChecker("pg-simulator", "1.0.0")
	checker.RegisterRoutes(r)

	// Prometheus metrics endpoint
	startTime := time.Now()
	var requestCount, errorCount int64
	r.GET("/metrics", func(c *gin.Context) {
		uptime := time.Since(startTime).Seconds()
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.String(200, `# HELP pg_simulator_up Service up status
# TYPE pg_simulator_up gauge
pg_simulator_up{service="pg-simulator"} 1
# HELP pg_simulator_uptime_seconds Service uptime in seconds
# TYPE pg_simulator_uptime_seconds gauge
pg_simulator_uptime_seconds{service="pg-simulator"} %f
# HELP pg_simulator_requests_total Total HTTP requests
# TYPE pg_simulator_requests_total counter
pg_simulator_requests_total{service="pg-simulator"} %d
# HELP pg_simulator_errors_total Total HTTP errors
# TYPE pg_simulator_errors_total counter
pg_simulator_errors_total{service="pg-simulator"} %d
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

	// Load HTML templates
	r.LoadHTMLGlob("templates/*.html")

	// Register payment routes
	paymentHandler := handler.NewPaymentHandler(paymentService, settlementService, cfg)
	paymentHandler.RegisterRoutes(r)

	// Start server
	log.Info("PG Simulator starting", slog.String("port", cfg.Port))
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
