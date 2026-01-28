package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/model"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/service"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/validation"
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

		// Order routes
		orders := api.Group("/orders")
		{
			orders.POST("", h.CreateOrder)
			orders.GET("/:id", h.GetOrder)
			orders.POST("/:id/cancel", h.CancelOrder)
			orders.GET("/:id/payment-callback", h.HandlePaymentCallback)
			orders.GET("/:id/payment-cancelled", h.HandlePaymentCancelled)
		}

		// User routes
		users := api.Group("/users")
		{
			users.GET("/:userId/orders", h.GetUserOrders)
		}

		// KYC routes
		kyc := api.Group("/kyc")
		{
			kyc.POST("/submit", h.SubmitKYC)
			kyc.GET("/status/:userId", h.GetKYCStatus)
			kyc.GET("/requirements", h.GetKYCRequirements)
			kyc.POST("/renew", h.RenewKYC)
		}

		// Supported assets & networks (ONRAMP-04)
		api.GET("/supported-assets", h.GetSupportedAssets)
		api.GET("/supported-chains", h.GetSupportedChains)
		api.GET("/supported-fiats", h.GetSupportedFiats)
		api.GET("/trading-pairs", h.GetTradingPairs)

		// Exchange rates & fees (ONRAMP-05)
		api.GET("/rates", h.GetRates)
		api.GET("/fees", h.GetFees)

		// Wallet validation (ONRAMP-06)
		wallets := api.Group("/wallets")
		{
			wallets.POST("/validate", h.ValidateWallet)
		}

		// Webhook routes
		webhooks := api.Group("/webhooks")
		{
			webhooks.POST("/pg", h.HandlePGWebhook)
		}
	}
}

// ========== Quote Handlers ==========

// GetQuote returns a price quote
func (h *OnRampHandler) GetQuote(c *gin.Context) {
	var req model.QuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	if errs := validation.ValidateQuoteRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	quote, err := h.onrampService.GetQuote(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "quote")})
		return
	}

	c.JSON(http.StatusOK, quote)
}

// ========== Order Handlers ==========

// CreateOrder creates a new purchase order
func (h *OnRampHandler) CreateOrder(c *gin.Context) {
	var req model.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	if errs := validation.ValidateCreateOrderRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	order, err := h.onrampService.CreateOrder(&req)
	if err != nil {
		// Check for specific errors
		switch {
		case errors.Is(err, service.ErrExceedsTransactionLimit):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Amount exceeds per-transaction limit"})
		case errors.Is(err, service.ErrExceedsDailyLimit):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Amount exceeds daily limit"})
		case errors.Is(err, service.ErrExceedsMonthlyLimit):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Amount exceeds monthly limit"})
		case errors.Is(err, service.ErrBankAccountRequired):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Bank account information required for bank transfer"})
		case errors.Is(err, service.ErrUnsupportedPaymentMethod):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Unsupported payment method"})
		case errors.Is(err, service.ErrUnsupportedAsset):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Unsupported crypto asset"})
		case errors.Is(err, service.ErrUnsupportedChain):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Asset not supported on specified chain"})
		case errors.Is(err, service.ErrUnsupportedFiat):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Unsupported fiat currency"})
		case errors.Is(err, service.ErrUnsupportedTradingPair):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Unsupported trading pair"})
		case errors.Is(err, service.ErrInvalidWalletAddress):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid wallet address format. Must be a valid EVM address (0x + 40 hex characters)"})
		default:
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "order")})
		}
		return
	}

	c.JSON(http.StatusCreated, order)
}

// GetOrder returns an order by ID
func (h *OnRampHandler) GetOrder(c *gin.Context) {
	id := c.Param("id")

	if errs := validation.ValidateOrderID(id); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	order, err := h.onrampService.GetOrder(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: sanitizeError(err, "order")})
		return
	}

	c.JSON(http.StatusOK, order)
}

// CancelOrder cancels a pending order
func (h *OnRampHandler) CancelOrder(c *gin.Context) {
	id := c.Param("id")

	if errs := validation.ValidateOrderID(id); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	order, err := h.onrampService.CancelOrder(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "order")})
		return
	}

	c.JSON(http.StatusOK, order)
}

// GetUserOrders returns all orders for a user
func (h *OnRampHandler) GetUserOrders(c *gin.Context) {
	userID := c.Param("userId")

	if errs := validation.ValidateUserIDParam(userID); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	orders := h.onrampService.GetOrdersByUser(userID)
	c.JSON(http.StatusOK, orders)
}

// HandlePaymentCallback handles the payment callback from PG
func (h *OnRampHandler) HandlePaymentCallback(c *gin.Context) {
	orderID := c.Param("id")
	redirectTo := c.Query("redirectTo")

	order, err := h.onrampService.GetOrder(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "Order not found"})
		return
	}

	if redirectTo != "" {
		redirectURL := fmt.Sprintf("%s?orderId=%s&status=%s", redirectTo, order.ID, order.Status)
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Payment callback received",
		"orderId": order.ID,
		"status":  order.Status,
	})
}

// HandlePaymentCancelled handles payment cancellation callback
func (h *OnRampHandler) HandlePaymentCancelled(c *gin.Context) {
	orderID := c.Param("id")
	redirectTo := c.Query("redirectTo")

	order, err := h.onrampService.GetOrder(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "Order not found"})
		return
	}

	// Cancel the order if it's still pending payment
	if order.Status == model.OrderStatusPendingPayment {
		_, _ = h.onrampService.CancelOrder(orderID)
	}

	if redirectTo != "" {
		redirectURL := fmt.Sprintf("%s?orderId=%s&status=cancelled", redirectTo, order.ID)
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Payment cancelled",
		"orderId": order.ID,
		"status":  "cancelled",
	})
}

