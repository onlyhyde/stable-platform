package service

import (
	"bytes"
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"math/rand"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/model"
)

// Error definitions
var (
	ErrKYCAlreadyPending        = errors.New("KYC verification already pending")
	ErrKYCNotFound              = errors.New("KYC record not found")
	ErrKYCNotExpired            = errors.New("KYC is not expired")
	ErrKYCRenewalPending        = errors.New("KYC renewal already pending")
	ErrExceedsTransactionLimit  = errors.New("amount exceeds per-transaction limit")
	ErrExceedsDailyLimit        = errors.New("amount exceeds daily limit")
	ErrExceedsMonthlyLimit      = errors.New("amount exceeds monthly limit")
	ErrBankAccountRequired      = errors.New("bank account information required for bank transfer")
	ErrUnsupportedPaymentMethod = errors.New("unsupported payment method")
	ErrUnsupportedAsset         = errors.New("unsupported crypto asset")
	ErrUnsupportedChain         = errors.New("asset not supported on specified chain")
	ErrUnsupportedFiat          = errors.New("unsupported fiat currency")
	ErrUnsupportedTradingPair   = errors.New("unsupported trading pair")
	ErrInvalidWalletAddress     = errors.New("invalid wallet address format")
)

// OnRampService handles onramp operations
type OnRampService struct {
	cfg         *config.Config
	orders      map[string]*model.Order     // orderID -> Order
	kycRecords  map[string]*model.KYCRecord // userID -> KYCRecord
	rateManager *RateManager
	mu          sync.RWMutex
	rng         *rand.Rand
	pgClient    *PGClient
	bankClient  *BankClient
}

// NewOnRampService creates a new onramp service
func NewOnRampService(cfg *config.Config) *OnRampService {
	return &OnRampService{
		cfg:         cfg,
		orders:      make(map[string]*model.Order),
		kycRecords:  make(map[string]*model.KYCRecord),
		rateManager: NewRateManager(),
		rng:         rand.New(rand.NewSource(time.Now().UnixNano())),
		pgClient:    NewPGClient(cfg.PGSimulatorURL),
		bankClient:  NewBankClient(cfg.BankSimulatorURL),
	}
}

// GetRateManager returns the rate manager (for handler access)
func (s *OnRampService) GetRateManager() *RateManager {
	return s.rateManager
}

// ValidateWallet validates a wallet address for a specific chain
func (s *OnRampService) ValidateWallet(req *ValidateWalletRequest) *WalletValidationResult {
	// 1. Check if chain is supported
	chain := s.rateManager.GetChainByID(req.ChainID)
	if chain == nil {
		return &WalletValidationResult{
			Valid:   false,
			Address: req.Address,
			ChainID: req.ChainID,
			Error:   "unsupported chain",
		}
	}

	// 2. Validate EVM address format (all supported chains are EVM compatible)
	valid, checksumAddress, warnings := ValidateEVMAddress(req.Address)

	if !valid {
		return &WalletValidationResult{
			Valid:     false,
			Address:   req.Address,
			ChainID:   req.ChainID,
			ChainName: chain.Name,
			Error:     "invalid wallet address format",
		}
	}

	return &WalletValidationResult{
		Valid:           true,
		Address:         req.Address,
		ChecksumAddress: checksumAddress,
		ChainID:         req.ChainID,
		ChainName:       chain.Name,
		Warnings:        warnings,
	}
}

// ========== KYC Operations ==========

