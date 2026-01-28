package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/model"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/service"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/validation"
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
			accounts.POST("/:accountNo/deposit", h.Deposit)
			accounts.POST("/:accountNo/withdraw", h.Withdraw)
			accounts.GET("/:accountNo/transactions", h.GetAccountTransactions)
			accounts.POST("/:accountNo/close", h.CloseAccount)
		}

		transfers := api.Group("/transfers")
		{
			transfers.POST("", h.CreateTransfer)
			transfers.GET("/:id", h.GetTransfer)
		}

		verify := api.Group("/accounts/verify")
		{
			verify.POST("", h.VerifyAccount)
			verify.POST("/initiate", h.InitiateVerification)
			verify.POST("/complete", h.CompleteVerification)
		}

		debit := api.Group("/debit-requests")
		{
			debit.POST("", h.CreateDebitRequest)
			debit.GET("/:id", h.GetDebitRequest)
			debit.POST("/:id/cancel", h.CancelDebitRequest)
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
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	if errs := validation.ValidateCreateAccountRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	account, err := h.bankService.CreateAccount(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "account")})
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

	if errs := validation.ValidateAccountNoParam(accountNo); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	account, err := h.bankService.GetAccount(accountNo)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: sanitizeError(err, "account")})
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
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request format"})
		return
	}

	if errs := validation.ValidateTransferRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	transfer, err := h.bankService.Transfer(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "transfer")})
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

	if errs := validation.ValidateTransferID(id); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	transfer, err := h.bankService.GetTransfer(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: sanitizeError(err, "transfer")})
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

	if errs := validation.ValidateAccountNoParam(accountNo); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

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

	if errs := validation.ValidateAccountNoParam(accountNo); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	if err := h.bankService.FreezeAccount(accountNo); err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: sanitizeError(err, "account")})
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

	if errs := validation.ValidateAccountNoParam(accountNo); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	if err := h.bankService.UnfreezeAccount(accountNo); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: sanitizeError(err, "account")})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Message: "Account unfrozen"})
}

// Deposit deposits funds into an account
// @Summary Deposit funds
// @Description Deposit funds into a bank account
// @Tags accounts
// @Accept json
// @Produce json
// @Param accountNo path string true "Account Number"
// @Param request body model.DepositRequest true "Deposit request"
// @Success 200 {object} model.Transaction
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/accounts/{accountNo}/deposit [post]
func (h *BankHandler) Deposit(c *gin.Context) {
	accountNo := c.Param("accountNo")

	if errs := validation.ValidateAccountNoParam(accountNo); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	var req model.DepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_request"})
		return
	}

	if errs := validation.ValidateDepositRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_amount", "details": errs.Errors})
		return
	}

	txn, err := h.bankService.Deposit(accountNo, &req)
	if err != nil {
		status, errCode := mapServiceError(err)
		c.JSON(status, ErrorResponse{Error: errCode})
		return
	}

	c.JSON(http.StatusOK, txn)
}

// Withdraw withdraws funds from an account
// @Summary Withdraw funds
// @Description Withdraw funds from a bank account
// @Tags accounts
// @Accept json
// @Produce json
// @Param accountNo path string true "Account Number"
// @Param request body model.WithdrawRequest true "Withdraw request"
// @Success 200 {object} model.Transaction
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/accounts/{accountNo}/withdraw [post]
func (h *BankHandler) Withdraw(c *gin.Context) {
	accountNo := c.Param("accountNo")

	if errs := validation.ValidateAccountNoParam(accountNo); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	var req model.WithdrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_request"})
		return
	}

	if errs := validation.ValidateWithdrawRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_amount", "details": errs.Errors})
		return
	}

	txn, err := h.bankService.Withdraw(accountNo, &req)
	if err != nil {
		status, errCode := mapServiceError(err)
		c.JSON(status, ErrorResponse{Error: errCode})
		return
	}

	c.JSON(http.StatusOK, txn)
}

