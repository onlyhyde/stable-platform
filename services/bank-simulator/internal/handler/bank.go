package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/model"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/service"
)

// BankHandler handles bank HTTP requests
type BankHandler struct {
	bankService *service.BankService
}

// NewBankHandler creates a new bank handler
func NewBankHandler(bankService *service.BankService) *BankHandler {
	return &BankHandler{
		bankService: bankService,
	}
}

// RegisterRoutes registers the bank routes
func (h *BankHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		accounts := api.Group("/accounts")
		{
			accounts.POST("", h.CreateAccount)
			accounts.GET("", h.GetAllAccounts)
			accounts.GET("/:accountNo", h.GetAccount)
			accounts.POST("/:accountNo/freeze", h.FreezeAccount)
			accounts.POST("/:accountNo/unfreeze", h.UnfreezeAccount)
			accounts.GET("/:accountNo/transfers", h.GetAccountTransfers)
		}

		transfers := api.Group("/transfers")
		{
			transfers.POST("", h.CreateTransfer)
			transfers.GET("/:id", h.GetTransfer)
		}
	}
}

// CreateAccount creates a new bank account
// @Summary Create a new bank account
// @Description Create a simulated bank account
// @Tags accounts
// @Accept json
// @Produce json
// @Param request body model.CreateAccountRequest true "Account request"
// @Success 201 {object} model.Account
// @Failure 400 {object} ErrorResponse
// @Router /api/v1/accounts [post]
func (h *BankHandler) CreateAccount(c *gin.Context) {
	var req model.CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	account, err := h.bankService.CreateAccount(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, account)
}

// GetAccount returns an account by account number
// @Summary Get a bank account
// @Description Get bank account details by account number
// @Tags accounts
// @Produce json
// @Param accountNo path string true "Account Number"
// @Success 200 {object} model.Account
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/accounts/{accountNo} [get]
func (h *BankHandler) GetAccount(c *gin.Context) {
	accountNo := c.Param("accountNo")

	account, err := h.bankService.GetAccount(accountNo)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, account)
}

// GetAllAccounts returns all accounts
// @Summary Get all bank accounts
// @Description Get all simulated bank accounts
// @Tags accounts
// @Produce json
// @Success 200 {array} model.Account
// @Router /api/v1/accounts [get]
func (h *BankHandler) GetAllAccounts(c *gin.Context) {
	accounts := h.bankService.GetAllAccounts()
	c.JSON(http.StatusOK, accounts)
}

// CreateTransfer creates a new transfer
// @Summary Create a transfer
// @Description Transfer funds between accounts
// @Tags transfers
// @Accept json
// @Produce json
// @Param request body model.TransferRequest true "Transfer request"
// @Success 201 {object} model.Transfer
// @Failure 400 {object} ErrorResponse
// @Router /api/v1/transfers [post]
func (h *BankHandler) CreateTransfer(c *gin.Context) {
	var req model.TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	transfer, err := h.bankService.Transfer(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, transfer)
}

// GetTransfer returns a transfer by ID
// @Summary Get a transfer
// @Description Get transfer details by ID
// @Tags transfers
// @Produce json
// @Param id path string true "Transfer ID"
// @Success 200 {object} model.Transfer
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/transfers/{id} [get]
func (h *BankHandler) GetTransfer(c *gin.Context) {
	id := c.Param("id")

	transfer, err := h.bankService.GetTransfer(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, transfer)
}

// GetAccountTransfers returns all transfers for an account
// @Summary Get account transfers
// @Description Get all transfers for a bank account
// @Tags accounts
// @Produce json
// @Param accountNo path string true "Account Number"
// @Success 200 {array} model.Transfer
// @Router /api/v1/accounts/{accountNo}/transfers [get]
func (h *BankHandler) GetAccountTransfers(c *gin.Context) {
	accountNo := c.Param("accountNo")
	transfers := h.bankService.GetTransfersByAccount(accountNo)
	c.JSON(http.StatusOK, transfers)
}

// FreezeAccount freezes an account
// @Summary Freeze an account
// @Description Freeze a bank account to prevent transactions
// @Tags accounts
// @Produce json
// @Param accountNo path string true "Account Number"
// @Success 200 {object} SuccessResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/accounts/{accountNo}/freeze [post]
func (h *BankHandler) FreezeAccount(c *gin.Context) {
	accountNo := c.Param("accountNo")

	if err := h.bankService.FreezeAccount(accountNo); err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Message: "Account frozen"})
}

// UnfreezeAccount unfreezes an account
// @Summary Unfreeze an account
// @Description Unfreeze a frozen bank account
// @Tags accounts
// @Produce json
// @Param accountNo path string true "Account Number"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/accounts/{accountNo}/unfreeze [post]
func (h *BankHandler) UnfreezeAccount(c *gin.Context) {
	accountNo := c.Param("accountNo")

	if err := h.bankService.UnfreezeAccount(accountNo); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Message: "Account unfrozen"})
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Message string `json:"message"`
}