// SubmitKYC submits a new KYC verification request
func (s *OnRampService) SubmitKYC(req *model.SubmitKYCRequest) (*model.KYCRecord, error) {
	s.mu.RLock()
	existing, exists := s.kycRecords[req.UserID]
	s.mu.RUnlock()

	if exists && existing.Status == model.KYCStatusPending {
		return nil, ErrKYCAlreadyPending
	}

	now := time.Now()
	record := &model.KYCRecord{
		ID:        uuid.New().String(),
		UserID:    req.UserID,
		Level:     req.Level,
		Status:    model.KYCStatusPending,
		Documents: &req.Documents,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.mu.Lock()
	s.kycRecords[req.UserID] = record
	s.mu.Unlock()

	log.Printf("KYC submitted: %s (User: %s, Level: %s)", record.ID, maskUserID(record.UserID), record.Level)

	// Create copy for async processing
	recordCopy := *record
	go s.processKYCVerification(&recordCopy)

	return record, nil
}

// processKYCVerification simulates KYC verification processing
func (s *OnRampService) processKYCVerification(record *model.KYCRecord) {
	delay := time.Duration(s.cfg.KYCProcessingTime) * time.Second
	time.Sleep(delay)

	s.mu.Lock()
	defer s.mu.Unlock()

	// Get the actual record from the map
	actualRecord, exists := s.kycRecords[record.UserID]
	if !exists || actualRecord.ID != record.ID {
		return
	}

	now := time.Now()

	if s.rng.Intn(100) < s.cfg.KYCSuccessRate {
		actualRecord.Status = model.KYCStatusApproved
		actualRecord.ApprovedAt = &now
		expiresAt := now.AddDate(1, 0, 0) // 1 year expiration
		actualRecord.ExpiresAt = &expiresAt

		log.Printf("KYC approved: %s (User: %s)", actualRecord.ID, maskUserID(actualRecord.UserID))

		recordCopy := *actualRecord
		go s.sendWebhook("kyc.approved", &recordCopy)
	} else {
		actualRecord.Status = model.KYCStatusRejected
		actualRecord.RejectedReason = s.getRandomRejectionReason()

		log.Printf("KYC rejected: %s (User: %s, Reason: %s)", actualRecord.ID, maskUserID(actualRecord.UserID), actualRecord.RejectedReason)

		recordCopy := *actualRecord
		go s.sendWebhook("kyc.rejected", &recordCopy)
	}

	actualRecord.UpdatedAt = now
}

// RenewKYC renews an expired KYC
func (s *OnRampService) RenewKYC(userID string) (*model.KYCRecord, error) {
	s.mu.RLock()
	existing, exists := s.kycRecords[userID]
	s.mu.RUnlock()

	if !exists {
		return nil, ErrKYCNotFound
	}

	if existing.Status == model.KYCStatusPending {
		return nil, ErrKYCRenewalPending
	}

	if existing.Status == model.KYCStatusApproved {
		if existing.ExpiresAt != nil && time.Now().Before(*existing.ExpiresAt) {
			return nil, ErrKYCNotExpired
		}
	}

	now := time.Now()
	record := &model.KYCRecord{
		ID:        uuid.New().String(),
		UserID:    userID,
		Level:     existing.Level,
		Status:    model.KYCStatusPending,
		Documents: existing.Documents, // Reuse existing documents
		RenewalOf: existing.ID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.mu.Lock()
	s.kycRecords[userID] = record
	s.mu.Unlock()

	log.Printf("KYC renewal submitted: %s (User: %s, PreviousKYC: %s)", record.ID, maskUserID(record.UserID), existing.ID)

	recordCopy := *record
	go s.processKYCRenewal(&recordCopy)

	return record, nil
}

// processKYCRenewal processes KYC renewal (faster than new submission)
func (s *OnRampService) processKYCRenewal(record *model.KYCRecord) {
	delay := time.Duration(s.cfg.KYCProcessingTime/2) * time.Second
	if delay < time.Second {
		delay = time.Second
	}
	time.Sleep(delay)

	s.mu.Lock()
	defer s.mu.Unlock()

	actualRecord, exists := s.kycRecords[record.UserID]
	if !exists || actualRecord.ID != record.ID {
		return
	}

	now := time.Now()

	// Renewal has higher success rate (95%)
	if s.rng.Intn(100) < 95 {
		actualRecord.Status = model.KYCStatusApproved
		actualRecord.ApprovedAt = &now
		expiresAt := now.AddDate(1, 0, 0)
		actualRecord.ExpiresAt = &expiresAt

		log.Printf("KYC renewed: %s (User: %s)", actualRecord.ID, maskUserID(actualRecord.UserID))

		recordCopy := *actualRecord
		go s.sendWebhook("kyc.renewed", &recordCopy)
	} else {
		actualRecord.Status = model.KYCStatusRejected
		actualRecord.RejectedReason = "renewal_document_review_required"

		log.Printf("KYC renewal rejected: %s (User: %s)", actualRecord.ID, maskUserID(actualRecord.UserID))

		recordCopy := *actualRecord
		go s.sendWebhook("kyc.renewal_rejected", &recordCopy)
	}

	actualRecord.UpdatedAt = now
}

// GetKYCStatus returns the KYC status for a user
func (s *OnRampService) GetKYCStatus(userID string) (*model.KYCStatusResponse, error) {
	s.mu.RLock()
	record, exists := s.kycRecords[userID]
	s.mu.RUnlock()

	if !exists {
		return &model.KYCStatusResponse{
			UserID: userID,
			Level:  model.KYCLevelNone,
			Status: model.KYCStatusNone,
			Limits: model.KYCLevelLimits[model.KYCLevelNone],
		}, nil
	}

	// Check expiration
	if record.Status == model.KYCStatusApproved && record.ExpiresAt != nil {
		if time.Now().After(*record.ExpiresAt) {
			s.mu.Lock()
			record.Status = model.KYCStatusExpired
			record.UpdatedAt = time.Now()
			s.mu.Unlock()
		}
	}

	usage := s.calculateKYCUsage(userID)

	return &model.KYCStatusResponse{
		UserID:     userID,
		Level:      record.Level,
		Status:     record.Status,
		Limits:     model.KYCLevelLimits[record.Level],
		Usage:      usage,
		ApprovedAt: record.ApprovedAt,
		ExpiresAt:  record.ExpiresAt,
	}, nil
}

// GetKYCRequirements returns the KYC requirements for all levels
func (s *OnRampService) GetKYCRequirements() *model.KYCRequirementsResponse {
	return &model.KYCRequirementsResponse{
		Levels: map[model.KYCLevel]model.KYCLevelRequirements{
			model.KYCLevelNone: {
				Limits:       model.KYCLevelLimits[model.KYCLevelNone],
				Requirements: []string{},
			},
			model.KYCLevelBasic: {
				Limits: model.KYCLevelLimits[model.KYCLevelBasic],
				Requirements: []string{
					"id_document",
					"full_name",
					"date_of_birth",
					"address",
				},
			},
			model.KYCLevelAdvanced: {
				Limits: model.KYCLevelLimits[model.KYCLevelAdvanced],
				Requirements: []string{
					"id_document",
					"full_name",
					"date_of_birth",
					"address",
					"proof_of_address",
					"selfie_with_id",
					"source_of_funds",
				},
			},
		},
	}
}

// calculateKYCUsage calculates the usage for a user
func (s *OnRampService) calculateKYCUsage(userID string) *model.KYCUsage {
	var dailyUsed, monthlyUsed big.Float

	now := time.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, order := range s.orders {
		if order.UserID != userID {
			continue
		}
		if order.Status != model.OrderStatusCompleted && order.Status != model.OrderStatusProcessing {
			continue
		}

		amount, _, _ := big.ParseFloat(order.FiatAmount, 10, 128, big.ToNearestEven)
		if amount == nil {
			continue
		}

		if order.CreatedAt.After(dayStart) {
			dailyUsed.Add(&dailyUsed, amount)
		}
		if order.CreatedAt.After(monthStart) {
			monthlyUsed.Add(&monthlyUsed, amount)
		}
	}

	return &model.KYCUsage{
		DailyUsed:   dailyUsed.Text('f', 2),
		MonthlyUsed: monthlyUsed.Text('f', 2),
	}
}

// checkLimits checks if the order amount is within KYC limits
func (s *OnRampService) checkLimits(kyc *model.KYCStatusResponse, amount string) error {
	amountVal, _, _ := big.ParseFloat(amount, 10, 128, big.ToNearestEven)
	if amountVal == nil {
		return fmt.Errorf("invalid amount: %s", amount)
	}

	perTxLimit, _, _ := big.ParseFloat(kyc.Limits.PerTransaction, 10, 128, big.ToNearestEven)
	dailyLimit, _, _ := big.ParseFloat(kyc.Limits.Daily, 10, 128, big.ToNearestEven)
	monthlyLimit, _, _ := big.ParseFloat(kyc.Limits.Monthly, 10, 128, big.ToNearestEven)

	if kyc.Usage != nil {
		dailyUsed, _, _ := big.ParseFloat(kyc.Usage.DailyUsed, 10, 128, big.ToNearestEven)
		monthlyUsed, _, _ := big.ParseFloat(kyc.Usage.MonthlyUsed, 10, 128, big.ToNearestEven)

		if dailyUsed != nil && dailyLimit != nil {
			newDailyTotal := new(big.Float).Add(dailyUsed, amountVal)
			if newDailyTotal.Cmp(dailyLimit) > 0 {
				return ErrExceedsDailyLimit
			}
		}

		if monthlyUsed != nil && monthlyLimit != nil {
			newMonthlyTotal := new(big.Float).Add(monthlyUsed, amountVal)
			if newMonthlyTotal.Cmp(monthlyLimit) > 0 {
				return ErrExceedsMonthlyLimit
			}
		}
	}

	if perTxLimit != nil && amountVal.Cmp(perTxLimit) > 0 {
		return ErrExceedsTransactionLimit
	}

	return nil
}

// getRandomRejectionReason returns a random KYC rejection reason
func (s *OnRampService) getRandomRejectionReason() string {
	reasons := []string{
		"document_unclear",
		"document_expired",
		"information_mismatch",
		"suspicious_activity",
		"unsupported_country",
	}
	return reasons[s.rng.Intn(len(reasons))]
}

// ========== Order Operations ==========

// GetQuote returns a price quote for fiat to crypto conversion
func (s *OnRampService) GetQuote(req *model.QuoteRequest) (*model.QuoteResponse, error) {
	// Validate trading pair via RateManager
	if err := s.rateManager.ValidateTradingPair(req.FiatCurrency, req.CryptoCurrency); err != nil {
		return nil, err
	}

	// Parse fiat amount
	fiatAmount, ok := new(big.Float).SetString(req.FiatAmount)
	if !ok {
		return nil, fmt.Errorf("invalid fiat amount: %s", req.FiatAmount)
	}

	// Get exchange rate from RateManager
	rate, err := s.rateManager.GetRate(req.FiatCurrency, req.CryptoCurrency)
	if err != nil {
		return nil, err
	}

	// Get fee percentage from RateManager
	feePercentStr, err := s.rateManager.GetFeePercent(req.FiatCurrency, req.CryptoCurrency)
	if err != nil {
		feePercentStr = "1.5" // fallback
	}

	// Calculate fee
	feeRate, _ := new(big.Float).SetString(feePercentStr)
	feeRate = new(big.Float).Quo(feeRate, big.NewFloat(100))
	fee := new(big.Float).Mul(fiatAmount, feeRate)

	// Calculate crypto amount: (fiatAmount - fee) * exchangeRate
	netAmount := new(big.Float).Sub(fiatAmount, fee)
	cryptoAmount := new(big.Float).Mul(netAmount, rate)

	// Quote expires in 5 minutes
	expiresAt := time.Now().Add(5 * time.Minute)

	return &model.QuoteResponse{
		FiatAmount:     req.FiatAmount,
		FiatCurrency:   req.FiatCurrency,
		CryptoAmount:   cryptoAmount.Text('f', 6),
		CryptoCurrency: req.CryptoCurrency,
		ExchangeRate:   rate.Text('f', 8),
		Fee:            fee.Text('f', 2),
		FeePercent:     feePercentStr,
		ExpiresAt:      expiresAt.Format(time.RFC3339),
	}, nil
}

// CreateOrder creates a new purchase order
func (s *OnRampService) CreateOrder(req *model.CreateOrderRequest) (*model.Order, error) {
	// 1. Check KYC status
	kycStatus, err := s.GetKYCStatus(req.UserID)
	if err != nil {
		return nil, err
	}

	// 2. If KYC not approved, return KYC required status
	if kycStatus.Status != model.KYCStatusApproved {
		now := time.Now()
		order := &model.Order{
			ID:            uuid.New().String(),
			UserID:        req.UserID,
			Status:        model.OrderStatusKYCRequired,
			FailureReason: "kyc_required",
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		return order, nil
	}

	// 2.5. Validate asset, chain, fiat, and trading pair
	if err := s.rateManager.ValidateFiatCurrency(req.FiatCurrency); err != nil {
		return nil, ErrUnsupportedFiat
	}
	if err := s.rateManager.ValidateAssetAndChain(req.CryptoCurrency, req.ChainID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedChain, err.Error())
	}
	if err := s.rateManager.ValidateTradingPair(req.FiatCurrency, req.CryptoCurrency); err != nil {
		return nil, ErrUnsupportedTradingPair
	}

	// 2.6. Validate wallet address (ONRAMP-06)
	if req.WalletAddress == "" {
		return nil, ErrInvalidWalletAddress
	}
	valid, checksumAddress, warnings := ValidateEVMAddress(req.WalletAddress)
	if !valid {
		return nil, ErrInvalidWalletAddress
	}
	// Log warnings if any
	if len(warnings) > 0 {
		log.Printf("Wallet address warnings for order: %v", warnings)
	}
	// Normalize to checksum address
	req.WalletAddress = checksumAddress

	// 3. Check limits
	if err := s.checkLimits(kycStatus, req.FiatAmount); err != nil {
		return nil, err
	}

	// 4. Get quote
	quote, err := s.GetQuote(&model.QuoteRequest{
		FiatAmount:     req.FiatAmount,
		FiatCurrency:   req.FiatCurrency,
		CryptoCurrency: req.CryptoCurrency,
	})
	if err != nil {
		return nil, err
	}

	// 5. Create order
	now := time.Now()
	order := &model.Order{
		ID:             uuid.New().String(),
		UserID:         req.UserID,
		WalletAddress:  req.WalletAddress,
		FiatAmount:     req.FiatAmount,
		FiatCurrency:   req.FiatCurrency,
		CryptoAmount:   quote.CryptoAmount,
		CryptoCurrency: req.CryptoCurrency,
		ExchangeRate:   quote.ExchangeRate,
		Fee:            quote.Fee,
		PaymentMethod:  req.PaymentMethod,
		ChainID:        req.ChainID,
		ReturnURL:      req.ReturnURL,
		CancelURL:      req.CancelURL,
		Status:         model.OrderStatusPending,
		KYCStatus:      string(kycStatus.Status),
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// Store bank account info if provided
	if req.BankAccount != nil {
		order.BankAccountNo = req.BankAccount.AccountNo
		order.BankHolderName = req.BankAccount.HolderName
	}

	// 6. Route by payment method
	switch req.PaymentMethod {
	case model.PaymentMethodCard, model.PaymentMethodApplePay, model.PaymentMethodGooglePay:
		return s.processCardPayment(order)
	case model.PaymentMethodBankTransfer:
		return s.processBankTransfer(order, req)
	default:
		return nil, ErrUnsupportedPaymentMethod
	}
}

// processCardPayment processes card payment via PG simulator
func (s *OnRampService) processCardPayment(order *model.Order) (*model.Order, error) {
	sessionReq := &CheckoutSessionRequest{
		MerchantID: "ONRAMP_SIMULATOR",
		OrderID:    order.ID,
		OrderName:  fmt.Sprintf("%s Purchase", order.CryptoCurrency),
		Amount:     order.FiatAmount,
		Currency:   order.FiatCurrency,
		ReturnURL:  s.buildReturnURL(order.ID, order.ReturnURL),
		CancelURL:  s.buildCancelURL(order.ID, order.CancelURL),
	}

	session, err := s.pgClient.CreateCheckoutSession(sessionReq)
	if err != nil {
		order.Status = model.OrderStatusFailed
		order.FailureReason = "payment_gateway_error"

		s.mu.Lock()
		s.orders[order.ID] = order
		s.mu.Unlock()

		log.Printf("Order failed (PG error): %s", order.ID)

		orderCopy := *order
		go s.sendWebhook("order.failed", &orderCopy)

		return order, nil
	}

	order.Status = model.OrderStatusPendingPayment
	order.PaymentSessionID = session.ID
	order.PaymentURL = session.CheckoutURL
	order.PaymentExpiresAt = &session.ExpiresAt

	s.mu.Lock()
	s.orders[order.ID] = order
	s.mu.Unlock()

	log.Printf("Order created (pending payment): %s (User: %s, Amount: %s %s)", order.ID, maskUserID(order.UserID), order.FiatAmount, order.FiatCurrency)

	orderCopy := *order
	go s.sendWebhook("order.created", &orderCopy)

	return order, nil
}

// processBankTransfer processes bank transfer via bank simulator
func (s *OnRampService) processBankTransfer(order *model.Order, req *model.CreateOrderRequest) (*model.Order, error) {
	if req.BankAccount == nil {
		return nil, ErrBankAccountRequired
	}

	debitResp, err := s.bankClient.RequestDebit(
		req.BankAccount.AccountNo,
		order.FiatAmount,
		order.FiatCurrency,
		order.ID,
		true, // autoApprove
	)
	if err != nil {
		order.Status = model.OrderStatusFailed
		order.FailureReason = "bank_communication_error"

		s.mu.Lock()
		s.orders[order.ID] = order
		s.mu.Unlock()

		log.Printf("Order failed (bank error): %s", order.ID)

		orderCopy := *order
		go s.sendWebhook("order.failed", &orderCopy)

		return order, nil
	}

	order.DebitRequestID = debitResp.ID

	if debitResp.Status == "completed" {
		order.Status = model.OrderStatusProcessing

		s.mu.Lock()
		s.orders[order.ID] = order
		s.mu.Unlock()

		log.Printf("Order created (processing): %s (User: %s, Amount: %s %s)", order.ID, maskUserID(order.UserID), order.FiatAmount, order.FiatCurrency)

		orderCopy := *order
		go s.sendWebhook("order.created", &orderCopy)

		// Start async crypto transfer
		go s.processCryptoTransfer(order.ID)
	} else {
		order.Status = model.OrderStatusFailed
		order.FailureReason = debitResp.FailureReason
		if order.FailureReason == "" {
			order.FailureReason = "bank_debit_failed"
		}

		s.mu.Lock()
		s.orders[order.ID] = order
		s.mu.Unlock()

		log.Printf("Order failed (debit failed): %s (Reason: %s)", order.ID, order.FailureReason)

		orderCopy := *order
		go s.sendWebhook("order.failed", &orderCopy)
	}

	return order, nil
}

// HandlePaymentWebhook handles payment webhook from PG simulator
func (s *OnRampService) HandlePaymentWebhook(orderID, paymentID, eventType string) error {
	s.mu.Lock()
	order, exists := s.orders[orderID]
	if !exists {
		s.mu.Unlock()
		return fmt.Errorf("order not found: %s", orderID)
	}

	now := time.Now()

	switch eventType {
	case "payment.approved":
		order.ExternalPaymentID = paymentID
		order.Status = model.OrderStatusProcessing
		order.UpdatedAt = now

		orderCopy := *order
		s.mu.Unlock()

		log.Printf("Payment approved for order: %s", orderID)

		go s.sendWebhook("order.processing", &orderCopy)
		go s.processCryptoTransfer(orderID)

	case "payment.declined":
		order.Status = model.OrderStatusFailed
		order.FailureReason = "payment_declined"
		order.UpdatedAt = now

		orderCopy := *order
		s.mu.Unlock()

		log.Printf("Payment declined for order: %s", orderID)

		go s.sendWebhook("order.failed", &orderCopy)

	default:
		s.mu.Unlock()
		return fmt.Errorf("unknown event type: %s", eventType)
	}

	return nil
}

// processCryptoTransfer simulates crypto transfer
func (s *OnRampService) processCryptoTransfer(orderID string) {
	// Update status to payment_completed_pending_transfer
	s.mu.Lock()
	order, exists := s.orders[orderID]
	if !exists {
		s.mu.Unlock()
		return
	}
	order.Status = model.OrderStatusPaymentCompletedPendingTx
	order.UpdatedAt = time.Now()
	orderCopy := *order
	s.mu.Unlock()

	go s.sendWebhook("order.payment_completed", &orderCopy)

	// Simulate crypto transfer delay
	time.Sleep(time.Duration(s.cfg.TransferProcessingTime) * time.Second)

	s.mu.Lock()
	order, exists = s.orders[orderID]
	if !exists {
		s.mu.Unlock()
		return
	}

	now := time.Now()

	if s.rng.Intn(100) < s.cfg.TransferSuccessRate {
		// Transfer success
		order.Status = model.OrderStatusCompleted
		order.TxHash = generateTxHash()
		order.CompletedAt = &now
		order.UpdatedAt = now

		log.Printf("Order completed: %s (TxHash: %s)", orderID, order.TxHash)

		orderCopy := *order
		s.mu.Unlock()

		go s.sendWebhook("order.completed", &orderCopy)
	} else {
		// Transfer failed - start refund
		order.Status = model.OrderStatusRefundPending
		order.FailureReason = "crypto_transfer_failed"
		order.UpdatedAt = now

		log.Printf("Crypto transfer failed, starting refund: %s", orderID)

		orderCopy := *order
		s.mu.Unlock()

		go s.sendWebhook("order.transfer_failed", &orderCopy)
		go s.processRefund(orderID)
	}
}

// processRefund processes refund for failed crypto transfer
func (s *OnRampService) processRefund(orderID string) {
	time.Sleep(time.Duration(s.cfg.RefundProcessingTime) * time.Second)

	s.mu.Lock()
	order, exists := s.orders[orderID]
	if !exists {
		s.mu.Unlock()
		return
	}

	var refundErr error

	switch order.PaymentMethod {
	case model.PaymentMethodCard, model.PaymentMethodApplePay, model.PaymentMethodGooglePay:
		if order.ExternalPaymentID != "" {
			_, refundErr = s.pgClient.RequestRefund(order.ExternalPaymentID, order.FiatAmount, "crypto_transfer_failed")
		}
	case model.PaymentMethodBankTransfer:
		if order.BankAccountNo != "" {
			_, refundErr = s.bankClient.Deposit(
				order.BankAccountNo,
				order.FiatAmount,
				fmt.Sprintf("REFUND_%s", order.ID),
				"Crypto purchase refund",
			)
		}
	}

	now := time.Now()

	if refundErr != nil {
		order.Status = model.OrderStatusFailed
		order.FailureReason = "refund_failed"
		order.UpdatedAt = now

		log.Printf("Refund failed: %s (Error: %v)", orderID, refundErr)

		orderCopy := *order
		s.mu.Unlock()

		go s.sendWebhook("order.refund_failed", &orderCopy)
		return
	}

	order.Status = model.OrderStatusRefunded
	order.RefundedAt = &now
	order.UpdatedAt = now

	log.Printf("Order refunded: %s", orderID)

	orderCopy := *order
	s.mu.Unlock()

	go s.sendWebhook("order.refunded", &orderCopy)
}

// buildReturnURL builds the return URL for payment callback
func (s *OnRampService) buildReturnURL(orderID, userReturnURL string) string {
	baseURL := fmt.Sprintf("%s/api/v1/orders/%s/payment-callback", s.cfg.BaseURL, orderID)
	if userReturnURL != "" {
		return fmt.Sprintf("%s?redirectTo=%s", baseURL, url.QueryEscape(userReturnURL))
	}
	return baseURL
}

// buildCancelURL builds the cancel URL for payment cancellation
func (s *OnRampService) buildCancelURL(orderID, userCancelURL string) string {
	baseURL := fmt.Sprintf("%s/api/v1/orders/%s/payment-cancelled", s.cfg.BaseURL, orderID)
	if userCancelURL != "" {
		return fmt.Sprintf("%s?redirectTo=%s", baseURL, url.QueryEscape(userCancelURL))
	}
	return baseURL
}

// GetOrder returns an order by ID
func (s *OnRampService) GetOrder(id string) (*model.Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	order, exists := s.orders[id]
	if !exists {
		return nil, fmt.Errorf("order not found: %s", id)
	}
	return order, nil
}

// GetOrdersByUser returns all orders for a user
func (s *OnRampService) GetOrdersByUser(userID string) []*model.Order {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var orders []*model.Order
	for _, order := range s.orders {
		if order.UserID == userID {
			orders = append(orders, order)
		}
	}
	return orders
}

// CancelOrder cancels a pending order
func (s *OnRampService) CancelOrder(id string) (*model.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	order, exists := s.orders[id]
	if !exists {
		return nil, fmt.Errorf("order not found: %s", id)
	}

	if order.Status != model.OrderStatusPending && order.Status != model.OrderStatusPendingPayment {
		return nil, fmt.Errorf("order cannot be cancelled: status is %s", order.Status)
	}

	order.Status = model.OrderStatusCancelled
	order.UpdatedAt = time.Now()

	log.Printf("Order cancelled: %s", id)

	orderCopy := *order
	go s.sendWebhook("order.cancelled", &orderCopy)

	return order, nil
}

// ========== Webhook Operations ==========

// Webhook retry configuration
const (
	webhookMaxRetries     = 3
	webhookInitialBackoff = 1 * time.Second
	webhookMaxBackoff     = 10 * time.Second
	webhookTimeout        = 10 * time.Second
)

// sendWebhook sends a webhook notification with exponential backoff retry
func (s *OnRampService) sendWebhook(eventType string, data any) {
	if s.cfg.WebhookURL == "" {
		return
	}

	payload := model.WebhookPayload{
		EventType: eventType,
		Timestamp: time.Now(),
		Data:      data,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal webhook payload: %v", err)
		return
	}

	client := &http.Client{Timeout: webhookTimeout}
	backoff := webhookInitialBackoff

	for attempt := 1; attempt <= webhookMaxRetries; attempt++ {
		req, err := http.NewRequest("POST", s.cfg.WebhookURL, bytes.NewBuffer(body))
		if err != nil {
			log.Printf("Failed to create webhook request: %v", err)
			return
		}

		req.Header.Set("Content-Type", "application/json")
		signature := computeHMAC(body, s.cfg.WebhookSecret)
		req.Header.Set("X-Webhook-Signature", signature)

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Webhook attempt %d/%d failed: %v", attempt, webhookMaxRetries, err)
			if attempt < webhookMaxRetries {
				time.Sleep(backoff)
				backoff = min(backoff*2, webhookMaxBackoff)
			}
			continue
		}
		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			log.Printf("Webhook sent: %s, status: %d (attempt %d)", eventType, resp.StatusCode, attempt)
			return
		}

		if resp.StatusCode >= 500 {
			log.Printf("Webhook attempt %d/%d got server error: %d", attempt, webhookMaxRetries, resp.StatusCode)
			if attempt < webhookMaxRetries {
				time.Sleep(backoff)
				backoff = min(backoff*2, webhookMaxBackoff)
			}
			continue
		}

		log.Printf("Webhook failed with client error: %d, not retrying", resp.StatusCode)
		return
	}

	log.Printf("Webhook failed after %d attempts: %s", webhookMaxRetries, eventType)
}

// VerifyWebhookSignature verifies the HMAC signature of a webhook
func (s *OnRampService) VerifyWebhookSignature(body []byte, signature string) bool {
	expected := computeHMAC(body, s.cfg.WebhookSecret)
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ========== Helper Functions ==========

// generateTxHash generates a random transaction hash
func generateTxHash() string {
	hash := make([]byte, 32)
	cryptorand.Read(hash)
	return "0x" + hex.EncodeToString(hash)
}

// computeHMAC computes HMAC-SHA256 signature
func computeHMAC(data []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

// maskUserID returns a masked representation of user ID for logging
func maskUserID(userID string) string {
	if len(userID) == 0 {
		return "****"
	}

	atIndex := -1
	for i, c := range userID {
		if c == '@' {
			atIndex = i
			break
		}
	}

	if atIndex > 0 {
		return userID[:1] + "****" + userID[atIndex:]
	}

	if len(userID) <= 4 {
		return "****"
	}
	return userID[:2] + "****" + userID[len(userID)-2:]
}