// GetAccountTransactions returns filtered, paginated transactions for an account
func (h *BankHandler) GetAccountTransactions(c *gin.Context) {
	accountNo := c.Param("accountNo")

	if errs := validation.ValidateAccountNoParam(accountNo); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	query := &model.TransactionQuery{
		AccountNo: accountNo,
		Type:      c.Query("type"),
		FromDate:  c.Query("fromDate"),
		ToDate:    c.Query("toDate"),
		Limit:     limit,
		Cursor:    c.Query("cursor"),
		Order:     c.DefaultQuery("order", "desc"),
	}

	result, err := h.bankService.QueryTransactions(query)
	if err != nil {
		if err == service.ErrInvalidDateFormat {
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_date_format"})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal_error"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// CloseAccount closes a bank account
func (h *BankHandler) CloseAccount(c *gin.Context) {
	accountNo := c.Param("accountNo")

	if errs := validation.ValidateAccountNoParam(accountNo); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	var req model.CloseAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body (default reason/force)
		req = model.CloseAccountRequest{}
	}

	resp, err := h.bankService.CloseAccount(accountNo, &req)
	if err != nil {
		switch err {
		case service.ErrAccountNotFound:
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "account_not_found"})
		case service.ErrAlreadyClosed:
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "already_closed"})
		case service.ErrBalanceRemaining:
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "balance_remaining"})
		default:
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal_error"})
		}
		return
	}

	c.JSON(http.StatusOK, resp)
}

