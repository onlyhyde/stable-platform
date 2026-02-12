package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/stablenet/stable-platform/services/order-router/internal/model"
	"github.com/stablenet/stable-platform/services/order-router/internal/service"
	"github.com/stablenet/stable-platform/services/order-router/internal/validation"
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
	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "order-router",
		})
	})

	api := r.Group("/api/v1")
	{
		api.GET("/quote", h.GetQuote)
		api.GET("/quote/split", h.GetSplitQuote)
		api.POST("/swap", h.BuildSwap)
		api.GET("/protocols", h.GetProtocols)
	}
}

// GetQuote returns the best quote for a swap
// GET /api/v1/quote?tokenIn=0x...&tokenOut=0x...&amountIn=1000000&slippage=50
func (h *RouterHandler) GetQuote(c *gin.Context) {
	tokenIn := c.Query("tokenIn")
	tokenOut := c.Query("tokenOut")
	amountIn := c.Query("amountIn")

	// Validate required parameters
	v := validation.NewValidator()
	v.ValidateEthereumAddress(tokenIn, "tokenIn")
	v.ValidateEthereumAddress(tokenOut, "tokenOut")
	v.ValidateAmount(amountIn, "amountIn")

	if v.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"message": v.Error(),
		})
		return
	}

	req := &model.QuoteRequest{
		TokenIn:  tokenIn,
		TokenOut: tokenOut,
		AmountIn: amountIn,
	}

	// Parse optional parameters
	if slippage := c.Query("slippage"); slippage != "" {
		if s, err := strconv.ParseFloat(slippage, 64); err == nil {
			if !validation.IsValidSlippage(s) {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "validation failed",
					"message": "slippage must be between 0 and 10000 (basis points)",
				})
				return
			}
			req.Slippage = s
		}
	}

	if maxHops := c.Query("maxHops"); maxHops != "" {
		if mh, err := strconv.Atoi(maxHops); err == nil {
			if mh < 1 || mh > 10 {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "validation failed",
					"message": "maxHops must be between 1 and 10",
				})
				return
			}
			req.MaxHops = mh
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
	tokenIn := c.Query("tokenIn")
	tokenOut := c.Query("tokenOut")
	amountIn := c.Query("amountIn")

	// Validate required parameters
	v := validation.NewValidator()
	v.ValidateEthereumAddress(tokenIn, "tokenIn")
	v.ValidateEthereumAddress(tokenOut, "tokenOut")
	v.ValidateAmount(amountIn, "amountIn")

	if v.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"message": v.Error(),
		})
		return
	}

	req := &model.QuoteRequest{
		TokenIn:  tokenIn,
		TokenOut: tokenOut,
		AmountIn: amountIn,
	}

	// Parse optional parameters
	if slippage := c.Query("slippage"); slippage != "" {
		if s, err := strconv.ParseFloat(slippage, 64); err == nil {
			if !validation.IsValidSlippage(s) {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "validation failed",
					"message": "slippage must be between 0 and 10000 (basis points)",
				})
				return
			}
			req.Slippage = s
		}
	}

	if maxSplits := c.Query("maxSplits"); maxSplits != "" {
		if ms, err := strconv.Atoi(maxSplits); err == nil {
			if ms < 1 || ms > 10 {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "validation failed",
					"message": "maxSplits must be between 1 and 10",
				})
				return
			}
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

	// Validate Ethereum addresses and amounts
	v := validation.NewValidator()
	v.ValidateEthereumAddress(req.TokenIn, "tokenIn")
	v.ValidateEthereumAddress(req.TokenOut, "tokenOut")
	v.ValidateEthereumAddress(req.Recipient, "recipient")
	v.ValidateAmount(req.AmountIn, "amountIn")
	v.ValidateAmountOrZero(req.AmountOutMin, "amountOutMin")

	if v.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"message": v.Error(),
		})
		return
	}

	// Validate optional slippage if provided
	if req.Slippage != 0 && !validation.IsValidSlippage(req.Slippage) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"message": "slippage must be between 0 and 10000 (basis points)",
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

// Health check endpoints are now registered in main.go with unified format
