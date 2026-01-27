package handler

import (
	"errors"
	"io"
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

			// 3D Secure endpoints
			payments.POST("/:id/3ds/initiate", h.InitiateThreeDSecure)
			payments.POST("/:id/3ds/complete", h.CompleteThreeDSecure)
			payments.POST("/:id/3ds/finalize", h.FinalizePaymentAfter3DS)
		}

		merchants := api.Group("/merchants")
		{
			merchants.GET("/:merchantId/payments", h.GetMerchantPayments)
		}

		// 3D Secure challenge simulation page
		threeds := api.Group("/3ds")
		{
			threeds.GET("/challenge/:acsTransactionId", h.RenderChallengePage)
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
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
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

// InitiateThreeDSecure initiates 3D Secure authentication
// @Summary Initiate 3D Secure
// @Description Start 3D Secure authentication for a payment
// @Tags 3ds
// @Accept json
// @Produce json
// @Param id path string true "Payment ID"
// @Param request body model.ThreeDSecureInitiateRequest true "3DS initiation request"
// @Success 200 {object} model.ThreeDSecureInitiateResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/payments/{id}/3ds/initiate [post]
func (h *PaymentHandler) InitiateThreeDSecure(c *gin.Context) {
	id := c.Param("id")

	var req model.ThreeDSecureInitiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	response, err := h.paymentService.InitiateThreeDSecure(id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "3ds")})
		return
	}

	c.JSON(http.StatusOK, response)
}

// CompleteThreeDSecure completes 3D Secure authentication
// @Summary Complete 3D Secure
// @Description Complete 3D Secure authentication with challenge response
// @Tags 3ds
// @Accept json
// @Produce json
// @Param id path string true "Payment ID"
// @Param request body model.ThreeDSecureCompleteRequest true "3DS completion request"
// @Success 200 {object} model.ThreeDSecureCompleteResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/payments/{id}/3ds/complete [post]
func (h *PaymentHandler) CompleteThreeDSecure(c *gin.Context) {
	id := c.Param("id")

	var req model.ThreeDSecureCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	response, err := h.paymentService.CompleteThreeDSecure(id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "3ds")})
		return
	}

	c.JSON(http.StatusOK, response)
}

// FinalizePaymentAfter3DS finalizes a payment after successful 3DS
// @Summary Finalize payment after 3DS
// @Description Complete the payment processing after successful 3D Secure authentication
// @Tags 3ds
// @Produce json
// @Param id path string true "Payment ID"
// @Success 200 {object} model.Payment
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/payments/{id}/3ds/finalize [post]
func (h *PaymentHandler) FinalizePaymentAfter3DS(c *gin.Context) {
	id := c.Param("id")

	payment, err := h.paymentService.FinalizePaymentAfter3DS(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "payment")})
		return
	}

	c.JSON(http.StatusOK, payment)
}

// RenderChallengePage renders a simulated 3DS challenge page
// @Summary Render 3DS challenge page
// @Description Display a simulated 3DS challenge form for testing
// @Tags 3ds
// @Produce html
// @Param acsTransactionId path string true "ACS Transaction ID"
// @Param returnUrl query string true "Return URL after challenge"
// @Success 200 {string} string "HTML page"
// @Router /api/v1/3ds/challenge/{acsTransactionId} [get]
func (h *PaymentHandler) RenderChallengePage(c *gin.Context) {
	acsTransactionID := c.Param("acsTransactionId")
	returnURL := c.Query("returnUrl")

	// Render a simple HTML form for the challenge
	html := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>3D Secure Challenge - PG Simulator</title>
    <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
        h1 { color: #333; margin-bottom: 8px; font-size: 24px; }
        p { color: #666; margin-bottom: 24px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: #333; font-weight: bold; }
        input[type="text"] { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; margin-bottom: 12px; }
        button:hover { background: #45a049; }
        button.cancel { background: #f44336; }
        button.cancel:hover { background: #da190b; }
        .info { background: #e7f3ff; border: 1px solid #b3d7ff; padding: 12px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; }
        .bank-logo { text-align: center; margin-bottom: 20px; font-size: 32px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="bank-logo">🏦</div>
        <h1>Verify Your Identity</h1>
        <p>Your bank requires additional authentication to complete this transaction.</p>
        <div class="info">
            <strong>Transaction ID:</strong> ` + acsTransactionID[:8] + `...<br>
            <strong>Note:</strong> Enter the OTP sent to your registered mobile number.
        </div>
        <form id="challengeForm">
            <div class="form-group">
                <label for="otp">One-Time Password (OTP)</label>
                <input type="text" id="otp" name="otp" placeholder="Enter 6-digit OTP" maxlength="6" pattern="[0-9]*">
            </div>
            <input type="hidden" id="returnUrl" value="` + returnURL + `">
            <input type="hidden" id="acsTransactionId" value="` + acsTransactionID + `">
            <button type="submit">Verify</button>
            <button type="button" class="cancel" onclick="cancelChallenge()">Cancel</button>
        </form>
        <div class="info" style="margin-top: 20px; background: #fff3cd; border-color: #ffc107;">
            <strong>Test Values:</strong><br>
            • Enter <code>123456</code> to simulate success<br>
            • Enter <code>000000</code> to simulate failure<br>
            • Any other 6-digit code has 95% success rate
        </div>
    </div>
    <script>
        document.getElementById('challengeForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const otp = document.getElementById('otp').value;
            const returnUrl = document.getElementById('returnUrl').value;
            const acsTransactionId = document.getElementById('acsTransactionId').value;

            // Redirect back with the challenge response
            const separator = returnUrl.includes('?') ? '&' : '?';
            window.location.href = returnUrl + separator + 'challengeResponse=' + otp + '&acsTransactionId=' + acsTransactionId + '&status=completed';
        });

        function cancelChallenge() {
            const returnUrl = document.getElementById('returnUrl').value;
            const acsTransactionId = document.getElementById('acsTransactionId').value;
            const separator = returnUrl.includes('?') ? '&' : '?';
            window.location.href = returnUrl + separator + 'acsTransactionId=' + acsTransactionId + '&status=cancelled';
        }
    </script>
</body>
</html>`

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, html)
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