// VerifyAccount verifies account holder name
// @Summary Verify account holder
// @Description Verify account number and holder name match
// @Tags verification
// @Accept json
// @Produce json
// @Param request body model.VerifyAccountRequest true "Verify request"
// @Success 200 {object} model.VerifyAccountResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/accounts/verify [post]
func (h *BankHandler) VerifyAccount(c *gin.Context) {
	var req model.VerifyAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_request"})
		return
	}

	if errs := validation.ValidateVerifyAccountRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	resp, err := h.bankService.VerifyAccount(&req)
	if err != nil {
		status, errCode := mapVerificationError(err)
		c.JSON(status, ErrorResponse{Error: errCode})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// InitiateVerification starts a 1-won verification process
// @Summary Initiate 1-won verification
// @Description Start 1-won verification by depositing 1 won with verification code
// @Tags verification
// @Accept json
// @Produce json
// @Param request body model.InitiateVerificationRequest true "Initiate request"
// @Success 200 {object} model.InitiateVerificationResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/accounts/verify/initiate [post]
func (h *BankHandler) InitiateVerification(c *gin.Context) {
	var req model.InitiateVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_request"})
		return
	}

	if errs := validation.ValidateInitiateVerificationRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	resp, err := h.bankService.InitiateVerification(&req)
	if err != nil {
		status, errCode := mapVerificationError(err)
		c.JSON(status, ErrorResponse{Error: errCode})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// CompleteVerification completes a 1-won verification process
// @Summary Complete 1-won verification
// @Description Complete 1-won verification by providing the code
// @Tags verification
// @Accept json
// @Produce json
// @Param request body model.CompleteVerificationRequest true "Complete request"
// @Success 200 {object} model.CompleteVerificationResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/accounts/verify/complete [post]
func (h *BankHandler) CompleteVerification(c *gin.Context) {
	var req model.CompleteVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_request"})
		return
	}

	if errs := validation.ValidateCompleteVerificationRequest(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	resp, err := h.bankService.CompleteVerification(&req)
	if err != nil {
		status, errCode := mapVerificationError(err)
		c.JSON(status, ErrorResponse{Error: errCode})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// mapVerificationError maps verification errors to HTTP status codes and error codes
func mapVerificationError(err error) (int, string) {
	switch err {
	case service.ErrAccountNotFound:
		return http.StatusNotFound, "account_not_found"
	case service.ErrAccountUnavailable:
		return http.StatusBadRequest, "account_unavailable"
	case service.ErrVerificationNotFound:
		return http.StatusNotFound, "verification_not_found"
	case service.ErrVerificationExpired:
		return http.StatusBadRequest, "verification_expired"
	case service.ErrMaxAttemptsExceeded:
		return http.StatusBadRequest, "max_attempts_exceeded"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

// CreateDebitRequest creates a new direct debit request
// @Summary Create a direct debit request
// @Description Create a direct debit request to withdraw funds from an account
// @Tags debit-requests
// @Accept json
// @Produce json
// @Param request body model.CreateDebitRequestInput true "Debit request"
// @Success 202 {object} model.DebitRequest
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/debit-requests [post]
func (h *BankHandler) CreateDebitRequest(c *gin.Context) {
	var req model.CreateDebitRequestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_request"})
		return
	}

	if errs := validation.ValidateCreateDebitRequestInput(&req); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	resp, err := h.bankService.CreateDebitRequest(&req)
	if err != nil {
		status, errCode := mapDebitError(err)
		c.JSON(status, ErrorResponse{Error: errCode})
		return
	}

	c.JSON(http.StatusAccepted, resp)
}

// GetDebitRequest returns a debit request by ID
// @Summary Get a debit request
// @Description Get debit request details by ID
// @Tags debit-requests
// @Produce json
// @Param id path string true "Debit Request ID"
// @Success 200 {object} model.DebitRequest
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/debit-requests/{id} [get]
func (h *BankHandler) GetDebitRequest(c *gin.Context) {
	id := c.Param("id")

	if errs := validation.ValidateDebitRequestID(id); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	resp, err := h.bankService.GetDebitRequest(id)
	if err != nil {
		status, errCode := mapDebitError(err)
		c.JSON(status, ErrorResponse{Error: errCode})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// CancelDebitRequest cancels a pending debit request
// @Summary Cancel a debit request
// @Description Cancel a pending debit request
// @Tags debit-requests
// @Produce json
// @Param id path string true "Debit Request ID"
// @Success 200 {object} model.CancelDebitRequestResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/debit-requests/{id}/cancel [post]
func (h *BankHandler) CancelDebitRequest(c *gin.Context) {
	id := c.Param("id")

	if errs := validation.ValidateDebitRequestID(id); errs.HasErrors() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errs.Errors})
		return
	}

	resp, err := h.bankService.CancelDebitRequest(id)
	if err != nil {
		status, errCode := mapDebitError(err)
		c.JSON(status, ErrorResponse{Error: errCode})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// mapDebitError maps debit request errors to HTTP status codes and error codes
func mapDebitError(err error) (int, string) {
	switch err {
	case service.ErrAccountNotFound:
		return http.StatusNotFound, "account_not_found"
	case service.ErrAccountUnavailable:
		return http.StatusBadRequest, "account_unavailable"
	case service.ErrInvalidAmount:
		return http.StatusBadRequest, "invalid_amount"
	case service.ErrDebitNotFound:
		return http.StatusNotFound, "not_found"
	case service.ErrDebitInvalidStatus:
		return http.StatusBadRequest, "invalid_status"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

// mapServiceError maps service errors to HTTP status codes and error codes
func mapServiceError(err error) (int, string) {
	switch err {
	case service.ErrAccountNotFound:
		return http.StatusNotFound, "account_not_found"
	case service.ErrAccountFrozen:
		return http.StatusBadRequest, "account_frozen"
	case service.ErrAccountClosed:
		return http.StatusBadRequest, "account_closed"
	case service.ErrInvalidAmount:
		return http.StatusBadRequest, "invalid_amount"
	case service.ErrInsufficientBalance:
		return http.StatusBadRequest, "insufficient_balance"
	case service.ErrAlreadyClosed:
		return http.StatusBadRequest, "already_closed"
	case service.ErrBalanceRemaining:
		return http.StatusBadRequest, "balance_remaining"
	case service.ErrInvalidDateFormat:
		return http.StatusBadRequest, "invalid_date_format"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Message string `json:"message"`
}

// sanitizeError returns a user-safe error message without exposing internal details
// This prevents information leakage about resource existence
func sanitizeError(err error, resourceType string) string {
	errMsg := err.Error()

	// Map specific error patterns to generic messages
	switch {
	case contains(errMsg, "not found"):
		return "The requested " + resourceType + " could not be processed"
	case contains(errMsg, "insufficient balance"):
		return "Transaction could not be completed"
	case contains(errMsg, "not active"), contains(errMsg, "frozen"):
		return "Account is not available for this operation"
	case contains(errMsg, "invalid"):
		return "Invalid request parameters"
	default:
		return "An error occurred processing your request"
	}
}

// contains checks if s contains substr (case-insensitive helper)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
