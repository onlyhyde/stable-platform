package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/model"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/service"
)

// PaymentHandler handles payment HTTP requests
type PaymentHandler struct {
	paymentService *service.PaymentService
}

// NewPaymentHandler creates a new payment handler
func NewPaymentHandler(paymentService *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{
		paymentService: paymentService,
	}
}

// RegisterRoutes registers the payment routes
func (h *PaymentHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		payments := api.Group("/payments")
		{
			payments.POST("", h.CreatePayment)
			payments.GET("/:id", h.GetPayment)
			payments.POST("/:id/refund", h.RefundPayment)
			payments.POST("/:id/cancel", h.CancelPayment)
		}

		merchants := api.Group("/merchants")
		{
			merchants.GET("/:merchantId/payments", h.GetMerchantPayments)
		}
	}
}

// CreatePayment creates a new payment
// @Summary Create a payment
// @Description Process a payment transaction
// @Tags payments
// @Accept json
// @Produce json
// @Param request body model.CreatePaymentRequest true "Payment request"
// @Success 201 {object} model.Payment
// @Failure 400 {object} ErrorResponse
// @Router /api/v1/payments [post]
func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	var req model.CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	payment, err := h.paymentService.CreatePayment(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "payment")})
		return
	}

	c.JSON(http.StatusCreated, payment)
}

// GetPayment returns a payment by ID
// @Summary Get a payment
// @Description Get payment details by ID
// @Tags payments
// @Produce json
// @Param id path string true "Payment ID"
// @Success 200 {object} model.Payment
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/payments/{id} [get]
func (h *PaymentHandler) GetPayment(c *gin.Context) {
	id := c.Param("id")

	payment, err := h.paymentService.GetPayment(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: sanitizeError(err, "payment")})
		return
	}

	c.JSON(http.StatusOK, payment)
}

// RefundPayment refunds a payment
// @Summary Refund a payment
// @Description Refund an approved payment
// @Tags payments
// @Accept json
// @Produce json
// @Param id path string true "Payment ID"
// @Param request body model.RefundRequest false "Refund request"
// @Success 200 {object} model.Payment
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/payments/{id}/refund [post]
func (h *PaymentHandler) RefundPayment(c *gin.Context) {
	id := c.Param("id")

	var req model.RefundRequest
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	payment, err := h.paymentService.RefundPayment(id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "payment")})
		return
	}

	c.JSON(http.StatusOK, payment)
}

// CancelPayment cancels a pending payment
// @Summary Cancel a payment
// @Description Cancel a pending payment
// @Tags payments
// @Produce json
// @Param id path string true "Payment ID"
// @Success 200 {object} model.Payment
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/payments/{id}/cancel [post]
func (h *PaymentHandler) CancelPayment(c *gin.Context) {
	id := c.Param("id")

	payment, err := h.paymentService.CancelPayment(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "payment")})
		return
	}

	c.JSON(http.StatusOK, payment)
}

// GetMerchantPayments returns all payments for a merchant
// @Summary Get merchant payments
// @Description Get all payments for a specific merchant
// @Tags merchants
// @Produce json
// @Param merchantId path string true "Merchant ID"
// @Success 200 {array} model.Payment
// @Router /api/v1/merchants/{merchantId}/payments [get]
func (h *PaymentHandler) GetMerchantPayments(c *gin.Context) {
	merchantID := c.Param("merchantId")
	payments := h.paymentService.GetPaymentsByMerchant(merchantID)
	c.JSON(http.StatusOK, payments)
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
	case contains(errMsg, "cannot be refunded"), contains(errMsg, "cannot be cancelled"):
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
