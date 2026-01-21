package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/handler"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/service"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Load configuration
	cfg := config.Load()

	// Create onramp service
	onrampService := service.NewOnRampService(cfg)

	// Create Gin router
	r := gin.Default()

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "onramp-simulator",
		})
	})

	// Register onramp routes
	onrampHandler := handler.NewOnRampHandler(onrampService)
	onrampHandler.RegisterRoutes(r)

	// Start server
	log.Printf("Starting onramp-simulator on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
