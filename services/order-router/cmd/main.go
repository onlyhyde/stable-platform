package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/stablenet/stable-platform/services/order-router/internal/config"
	"github.com/stablenet/stable-platform/services/order-router/internal/handler"
	"github.com/stablenet/stable-platform/services/order-router/internal/service"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize router service
	routerService := service.NewRouterService(cfg)

	// Create Gin router
	r := gin.Default()

	// Add middleware
	r.Use(gin.Recovery())

	// Initialize handler and register routes
	routerHandler := handler.NewRouterHandler(routerService)
	routerHandler.RegisterRoutes(r)

	// Log startup info
	log.Printf("Order Router Service starting on port %s", cfg.Port)
	log.Printf("Chain ID: %d", cfg.ChainID)
	log.Printf("Supported protocols: %v", routerService.GetSupportedProtocols())

	// Start server
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
