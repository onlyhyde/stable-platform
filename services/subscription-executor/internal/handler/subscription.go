package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/stablenet/stable-platform/services/subscription-executor/internal/model"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/service"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/validation"
)

// SubscriptionHandler handles subscription HTTP requests
type SubscriptionHandler struct {
	executorService *service.ExecutorService
}

// NewSubscriptionHandler creates a new subscription handler
func NewSubscriptionHandler(executorService *service.ExecutorService) *SubscriptionHandler {
	return &SubscriptionHandler{
		executorService: executorService,
	}
}

// RegisterRoutes registers the subscription routes
func (h *SubscriptionHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		subscriptions := api.Group("/subscriptions")
		{
			subscriptions.POST("", h.CreateSubscription)
			subscriptions.GET("/:id", h.GetSubscription)
			subscriptions.GET("/account/:account", h.GetSubscriptionsByAccount)
			subscriptions.POST("/:id/cancel", h.CancelSubscription)
			subscriptions.POST("/:id/pause", h.PauseSubscription)
			subscriptions.POST("/:id/resume", h.ResumeSubscription)
		}
	}
}

// CreateSubscription creates a new subscription
// @Summary Create a new subscription
// @Description Create a recurring payment subscription
// @Tags subscriptions
// @Accept json
// @Produce json
// @Param request body model.CreateSubscriptionRequest true "Subscription request"
// @Success 201 {object} model.SubscriptionResponse
// @Failure 400 {object} ErrorResponse
// @Router /api/v1/subscriptions [post]
func (h *SubscriptionHandler) CreateSubscription(c *gin.Context) {
	var req model.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	// Validate Ethereum addresses and amounts
	v := validation.NewValidator()
	v.ValidateEthereumAddress(req.SmartAccount, "smartAccount")
	v.ValidateEthereumAddress(req.Recipient, "recipient")
	v.ValidateEthereumAddress(req.Token, "token")
	v.ValidateAmount(req.Amount, "amount")

	if v.HasErrors() {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: v.Error()})
		return
	}

	sub, err := h.executorService.CreateSubscription(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, sub.ToResponse())
}

// GetSubscription returns a subscription by ID
// @Summary Get a subscription
// @Description Get subscription details by ID
// @Tags subscriptions
// @Produce json
// @Param id path string true "Subscription ID"
// @Success 200 {object} model.SubscriptionResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/subscriptions/{id} [get]
func (h *SubscriptionHandler) GetSubscription(c *gin.Context) {
	id := c.Param("id")

	sub, err := h.executorService.GetSubscription(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, sub.ToResponse())
}

// GetSubscriptionsByAccount returns all subscriptions for an account
// @Summary Get subscriptions by account
// @Description Get all subscriptions for a smart account
// @Tags subscriptions
// @Produce json
// @Param account path string true "Smart account address"
// @Success 200 {array} model.SubscriptionResponse
// @Router /api/v1/subscriptions/account/{account} [get]
func (h *SubscriptionHandler) GetSubscriptionsByAccount(c *gin.Context) {
	account := c.Param("account")

	// Validate Ethereum address
	if !validation.IsValidEthereumAddress(account) {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "account must be a valid Ethereum address"})
		return
	}

	subs, err := h.executorService.GetSubscriptionsByAccount(c.Request.Context(), account)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	var responses []*model.SubscriptionResponse
	for _, sub := range subs {
		responses = append(responses, sub.ToResponse())
	}

	c.JSON(http.StatusOK, responses)
}

// CancelSubscription cancels a subscription
// @Summary Cancel a subscription
// @Description Cancel a recurring payment subscription
// @Tags subscriptions
// @Produce json
// @Param id path string true "Subscription ID"
// @Success 200 {object} SuccessResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/subscriptions/{id}/cancel [post]
func (h *SubscriptionHandler) CancelSubscription(c *gin.Context) {
	id := c.Param("id")

	if err := h.executorService.CancelSubscription(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Message: "Subscription cancelled"})
}

// PauseSubscription pauses a subscription
// @Summary Pause a subscription
// @Description Pause a recurring payment subscription
// @Tags subscriptions
// @Produce json
// @Param id path string true "Subscription ID"
// @Success 200 {object} SuccessResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/subscriptions/{id}/pause [post]
func (h *SubscriptionHandler) PauseSubscription(c *gin.Context) {
	id := c.Param("id")

	if err := h.executorService.PauseSubscription(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Message: "Subscription paused"})
}

// ResumeSubscription resumes a paused subscription
// @Summary Resume a subscription
// @Description Resume a paused subscription
// @Tags subscriptions
// @Produce json
// @Param id path string true "Subscription ID"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/subscriptions/{id}/resume [post]
func (h *SubscriptionHandler) ResumeSubscription(c *gin.Context) {
	id := c.Param("id")

	if err := h.executorService.ResumeSubscription(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Message: "Subscription resumed"})
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Message string `json:"message"`
}
