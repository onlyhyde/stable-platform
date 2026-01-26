package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/model"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/service"
)

// OnRampHandler handles onramp HTTP requests
type OnRampHandler struct {
	onrampService *service.OnRampService
}

// NewOnRampHandler creates a new onramp handler
func NewOnRampHandler(onrampService *service.OnRampService) *OnRampHandler {
	return &OnRampHandler{
		onrampService: onrampService,
	}
}

// RegisterRoutes registers the onramp routes
func (h *OnRampHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		api.POST("/quote", h.GetQuote)

		orders := api.Group("/orders")
		{
			orders.POST("", h.CreateOrder)
			orders.GET("/:id", h.GetOrder)
			orders.POST("/:id/cancel", h.CancelOrder)
		}

		users := api.Group("/users")
		{
			users.GET("/:userId/orders", h.GetUserOrders)
		}
	}
}

// GetQuote returns a price quote
// @Summary Get price quote
// @Description Get a price quote for fiat to crypto conversion
// @Tags quotes
// @Accept json
// @Produce json
// @Param request body model.QuoteRequest true "Quote request"
// @Success 200 {object} model.QuoteResponse
// @Failure 400 {object} ErrorResponse
// @Router /api/v1/quote [post]
func (h *OnRampHandler) GetQuote(c *gin.Context) {
	var req model.QuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	quote, err := h.onrampService.GetQuote(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "quote")})
		return
	}

	c.JSON(http.StatusOK, quote)
}

// CreateOrder creates a new purchase order
// @Summary Create purchase order
// @Description Create a fiat-to-crypto purchase order
// @Tags orders
// @Accept json
// @Produce json
// @Param request body model.CreateOrderRequest true "Order request"
// @Success 201 {object} model.Order
// @Failure 400 {object} ErrorResponse
// @Router /api/v1/orders [post]
func (h *OnRampHandler) CreateOrder(c *gin.Context) {
	var req model.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	order, err := h.onrampService.CreateOrder(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "order")})
		return
	}

	c.JSON(http.StatusCreated, order)
}

// GetOrder returns an order by ID
// @Summary Get order
// @Description Get order details by ID
// @Tags orders
// @Produce json
// @Param id path string true "Order ID"
// @Success 200 {object} model.Order
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/orders/{id} [get]
func (h *OnRampHandler) GetOrder(c *gin.Context) {
	id := c.Param("id")

	order, err := h.onrampService.GetOrder(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: sanitizeError(err, "order")})
		return
	}

	c.JSON(http.StatusOK, order)
}

// CancelOrder cancels a pending order
// @Summary Cancel order
// @Description Cancel a pending purchase order
// @Tags orders
// @Produce json
// @Param id path string true "Order ID"
// @Success 200 {object} model.Order
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/orders/{id}/cancel [post]
func (h *OnRampHandler) CancelOrder(c *gin.Context) {
	id := c.Param("id")

	order, err := h.onrampService.CancelOrder(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "order")})
		return
	}

	c.JSON(http.StatusOK, order)
}

// GetUserOrders returns all orders for a user
// @Summary Get user orders
// @Description Get all purchase orders for a user
// @Tags users
// @Produce json
// @Param userId path string true "User ID"
// @Success 200 {array} model.Order
// @Router /api/v1/users/{userId}/orders [get]
func (h *OnRampHandler) GetUserOrders(c *gin.Context) {
	userID := c.Param("userId")
	orders := h.onrampService.GetOrdersByUser(userID)
	c.JSON(http.StatusOK, orders)
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// sanitizeError returns a user-safe error message without exposing internal details
// This prevents information leakage about resource existence
func sanitizeError(err error, resourceType string) string {
	errMsg := err.Error()

	// Map specific error patterns to generic messages
	switch {
	case contains(errMsg, "not found"):
		return "The requested " + resourceType + " could not be processed"
	case contains(errMsg, "cannot be cancelled"):
		return "This operation is not available for the current " + resourceType + " state"
	case contains(errMsg, "invalid"):
		return "Invalid request parameters"
	default:
		return "An error occurred processing your request"
	}
}

// contains checks if s contains substr
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
