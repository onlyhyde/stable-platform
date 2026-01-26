package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/handler"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/middleware"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/service"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Load and validate configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Create payment service
	paymentService := service.NewPaymentService(cfg)

	// Create Gin router
	r := gin.Default()

	// Add security middleware
	r.Use(gin.Recovery())
	r.Use(middleware.DefaultRateLimiter().Middleware()) // Rate limiting: 100 req/min per IP
	r.Use(bodyLimitMiddleware(1024 * 1024))             // 1MB max body size

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "pg-simulator",
		})
	})

	// Register payment routes
	paymentHandler := handler.NewPaymentHandler(paymentService)
	paymentHandler.RegisterRoutes(r)

	// Start server
	log.Printf("Starting pg-simulator on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
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