// ========== KYC Handlers ==========

// SubmitKYC submits a new KYC verification request
func (h *OnRampHandler) SubmitKYC(c *gin.Context) {
	var req model.SubmitKYCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	// Validate KYC level
	if req.Level != model.KYCLevelBasic && req.Level != model.KYCLevelAdvanced {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid KYC level. Must be 'basic' or 'advanced'"})
		return
	}

	record, err := h.onrampService.SubmitKYC(&req)
	if err != nil {
		if errors.Is(err, service.ErrKYCAlreadyPending) {
			c.JSON(http.StatusConflict, ErrorResponse{Error: "KYC verification already pending"})
			return
		}
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "kyc")})
		return
	}

	c.JSON(http.StatusAccepted, record)
}

// GetKYCStatus returns the KYC status for a user
func (h *OnRampHandler) GetKYCStatus(c *gin.Context) {
	userID := c.Param("userId")

	if errs := validation.ValidateUserIDParam(userID); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	status, err := h.onrampService.GetKYCStatus(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: sanitizeError(err, "kyc")})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetKYCRequirements returns the KYC requirements for all levels
func (h *OnRampHandler) GetKYCRequirements(c *gin.Context) {
	requirements := h.onrampService.GetKYCRequirements()
	c.JSON(http.StatusOK, requirements)
}

// RenewKYC renews an expired KYC
func (h *OnRampHandler) RenewKYC(c *gin.Context) {
	var req model.RenewKYCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	record, err := h.onrampService.RenewKYC(req.UserID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrKYCNotFound):
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "KYC record not found. Please submit new KYC."})
		case errors.Is(err, service.ErrKYCNotExpired):
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "KYC is not expired yet"})
		case errors.Is(err, service.ErrKYCRenewalPending):
			c.JSON(http.StatusConflict, ErrorResponse{Error: "KYC renewal already pending"})
		default:
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "kyc")})
		}
		return
	}

	c.JSON(http.StatusAccepted, record)
}

// ========== Supported Assets & Networks (ONRAMP-04) ==========

// GetSupportedAssets returns all supported crypto assets
func (h *OnRampHandler) GetSupportedAssets(c *gin.Context) {
	rm := h.onrampService.GetRateManager()
	c.JSON(http.StatusOK, model.SupportedAssetsResponse{Assets: rm.GetSupportedAssets()})
}

// GetSupportedChains returns all supported blockchain networks
func (h *OnRampHandler) GetSupportedChains(c *gin.Context) {
	rm := h.onrampService.GetRateManager()
	c.JSON(http.StatusOK, model.SupportedChainsResponse{Chains: rm.GetSupportedChains()})
}

// GetSupportedFiats returns all supported fiat currencies
func (h *OnRampHandler) GetSupportedFiats(c *gin.Context) {
	rm := h.onrampService.GetRateManager()
	c.JSON(http.StatusOK, model.SupportedFiatsResponse{Fiats: rm.GetSupportedFiats()})
}

// GetTradingPairs returns all supported trading pairs
func (h *OnRampHandler) GetTradingPairs(c *gin.Context) {
	rm := h.onrampService.GetRateManager()
	c.JSON(http.StatusOK, model.TradingPairsResponse{Pairs: rm.GetTradingPairs()})
}

// ========== Exchange Rates & Fees (ONRAMP-05) ==========

// GetRates returns all exchange rates
func (h *OnRampHandler) GetRates(c *gin.Context) {
	rm := h.onrampService.GetRateManager()
	c.JSON(http.StatusOK, model.RatesResponse{Rates: rm.GetAllRates()})
}

// GetFees returns all fee structures
func (h *OnRampHandler) GetFees(c *gin.Context) {
	rm := h.onrampService.GetRateManager()
	c.JSON(http.StatusOK, model.FeesResponse{Fees: rm.GetAllFees()})
}

// ========== Wallet Validation (ONRAMP-06) ==========

// ValidateWallet validates a wallet address for a specific chain
func (h *OnRampHandler) ValidateWallet(c *gin.Context) {
	var req service.ValidateWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	if req.Address == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Address is required"})
		return
	}

	result := h.onrampService.ValidateWallet(&req)
	c.JSON(http.StatusOK, result)
}

// ========== Webhook Handlers ==========

// PGWebhookPayload represents the payload from PG webhook
type PGWebhookPayload struct {
	EventType string `json:"eventType"`
	Data      struct {
		ID      string `json:"id"`
		OrderID string `json:"orderId"`
		Status  string `json:"status"`
	} `json:"data"`
}

// HandlePGWebhook handles webhook from PG simulator
func (h *OnRampHandler) HandlePGWebhook(c *gin.Context) {
	// Read body for signature verification
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Failed to read request body"})
		return
	}

	// Verify signature
	signature := c.GetHeader("X-Webhook-Signature")
	if signature != "" && !h.onrampService.VerifyWebhookSignature(body, signature) {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "Invalid signature"})
		return
	}

	var payload PGWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		// Since we already read the body, we need to unmarshal manually
		// Re-bind is possible because Gin stores the body
	}
	// Manual unmarshal since body was read
	if err := unmarshalJSON(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid payload format"})
		return
	}

	if payload.Data.OrderID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Missing order ID in payload"})
		return
	}

	if err := h.onrampService.HandlePaymentWebhook(payload.Data.OrderID, payload.Data.ID, payload.EventType); err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: sanitizeError(err, "order")})
		return
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}

// ========== Helper Functions ==========

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// sanitizeError returns a user-safe error message without exposing internal details
func sanitizeError(err error, resourceType string) string {
	errMsg := err.Error()

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

// unmarshalJSON is a helper to unmarshal JSON
func unmarshalJSON(data []byte, v any) error {
	return json.Unmarshal(data, v)
}
