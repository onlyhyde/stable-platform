package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/stablenet/stable-platform/services/order-router/internal/model"
	"github.com/stablenet/stable-platform/services/order-router/internal/service"
)

// RouterHandler handles HTTP requests for the router service
type RouterHandler struct {
	service *service.RouterService
}

// NewRouterHandler creates a new router handler
func NewRouterHandler(svc *service.RouterService) *RouterHandler {
	return &RouterHandler{
		service: svc,
	}
}

// RegisterRoutes registers all routes
func (h *RouterHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		api.GET("/quote", h.GetQuote)
		api.GET("/quote/split", h.GetSplitQuote)
		api.POST("/swap", h.BuildSwap)
		api.GET("/protocols", h.GetProtocols)
	}

	// Health check
	r.GET("/health", h.Health)
}

// GetQuote returns the best quote for a swap
// GET /api/v1/quote?tokenIn=0x...&tokenOut=0x...&amountIn=1000000&slippage=50
func (h *RouterHandler) GetQuote(c *gin.Context) {
	req := &model.QuoteRequest{
		TokenIn:  c.Query("tokenIn"),
		TokenOut: c.Query("tokenOut"),
		AmountIn: c.Query("amountIn"),
	}

	// Parse optional parameters
	if slippage := c.Query("slippage"); slippage != "" {
		if s, err := strconv.ParseFloat(slippage, 64); err == nil {
			req.Slippage = s
		}
	}

	if maxHops := c.Query("maxHops"); maxHops != "" {
		if h, err := strconv.Atoi(maxHops); err == nil {
			req.MaxHops = h
		}
	}

	// Parse protocols filter
	if protocols := c.QueryArray("protocols"); len(protocols) > 0 {
		req.Protocols = protocols
	}

	// Parse excluded DEXs
	if exclude := c.QueryArray("excludeDEXs"); len(exclude) > 0 {
		req.ExcludeDEXs = exclude
	}

	quote, err := h.service.GetQuote(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "failed to get quote",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, quote)
}

// GetSplitQuote returns a quote with split routing
// GET /api/v1/quote/split?tokenIn=0x...&tokenOut=0x...&amountIn=1000000&maxSplits=3
func (h *RouterHandler) GetSplitQuote(c *gin.Context) {
	req := &model.QuoteRequest{
		TokenIn:  c.Query("tokenIn"),
		TokenOut: c.Query("tokenOut"),
		AmountIn: c.Query("amountIn"),
	}

	// Parse optional parameters
	if slippage := c.Query("slippage"); slippage != "" {
		if s, err := strconv.ParseFloat(slippage, 64); err == nil {
			req.Slippage = s
		}
	}

	if maxSplits := c.Query("maxSplits"); maxSplits != "" {
		if ms, err := strconv.Atoi(maxSplits); err == nil {
			req.MaxSplits = ms
		}
	}

	// Parse protocols filter
	if protocols := c.QueryArray("protocols"); len(protocols) > 0 {
		req.Protocols = protocols
	}

	quote, err := h.service.GetSplitQuote(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "failed to get split quote",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, quote)
}

// SwapRequest represents the request body for building a swap
type SwapRequest struct {
	TokenIn      string   `json:"tokenIn" binding:"required"`
	TokenOut     string   `json:"tokenOut" binding:"required"`
	AmountIn     string   `json:"amountIn" binding:"required"`
	AmountOutMin string   `json:"amountOutMin" binding:"required"`
	Recipient    string   `json:"recipient" binding:"required"`
	Slippage     float64  `json:"slippage"`
	Deadline     int64    `json:"deadline"`
	Protocols    []string `json:"protocols"`
}

// BuildSwap builds swap calldata for execution
// POST /api/v1/swap
func (h *RouterHandler) BuildSwap(c *gin.Context) {
	var req SwapRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid request",
			"message": err.Error(),
		})
		return
	}

	swapReq := &model.SwapRequest{
		TokenIn:      req.TokenIn,
		TokenOut:     req.TokenOut,
		AmountIn:     req.AmountIn,
		AmountOutMin: req.AmountOutMin,
		Recipient:    req.Recipient,
		Slippage:     req.Slippage,
		Deadline:     req.Deadline,
		Protocols:    req.Protocols,
	}

	swap, err := h.service.BuildSwap(c.Request.Context(), swapReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "failed to build swap",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, swap)
}

// GetProtocols returns the list of supported protocols
// GET /api/v1/protocols
func (h *RouterHandler) GetProtocols(c *gin.Context) {
	protocols := h.service.GetSupportedProtocols()
	c.JSON(http.StatusOK, gin.H{
		"protocols": protocols,
	})
}

// Health returns service health status
func (h *RouterHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "order-router",
	})
}
