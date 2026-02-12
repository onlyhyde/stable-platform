package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
	"unicode"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/model"
)

// webhookJob represents a queued webhook notification
type webhookJob struct {
	eventType string
	data      interface{}
}

const webhookWorkerCount = 5
const webhookQueueSize = 100

// Error definitions
var (
	ErrBankAccountRequired       = fmt.Errorf("bank account info required for bank_transfer")
	ErrWalletIDRequired          = fmt.Errorf("wallet ID required for wallet payment")
	ErrWalletNotFound            = fmt.Errorf("wallet not found")
	ErrWalletInactive            = fmt.Errorf("wallet is inactive")
	ErrUnsupportedPaymentMethod  = fmt.Errorf("unsupported payment method")
	ErrBankCommunicationError    = fmt.Errorf("failed to communicate with bank")
	ErrAccountVerificationFailed = fmt.Errorf("account verification failed")
	ErrInvalidAmount             = fmt.Errorf("amount must be a positive number")
)

// Payment processing constants
const (
	// Card validation
	minCardNumberLength = 13
	maxCardNumberLength = 19
	twoDigitYearThreshold = 100
	yearOffset            = 2000
	maxFutureExpiryYears  = 20

	// HTTP status ranges
	httpStatusSuccessMin = 200
	httpStatusSuccessMax = 300
	httpStatusServerErr  = 500

	// Risk-based 3DS challenge thresholds
	highValueThreshold            = 1000
	mediumValueThreshold          = 100
	mediumValueChallengeProbability = 50
	lowValueChallengeProbability    = 20
	challengeVerificationRate       = 95
	threeDSSuccessRate              = 95
	percentBase                     = 100
)

// PaymentService handles payment operations
type PaymentService struct {
	cfg              *config.Config
	payments         map[string]*model.Payment          // paymentID -> Payment
	idempotencyKeys  map[string]string                  // idempotencyKey -> paymentID (for duplicate detection)
	wallets          map[string]*model.Wallet           // walletID -> Wallet
	checkoutSessions map[string]*model.CheckoutSession  // sessionID -> CheckoutSession
	bankClient       *BankClient
	mu               sync.RWMutex
	rng              *rand.Rand
	webhookChan      chan webhookJob
	webhookWg        sync.WaitGroup
	ctx              context.Context
	cancel           context.CancelFunc
}

// NewPaymentService creates a new payment service
func NewPaymentService(cfg *config.Config) *PaymentService {
	ctx, cancel := context.WithCancel(context.Background())
	s := &PaymentService{
		cfg:              cfg,
		payments:         make(map[string]*model.Payment),
		idempotencyKeys:  make(map[string]string),
		wallets:          make(map[string]*model.Wallet),
		checkoutSessions: make(map[string]*model.CheckoutSession),
		bankClient:       NewBankClient(cfg.BankSimulatorURL),
		rng:              rand.New(rand.NewSource(time.Now().UnixNano())),
		webhookChan:      make(chan webhookJob, webhookQueueSize),
		ctx:              ctx,
		cancel:           cancel,
	}

	// Start bounded webhook worker pool
	for i := 0; i < webhookWorkerCount; i++ {
		s.webhookWg.Add(1)
		go s.webhookWorker()
	}

	return s
}

// Close gracefully shuts down the payment service and drains webhook queue
func (s *PaymentService) Close() {
	s.cancel()
	close(s.webhookChan)
	s.webhookWg.Wait()
}

// webhookWorker processes webhook jobs from the queue
func (s *PaymentService) webhookWorker() {
	defer s.webhookWg.Done()
	for job := range s.webhookChan {
		s.sendWebhookSync(s.ctx, job.eventType, job.data)
	}
}

// enqueueWebhook adds a webhook job to the bounded queue
func (s *PaymentService) enqueueWebhook(eventType string, data interface{}) {
	select {
	case s.webhookChan <- webhookJob{eventType: eventType, data: data}:
	default:
		log.Printf("Webhook queue full, dropping event: %s", eventType)
	}
}

// CreatePayment creates a new payment
func (s *PaymentService) CreatePayment(req *model.CreatePaymentRequest) (*model.Payment, error) {
	// Validate amount is a positive number
	if parsedAmount, parseErr := strconv.ParseFloat(req.Amount, 64); parseErr != nil || parsedAmount <= 0 {
		return nil, ErrInvalidAmount
	}

	// Atomically check and reserve idempotency key to prevent TOCTOU race
	if req.IdempotencyKey != "" {
		s.mu.Lock()
		if existingPaymentID, exists := s.idempotencyKeys[req.IdempotencyKey]; exists {
			if existingPayment, ok := s.payments[existingPaymentID]; ok {
				s.mu.Unlock()
				log.Printf("Duplicate payment detected (idempotency key: %s), returning existing payment: %s",
					maskIdempotencyKey(req.IdempotencyKey), existingPaymentID)
				return existingPayment, nil
			}
			// Key reserved but payment not yet completed - concurrent duplicate request
			s.mu.Unlock()
			return nil, fmt.Errorf("duplicate request: payment with this idempotency key is being processed")
		}
		// Reserve the key atomically to prevent concurrent duplicate processing
		s.idempotencyKeys[req.IdempotencyKey] = ""
		s.mu.Unlock()
	}

	var payment *model.Payment
	var err error

	// Route by payment method
	switch req.Method {
	case model.PaymentMethodCard:
		payment, err = s.processCardPayment(req)
	case model.PaymentMethodBank:
		payment, err = s.processBankTransfer(req)
	case model.PaymentMethodWallet:
		payment, err = s.processWalletPayment(req)
	default:
		err = ErrUnsupportedPaymentMethod
	}

	// Clean up reservation on error
	if err != nil && req.IdempotencyKey != "" {
		s.mu.Lock()
		if s.idempotencyKeys[req.IdempotencyKey] == "" {
			delete(s.idempotencyKeys, req.IdempotencyKey)
		}
		s.mu.Unlock()
	}

	return payment, err
}

// processCardPayment processes card payment
func (s *PaymentService) processCardPayment(req *model.CreatePaymentRequest) (*model.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	payment := &model.Payment{
		ID:         uuid.New().String(),
		MerchantID: req.MerchantID,
		OrderID:    req.OrderID,
		Amount:     req.Amount,
		Currency:   req.Currency,
		Method:     req.Method,
		Status:     model.PaymentStatusPending,
		ReturnURL:  req.ReturnURL,
		CancelURL:  req.CancelURL,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Extract card details if provided
	if req.Card != nil && len(req.Card.Number) >= 4 {
		payment.CardLast4 = req.Card.Number[len(req.Card.Number)-4:]
		payment.CardBrand = detectCardBrand(req.Card.Number)
	}

	// Validate card details before processing
	if req.Card != nil {
		if err := validateCard(req.Card); err != nil {
			payment.Status = model.PaymentStatusDeclined
			if validationErr, ok := err.(*CardValidationError); ok {
				payment.FailureReason = validationErr.Reason
			} else {
				payment.FailureReason = "invalid_card"
			}
			log.Printf("Payment declined due to card validation: %s (Reason: %s, Card: %s)",
				payment.ID, payment.FailureReason, maskCardInfo(payment.CardLast4, payment.CardBrand))

			s.payments[payment.ID] = payment
			if req.IdempotencyKey != "" {
				s.idempotencyKeys[req.IdempotencyKey] = payment.ID
			}

			// Send webhook notification
			paymentCopy := *payment
			s.enqueueWebhook("payment."+string(payment.Status), &paymentCopy)

			return payment, nil
		}
	}

	// Simulate payment processing
	if s.shouldSucceed() {
		payment.Status = model.PaymentStatusApproved
		// Log with masked card data for security
		log.Printf("Payment approved: %s (Order: %s, Amount: %s %s, Card: %s)",
			payment.ID, payment.OrderID, payment.Amount, payment.Currency, maskCardInfo(payment.CardLast4, payment.CardBrand))
	} else {
		payment.Status = model.PaymentStatusDeclined
		payment.FailureReason = getRandomDeclineReason(s.rng)
		log.Printf("Payment declined: %s (Reason: %s, Card: %s)",
			payment.ID, payment.FailureReason, maskCardInfo(payment.CardLast4, payment.CardBrand))
	}

	s.payments[payment.ID] = payment

	// Store idempotency key for duplicate detection
	if req.IdempotencyKey != "" {
		s.idempotencyKeys[req.IdempotencyKey] = payment.ID
	}

	// Send webhook notification with copy to avoid race condition
	paymentCopy := *payment
	s.enqueueWebhook("payment."+string(payment.Status), &paymentCopy)

	return payment, nil
}

// processBankTransfer processes bank transfer payment via bank-simulator
func (s *PaymentService) processBankTransfer(req *model.CreatePaymentRequest) (*model.Payment, error) {
	// Validate bank account info
	if req.BankAccount == nil {
		return nil, ErrBankAccountRequired
	}

	s.mu.Lock()
	now := time.Now()
	payment := &model.Payment{
		ID:             uuid.New().String(),
		MerchantID:     req.MerchantID,
		OrderID:        req.OrderID,
		Amount:         req.Amount,
		Currency:       req.Currency,
		Method:         model.PaymentMethodBank,
		Status:         model.PaymentStatusPending,
		BankAccountNo:  maskAccountNo(req.BankAccount.AccountNo),
		BankHolderName: maskName(req.BankAccount.HolderName),
		ReturnURL:      req.ReturnURL,
		CancelURL:      req.CancelURL,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	s.payments[payment.ID] = payment
	if req.IdempotencyKey != "" {
		s.idempotencyKeys[req.IdempotencyKey] = payment.ID
	}
	s.mu.Unlock()

	// Verify account with bank-simulator
	verifyResp, err := s.bankClient.VerifyAccount(req.BankAccount.AccountNo, req.BankAccount.HolderName)
	if err != nil || !verifyResp.Verified {
		s.mu.Lock()
		payment.Status = model.PaymentStatusDeclined
		if verifyResp != nil && verifyResp.Reason != "" {
			payment.FailureReason = verifyResp.Reason
		} else {
			payment.FailureReason = "account_verification_failed"
		}
		payment.UpdatedAt = time.Now()
		s.mu.Unlock()

		log.Printf("Bank transfer declined: %s (Reason: %s)", payment.ID, payment.FailureReason)
		paymentCopy := *payment
		s.enqueueWebhook("payment.declined", &paymentCopy)
		return payment, nil
	}

	// Request direct debit from bank-simulator (autoApprove=true for PoC)
	debitResp, err := s.bankClient.RequestDebit(
		req.BankAccount.AccountNo,
		req.Amount,
		req.Currency,
		payment.ID,
		true, // autoApprove
	)
	if err != nil {
		s.mu.Lock()
		payment.Status = model.PaymentStatusDeclined
		payment.FailureReason = "bank_communication_error"
		payment.UpdatedAt = time.Now()
		s.mu.Unlock()

		log.Printf("Bank transfer failed: %s (Error: %v)", payment.ID, err)
		paymentCopy := *payment
		s.enqueueWebhook("payment.declined", &paymentCopy)
		return payment, nil
	}

	s.mu.Lock()
	payment.DebitRequestID = debitResp.ID

	// Update status based on debit result
	if debitResp.Status == "completed" {
		payment.Status = model.PaymentStatusApproved
		log.Printf("Bank transfer approved: %s (DebitID: %s, Amount: %s %s)",
			payment.ID, debitResp.ID, payment.Amount, payment.Currency)
		paymentCopy := *payment
		s.enqueueWebhook("payment.approved", &paymentCopy)
	} else {
		payment.Status = model.PaymentStatusDeclined
		payment.FailureReason = debitResp.FailureReason
		if payment.FailureReason == "" {
			payment.FailureReason = "debit_" + debitResp.Status
		}
		log.Printf("Bank transfer declined: %s (Reason: %s)", payment.ID, payment.FailureReason)
		paymentCopy := *payment
		s.enqueueWebhook("payment.declined", &paymentCopy)
	}
	payment.UpdatedAt = time.Now()
	s.mu.Unlock()

	return payment, nil
}

// processWalletPayment processes wallet payment
func (s *PaymentService) processWalletPayment(req *model.CreatePaymentRequest) (*model.Payment, error) {
	// Validate wallet ID
	if req.WalletID == "" {
		return nil, ErrWalletIDRequired
	}

	// Check wallet exists and is active
	s.mu.RLock()
	wallet, exists := s.wallets[req.WalletID]
	s.mu.RUnlock()

	if !exists {
		return nil, ErrWalletNotFound
	}

	if wallet.Status != model.WalletStatusActive {
		return nil, ErrWalletInactive
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	payment := &model.Payment{
		ID:         uuid.New().String(),
		MerchantID: req.MerchantID,
		OrderID:    req.OrderID,
		Amount:     req.Amount,
		Currency:   req.Currency,
		Method:     model.PaymentMethodWallet,
		Status:     model.PaymentStatusPending,
		WalletID:   wallet.ID,
		WalletType: wallet.Type,
		CardLast4:  wallet.CardLast4,
		CardBrand:  wallet.CardBrand,
		ReturnURL:  req.ReturnURL,
		CancelURL:  req.CancelURL,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Simulate wallet payment processing
	if s.shouldSucceed() {
		payment.Status = model.PaymentStatusApproved
		log.Printf("Wallet payment approved: %s (WalletType: %s, Card: %s)",
			payment.ID, wallet.Type, maskCardInfo(wallet.CardLast4, wallet.CardBrand))
	} else {
		payment.Status = model.PaymentStatusDeclined
		payment.FailureReason = getRandomDeclineReason(s.rng)
		log.Printf("Wallet payment declined: %s (Reason: %s)", payment.ID, payment.FailureReason)
	}

	s.payments[payment.ID] = payment
	if req.IdempotencyKey != "" {
		s.idempotencyKeys[req.IdempotencyKey] = payment.ID
	}

	// Send webhook notification
	paymentCopy := *payment
	s.enqueueWebhook("payment."+string(payment.Status), &paymentCopy)

	return payment, nil
}

// GetPayment returns a payment by ID
func (s *PaymentService) GetPayment(id string) (*model.Payment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	payment, exists := s.payments[id]
	if !exists {
		return nil, fmt.Errorf("payment not found: %s", id)
	}
	return payment, nil
}

// GetPaymentsByMerchant returns all payments for a merchant
func (s *PaymentService) GetPaymentsByMerchant(merchantID string) []*model.Payment {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var payments []*model.Payment
	for _, payment := range s.payments {
		if payment.MerchantID == merchantID {
			payments = append(payments, payment)
		}
	}
	return payments
}

// RefundPayment refunds a payment
func (s *PaymentService) RefundPayment(id string, req *model.RefundRequest) (*model.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	payment, exists := s.payments[id]
	if !exists {
		return nil, fmt.Errorf("payment not found: %s", id)
	}

	if payment.Status != model.PaymentStatusApproved {
		return nil, fmt.Errorf("payment cannot be refunded: status is %s", payment.Status)
	}

	now := time.Now()
	payment.Status = model.PaymentStatusRefunded
	payment.RefundedAt = &now
	payment.UpdatedAt = now

	log.Printf("Payment refunded: %s", id)

	// Send webhook notification with copy to avoid race condition
	paymentCopy := *payment
	s.enqueueWebhook("payment.refunded", &paymentCopy)

	return payment, nil
}

// CancelPayment cancels a pending payment
func (s *PaymentService) CancelPayment(id string) (*model.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	payment, exists := s.payments[id]
	if !exists {
		return nil, fmt.Errorf("payment not found: %s", id)
	}

	if payment.Status != model.PaymentStatusPending {
		return nil, fmt.Errorf("payment cannot be cancelled: status is %s", payment.Status)
	}

	payment.Status = model.PaymentStatusCancelled
	payment.UpdatedAt = time.Now()

	log.Printf("Payment cancelled: %s", id)

	// Send webhook notification with copy to avoid race condition
	paymentCopy := *payment
	s.enqueueWebhook("payment.cancelled", &paymentCopy)

	return payment, nil
}

// shouldSucceed determines if payment should succeed based on success rate
func (s *PaymentService) shouldSucceed() bool {
	return s.rng.Intn(percentBase) < s.cfg.SuccessRate
}

// Webhook retry configuration
const (
	webhookMaxRetries     = 3
	webhookInitialBackoff = 1 * time.Second
	webhookMaxBackoff     = 10 * time.Second
	webhookTimeout        = 10 * time.Second
)

// sendWebhookSync sends a webhook notification with exponential backoff retry and context support
func (s *PaymentService) sendWebhookSync(ctx context.Context, eventType string, data interface{}) {
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
		// Check context cancellation before each attempt
		if ctx.Err() != nil {
			log.Printf("Webhook cancelled: %s (context: %v)", eventType, ctx.Err())
			return
		}

		req, err := http.NewRequestWithContext(ctx, "POST", s.cfg.WebhookURL, bytes.NewBuffer(body))
		if err != nil {
			log.Printf("Failed to create webhook request: %v", err)
			return
		}

		req.Header.Set("Content-Type", "application/json")
		signature := computeHMAC(body, s.cfg.WebhookSecret)
		req.Header.Set("X-Webhook-Signature", signature)

		resp, err := client.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				log.Printf("Webhook cancelled during send: %s", eventType)
				return
			}
			log.Printf("Webhook attempt %d/%d failed: %v", attempt, webhookMaxRetries, err)
			if attempt < webhookMaxRetries {
				time.Sleep(backoff)
				backoff = min(backoff*2, webhookMaxBackoff)
			}
			continue
		}
		resp.Body.Close()

		// Success on 2xx status codes
		if resp.StatusCode >= httpStatusSuccessMin && resp.StatusCode < httpStatusSuccessMax {
			log.Printf("Webhook sent: %s, status: %d (attempt %d)", eventType, resp.StatusCode, attempt)
			return
		}

		// Retry on 5xx server errors
		if resp.StatusCode >= httpStatusServerErr {
			log.Printf("Webhook attempt %d/%d got server error: %d", attempt, webhookMaxRetries, resp.StatusCode)
			if attempt < webhookMaxRetries {
				time.Sleep(backoff)
				backoff = min(backoff*2, webhookMaxBackoff)
			}
			continue
		}

		// Don't retry on 4xx client errors
		log.Printf("Webhook failed with client error: %d, not retrying", resp.StatusCode)
		return
	}

	log.Printf("Webhook failed after %d attempts: %s", webhookMaxRetries, eventType)
}

// detectCardBrand detects card brand from card number
func detectCardBrand(number string) string {
	if len(number) == 0 {
		return "unknown"
	}
	switch number[0] {
	case '4':
		return "visa"
	case '5':
		return "mastercard"
	case '3':
		if len(number) >= 2 && (number[1] == '4' || number[1] == '7') {
			return "amex"
		}
		return "unknown"
	case '6':
		return "discover"
	default:
		return "unknown"
	}
}

// CardValidationError represents a card validation error
type CardValidationError struct {
	Reason string
}

func (e *CardValidationError) Error() string {
	return e.Reason
}

// validateCard validates card details (number, CVV, expiry)
func validateCard(card *model.CardDetails) error {
	if card == nil {
		return nil // No card to validate
	}

	// Validate card number using Luhn algorithm
	if err := validateLuhn(card.Number); err != nil {
		return &CardValidationError{Reason: "invalid_card_number"}
	}

	// Validate CVV
	brand := detectCardBrand(card.Number)
	if err := validateCVV(card.CVV, brand); err != nil {
		return &CardValidationError{Reason: "invalid_cvv"}
	}

	// Validate expiry date
	if err := validateExpiry(card.ExpMonth, card.ExpYear); err != nil {
		return &CardValidationError{Reason: "card_expired"}
	}

	return nil
}

// validateLuhn validates a card number using the Luhn algorithm (mod 10 checksum)
func validateLuhn(number string) error {
	// Remove any spaces or dashes
	cleanNumber := ""
	for _, r := range number {
		if unicode.IsDigit(r) {
			cleanNumber += string(r)
		}
	}

	// Card number must be at least 13 digits (minimum for valid cards)
	if len(cleanNumber) < minCardNumberLength || len(cleanNumber) > maxCardNumberLength {
		return fmt.Errorf("invalid card number length: %d", len(cleanNumber))
	}

	// Card numbers must not start with 0 (no valid card network uses 0 prefix)
	if cleanNumber[0] == '0' {
		return fmt.Errorf("invalid card number: cannot start with 0")
	}

	// Luhn algorithm
	sum := 0
	isSecond := false

	// Process digits from right to left
	for i := len(cleanNumber) - 1; i >= 0; i-- {
		digit := int(cleanNumber[i] - '0')

		if isSecond {
			digit *= 2
			if digit > 9 {
				digit -= 9
			}
		}

		sum += digit
		isSecond = !isSecond
	}

	if sum%10 != 0 {
		return fmt.Errorf("invalid card number checksum")
	}

	return nil
}

// validateCVV validates the CVV based on card brand
// AmEx uses 4-digit CVV (CID), others use 3-digit CVV (CVC/CVV)
func validateCVV(cvv string, brand string) error {
	// CVV must contain only digits
	for _, r := range cvv {
		if !unicode.IsDigit(r) {
			return fmt.Errorf("CVV must contain only digits")
		}
	}

	expectedLength := 3
	if brand == "amex" {
		expectedLength = 4
	}

	if len(cvv) != expectedLength {
		return fmt.Errorf("invalid CVV length: expected %d digits for %s, got %d", expectedLength, brand, len(cvv))
	}

	return nil
}

// validateExpiry validates the card expiry date
func validateExpiry(expMonth, expYear string) error {
	month, err := strconv.Atoi(expMonth)
	if err != nil || month < 1 || month > 12 {
		return fmt.Errorf("invalid expiry month: %s", expMonth)
	}

	year, err := strconv.Atoi(expYear)
	if err != nil {
		return fmt.Errorf("invalid expiry year: %s", expYear)
	}

	// Handle 2-digit year format (e.g., "25" -> 2025)
	if year < twoDigitYearThreshold {
		year += yearOffset
	}

	now := time.Now()
	currentYear := now.Year()
	currentMonth := int(now.Month())

	// Card is expired if:
	// - Year is in the past, OR
	// - Year is current but month has passed
	if year < currentYear {
		return fmt.Errorf("card has expired (year)")
	}
	if year == currentYear && month < currentMonth {
		return fmt.Errorf("card has expired (month)")
	}

	// Reject cards with expiry too far in the future (> 20 years)
	if year > currentYear+maxFutureExpiryYears {
		return fmt.Errorf("invalid expiry year: too far in the future")
	}

	return nil
}

// getRandomDeclineReason returns a random decline reason
func getRandomDeclineReason(rng *rand.Rand) string {
	reasons := []string{
		"insufficient_funds",
		"card_expired",
		"invalid_card",
		"fraud_suspected",
		"bank_declined",
		"processing_error",
	}
	return reasons[rng.Intn(len(reasons))]
}

// computeHMAC computes HMAC-SHA256 signature
func computeHMAC(data []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

// maskCardInfo returns a masked representation of card info for logging
// Only shows brand and last 4 digits (e.g., "visa:****1234")
func maskCardInfo(last4, brand string) string {
	if last4 == "" && brand == "" {
		return "N/A"
	}
	if last4 == "" {
		return brand + ":****"
	}
	if brand == "" {
		return "****" + last4
	}
	return brand + ":****" + last4
}

// maskIdempotencyKey returns a masked representation of idempotency key for logging
// Shows first 4 and last 4 characters with asterisks in between
func maskIdempotencyKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}

// InitiateThreeDSecure initiates 3D Secure authentication for a payment
func (s *PaymentService) InitiateThreeDSecure(paymentID string, req *model.ThreeDSecureInitiateRequest) (*model.ThreeDSecureInitiateResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	payment, exists := s.payments[paymentID]
	if !exists {
		return nil, fmt.Errorf("payment not found: %s", paymentID)
	}

	// Check if payment is in valid state for 3DS
	if payment.Status != model.PaymentStatusPending && payment.Status != model.PaymentStatusRequires3DS {
		return nil, fmt.Errorf("payment cannot initiate 3DS: status is %s", payment.Status)
	}

	// Check if already authenticated
	if payment.ThreeDSecure != nil && payment.ThreeDSecure.Status == model.ThreeDSecureStatusSucceeded {
		return nil, fmt.Errorf("payment already authenticated")
	}

	// Simulate 3DS decision based on card brand and amount
	challengeRequired := s.shouldRequireChallenge(payment)

	// Generate 3DS transaction IDs
	acsTransactionID := uuid.New().String()
	dsTransactionID := uuid.New().String()

	// Build authentication URL (simulator URL)
	authURL := ""
	if challengeRequired {
		authURL = fmt.Sprintf("%s/3ds/challenge/%s?returnUrl=%s",
			s.cfg.BaseURL, acsTransactionID, req.ReturnURL)
	}

	// Initialize 3DS data
	payment.ThreeDSecure = &model.ThreeDSecureData{
		Status:            model.ThreeDSecureStatusPending,
		Version:           "2.0",
		ACSTransactionID:  acsTransactionID,
		DSTransactionID:   dsTransactionID,
		AuthenticationURL: authURL,
		ChallengeRequired: challengeRequired,
	}

	if challengeRequired {
		payment.Status = model.PaymentStatusRequires3DS
		payment.ThreeDSecure.Status = model.ThreeDSecureStatusChallenged
	} else {
		// Frictionless flow - auto-authenticate
		payment.ThreeDSecure.Status = model.ThreeDSecureStatusSucceeded
		payment.ThreeDSecure.ECI = s.generateECI(payment.CardBrand)
		payment.ThreeDSecure.CAVV = s.generateCAVV()
		now := time.Now()
		payment.ThreeDSecure.AuthenticatedAt = &now
		payment.Status = model.PaymentStatusPending3DSComplete
	}

	payment.UpdatedAt = time.Now()

	log.Printf("3DS initiated for payment %s: challenge=%v, status=%s",
		paymentID, challengeRequired, payment.ThreeDSecure.Status)

	return &model.ThreeDSecureInitiateResponse{
		PaymentID:         paymentID,
		Status:            payment.ThreeDSecure.Status,
		ChallengeRequired: challengeRequired,
		AuthenticationURL: authURL,
		ACSTransactionID:  acsTransactionID,
	}, nil
}

// CompleteThreeDSecure completes 3D Secure authentication
func (s *PaymentService) CompleteThreeDSecure(paymentID string, req *model.ThreeDSecureCompleteRequest) (*model.ThreeDSecureCompleteResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	payment, exists := s.payments[paymentID]
	if !exists {
		return nil, fmt.Errorf("payment not found: %s", paymentID)
	}

	// Check if payment requires 3DS completion
	if payment.ThreeDSecure == nil {
		return nil, fmt.Errorf("payment has no 3DS data")
	}

	if payment.ThreeDSecure.Status != model.ThreeDSecureStatusChallenged &&
		payment.ThreeDSecure.Status != model.ThreeDSecureStatusPending {
		return nil, fmt.Errorf("payment 3DS cannot be completed: status is %s", payment.ThreeDSecure.Status)
	}

	// Simulate challenge verification
	// In a real implementation, this would verify the challenge response with the ACS
	challengeSuccess := s.verifyChallenge(req.ChallengeResponse)

	now := time.Now()
	if challengeSuccess {
		payment.ThreeDSecure.Status = model.ThreeDSecureStatusSucceeded
		payment.ThreeDSecure.ECI = s.generateECI(payment.CardBrand)
		payment.ThreeDSecure.CAVV = s.generateCAVV()
		payment.ThreeDSecure.AuthenticatedAt = &now
		payment.Status = model.PaymentStatusPending3DSComplete

		log.Printf("3DS completed successfully for payment %s", paymentID)
	} else {
		payment.ThreeDSecure.Status = model.ThreeDSecureStatusFailed
		payment.Status = model.PaymentStatusDeclined
		payment.FailureReason = "3ds_authentication_failed"

		log.Printf("3DS failed for payment %s", paymentID)
	}

	payment.UpdatedAt = now

	// Send webhook notification
	paymentCopy := *payment
	s.enqueueWebhook("payment.3ds."+string(payment.ThreeDSecure.Status), &paymentCopy)

	return &model.ThreeDSecureCompleteResponse{
		PaymentID:     paymentID,
		Status:        payment.ThreeDSecure.Status,
		PaymentStatus: payment.Status,
		ECI:           payment.ThreeDSecure.ECI,
		CAVV:          payment.ThreeDSecure.CAVV,
	}, nil
}

// FinalizePaymentAfter3DS finalizes a payment after successful 3DS authentication
func (s *PaymentService) FinalizePaymentAfter3DS(paymentID string) (*model.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	payment, exists := s.payments[paymentID]
	if !exists {
		return nil, fmt.Errorf("payment not found: %s", paymentID)
	}

	// Check if payment is ready for finalization
	if payment.Status != model.PaymentStatusPending3DSComplete {
		return nil, fmt.Errorf("payment cannot be finalized: status is %s", payment.Status)
	}

	if payment.ThreeDSecure == nil || payment.ThreeDSecure.Status != model.ThreeDSecureStatusSucceeded {
		return nil, fmt.Errorf("payment 3DS not authenticated")
	}

	// Simulate final payment processing (with higher success rate after 3DS)
	if s.shouldSucceedAfter3DS() {
		payment.Status = model.PaymentStatusApproved
		log.Printf("Payment approved after 3DS: %s (Card: %s)",
			payment.ID, maskCardInfo(payment.CardLast4, payment.CardBrand))
	} else {
		payment.Status = model.PaymentStatusDeclined
		payment.FailureReason = getRandomDeclineReason(s.rng)
		log.Printf("Payment declined after 3DS: %s (Reason: %s)",
			payment.ID, payment.FailureReason)
	}

	payment.UpdatedAt = time.Now()

	// Send webhook notification
	paymentCopy := *payment
	s.enqueueWebhook("payment."+string(payment.Status), &paymentCopy)

	return payment, nil
}

// shouldRequireChallenge determines if 3DS challenge is required
// Simulates risk-based authentication decision
func (s *PaymentService) shouldRequireChallenge(payment *model.Payment) bool {
	// Parse amount for risk assessment
	amount := 0.0
	if _, err := fmt.Sscanf(payment.Amount, "%f", &amount); err == nil {
		// High-value transactions always require challenge
		if amount >= highValueThreshold {
			return true
		}
		// Medium-value transactions have 50% chance of challenge
		if amount >= mediumValueThreshold {
			return s.rng.Intn(percentBase) < mediumValueChallengeProbability
		}
	}

	// Low-value transactions have 20% chance of challenge
	return s.rng.Intn(percentBase) < lowValueChallengeProbability
}

// verifyChallenge simulates challenge response verification
func (s *PaymentService) verifyChallenge(response string) bool {
	// Accept any non-empty response with 95% success rate
	if response == "" {
		return false
	}
	// Specific test responses for testing
	if response == "FAIL" || response == "fail" || response == "000000" {
		return false
	}
	if response == "SUCCESS" || response == "success" || response == "123456" {
		return true
	}
	// Random success/failure for other responses
	return s.rng.Intn(percentBase) < challengeVerificationRate
}

// generateECI generates Electronic Commerce Indicator based on card brand
func (s *PaymentService) generateECI(brand string) string {
	// ECI values for 3DS 2.0 authenticated transactions
	switch brand {
	case "visa", "discover":
		return "05" // Fully authenticated
	case "mastercard":
		return "02" // Fully authenticated
	case "amex":
		return "05" // Fully authenticated
	default:
		return "05"
	}
}

// generateCAVV generates a simulated CAVV (Cardholder Authentication Verification Value)
func (s *PaymentService) generateCAVV() string {
	// Generate a random 28-character base64-like string
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	cavv := make([]byte, 28)
	for i := range cavv {
		cavv[i] = chars[s.rng.Intn(len(chars))]
	}
	return string(cavv)
}

// shouldSucceedAfter3DS determines if payment should succeed after 3DS authentication
// Higher success rate than regular payments due to reduced fraud risk
func (s *PaymentService) shouldSucceedAfter3DS() bool {
	// 95% success rate for 3DS authenticated transactions (vs normal success rate)
	return s.rng.Intn(percentBase) < threeDSSuccessRate
}

// --- Wallet methods ---

// CreateWallet creates a new wallet
func (s *PaymentService) CreateWallet(req *model.CreateWalletRequest) (*model.Wallet, error) {
	// Validate card details
	if req.DefaultCard == nil {
		return nil, fmt.Errorf("default card is required")
	}

	if err := validateCard(req.DefaultCard); err != nil {
		return nil, err
	}

	// Extract card info
	cardBrand := detectCardBrand(req.DefaultCard.Number)
	cardLast4 := ""
	if len(req.DefaultCard.Number) >= 4 {
		cardLast4 = req.DefaultCard.Number[len(req.DefaultCard.Number)-4:]
	}

	now := time.Now()
	wallet := &model.Wallet{
		ID:         uuid.New().String(),
		UserID:     req.UserID,
		Name:       req.Name,
		Type:       req.Type,
		CardLast4:  cardLast4,
		CardBrand:  cardBrand,
		CardNumber: req.DefaultCard.Number,
		CardExpiry: fmt.Sprintf("%s/%s", req.DefaultCard.ExpMonth, req.DefaultCard.ExpYear),
		CardCVV:    req.DefaultCard.CVV,
		CardName:   req.DefaultCard.Name,
		Status:     model.WalletStatusActive,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	s.mu.Lock()
	s.wallets[wallet.ID] = wallet
	s.mu.Unlock()

	log.Printf("Wallet created: %s (Type: %s, User: %s)", wallet.ID, wallet.Type, wallet.UserID)

	return wallet, nil
}

// GetWallet returns a wallet by ID
func (s *PaymentService) GetWallet(walletID string) (*model.Wallet, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	wallet, exists := s.wallets[walletID]
	if !exists {
		return nil, ErrWalletNotFound
	}
	return wallet, nil
}

// GetWalletsByUser returns all wallets for a user
func (s *PaymentService) GetWalletsByUser(userID string) []*model.Wallet {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var wallets []*model.Wallet
	for _, wallet := range s.wallets {
		if wallet.UserID == userID {
			wallets = append(wallets, wallet)
		}
	}
	return wallets
}

// DeleteWallet deletes a wallet by setting it to inactive
func (s *PaymentService) DeleteWallet(walletID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	wallet, exists := s.wallets[walletID]
	if !exists {
		return ErrWalletNotFound
	}

	wallet.Status = model.WalletStatusInactive
	wallet.UpdatedAt = time.Now()

	log.Printf("Wallet deleted: %s", walletID)

	return nil
}

// --- Masking functions ---

// maskAccountNo masks a bank account number
// "BANK1234567890" → "BANK****7890"
func maskAccountNo(accountNo string) string {
	if len(accountNo) <= 8 {
		return accountNo
	}
	prefix := accountNo[:4]
	suffix := accountNo[len(accountNo)-4:]
	return prefix + "****" + suffix
}

// maskName masks a name (for Korean names)
// "홍길동" → "홍*동"
func maskName(name string) string {
	runes := []rune(name)
	if len(runes) <= 1 {
		return name
	}
	if len(runes) == 2 {
		return string(runes[0]) + "*"
	}
	// "홍길동" → "홍*동"
	return string(runes[0]) + "*" + string(runes[len(runes)-1])
}

// ========== Checkout Session (PG-04) ==========

// Checkout session errors
var (
	ErrCheckoutSessionNotFound = fmt.Errorf("checkout session not found")
	ErrCheckoutSessionExpired  = fmt.Errorf("checkout session has expired")
	ErrCheckoutSessionNotPending = fmt.Errorf("checkout session is not in pending state")
)

const checkoutSessionExpiry = 3600 * time.Second // 1 hour

// CreateCheckoutSession creates a new checkout session
func (s *PaymentService) CreateCheckoutSession(req *model.CreateCheckoutSessionRequest) (*model.CheckoutSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	sessionID := uuid.New().String()

	session := &model.CheckoutSession{
		ID:         sessionID,
		MerchantID: req.MerchantID,
		OrderID:    req.OrderID,
		OrderName:  req.OrderName,
		Amount:     req.Amount,
		Currency:   req.Currency,
		ReturnURL:  req.ReturnURL,
		CancelURL:  req.CancelURL,
		CheckoutURL: fmt.Sprintf("%s/checkout/%s", s.cfg.BaseURL, sessionID),
		Status:     model.CheckoutSessionStatusPending,
		ExpiresAt:  now.Add(checkoutSessionExpiry),
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	s.checkoutSessions[sessionID] = session

	log.Printf("Checkout session created: %s (Order: %s, Amount: %s %s, Merchant: %s)",
		sessionID, req.OrderID, req.Amount, req.Currency, req.MerchantID)

	return session, nil
}

// GetCheckoutSession returns a checkout session by ID, checking expiry
func (s *PaymentService) GetCheckoutSession(sessionID string) (*model.CheckoutSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.checkoutSessions[sessionID]
	if !exists {
		return nil, ErrCheckoutSessionNotFound
	}

	// Check if session has expired
	if session.Status == model.CheckoutSessionStatusPending && time.Now().After(session.ExpiresAt) {
		// Don't modify under RLock; return expired status
		sessionCopy := *session
		sessionCopy.Status = model.CheckoutSessionStatusExpired
		return &sessionCopy, nil
	}

	return session, nil
}

// ProcessCheckoutPayment processes payment from the checkout session page
func (s *PaymentService) ProcessCheckoutPayment(sessionID string, req *model.CreatePaymentRequest) (*model.Payment, error) {
	// Get and validate session
	s.mu.Lock()
	session, exists := s.checkoutSessions[sessionID]
	if !exists {
		s.mu.Unlock()
		return nil, ErrCheckoutSessionNotFound
	}

	// Expire check
	if time.Now().After(session.ExpiresAt) {
		session.Status = model.CheckoutSessionStatusExpired
		session.UpdatedAt = time.Now()
		s.mu.Unlock()
		return nil, ErrCheckoutSessionExpired
	}

	if session.Status != model.CheckoutSessionStatusPending {
		s.mu.Unlock()
		return nil, ErrCheckoutSessionNotPending
	}

	// Override request fields from session data
	req.MerchantID = session.MerchantID
	req.OrderID = session.OrderID
	req.Amount = session.Amount
	req.Currency = session.Currency
	req.ReturnURL = session.ReturnURL
	req.CancelURL = session.CancelURL
	s.mu.Unlock()

	// Create the actual payment (reuses existing payment logic)
	payment, err := s.CreatePayment(req)
	if err != nil {
		return nil, err
	}

	// Update session with payment ID and status
	s.mu.Lock()
	session.PaymentID = payment.ID
	if payment.Status == model.PaymentStatusApproved {
		session.Status = model.CheckoutSessionStatusCompleted
	}
	session.UpdatedAt = time.Now()
	s.mu.Unlock()

	log.Printf("Checkout session payment processed: session=%s, payment=%s, status=%s",
		sessionID, payment.ID, payment.Status)

	return payment, nil
}

// CancelCheckoutSession cancels a checkout session
func (s *PaymentService) CancelCheckoutSession(sessionID string) (*model.CheckoutSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, exists := s.checkoutSessions[sessionID]
	if !exists {
		return nil, ErrCheckoutSessionNotFound
	}

	if session.Status != model.CheckoutSessionStatusPending {
		return nil, ErrCheckoutSessionNotPending
	}

	session.Status = model.CheckoutSessionStatusCancelled
	session.UpdatedAt = time.Now()

	log.Printf("Checkout session cancelled: %s", sessionID)

	return session, nil
}

// ========== Redirect URL (PG-03) ==========

// RedirectInfo contains redirect URL details for a payment
type RedirectInfo struct {
	RedirectURL string `json:"redirectUrl"`
	PaymentID   string `json:"paymentId"`
	OrderID     string `json:"orderId"`
	Status      string `json:"status"`
}

// GenerateRedirectURL generates a signed redirect URL for payment result
func (s *PaymentService) GenerateRedirectURL(paymentID string) (*RedirectInfo, error) {
	s.mu.RLock()
	payment, exists := s.payments[paymentID]
	if !exists {
		s.mu.RUnlock()
		return nil, fmt.Errorf("payment not found: %s", paymentID)
	}

	returnURL := payment.ReturnURL
	orderID := payment.OrderID
	status := string(payment.Status)
	s.mu.RUnlock()

	if returnURL == "" {
		// Fallback to PG result page
		returnURL = fmt.Sprintf("%s/result/%s", s.cfg.BaseURL, paymentID)
	}

	// Build signed redirect URL
	redirectURL := s.buildSignedRedirectURL(returnURL, paymentID, orderID, status)

	return &RedirectInfo{
		RedirectURL: redirectURL,
		PaymentID:   paymentID,
		OrderID:     orderID,
		Status:      status,
	}, nil
}

// buildSignedRedirectURL builds a redirect URL with query params and HMAC signature
func (s *PaymentService) buildSignedRedirectURL(baseURL, paymentID, orderID, status string) string {
	// Compute HMAC signature: sign "paymentId:orderId:status"
	signData := fmt.Sprintf("%s:%s:%s", paymentID, orderID, status)
	h := hmac.New(sha256.New, []byte(s.cfg.WebhookSecret))
	h.Write([]byte(signData))
	signature := hex.EncodeToString(h.Sum(nil))

	// Parse and append query parameters
	u, err := url.Parse(baseURL)
	if err != nil {
		// Fallback: construct URL manually
		return fmt.Sprintf("%s?paymentId=%s&orderId=%s&status=%s&signature=%s",
			baseURL, paymentID, orderID, status, signature)
	}

	q := u.Query()
	q.Set("paymentId", paymentID)
	q.Set("orderId", orderID)
	q.Set("status", status)
	q.Set("signature", signature)
	u.RawQuery = q.Encode()

	return u.String()
}

// VerifyRedirectSignature verifies the HMAC signature in a redirect URL
func VerifyRedirectSignature(paymentID, orderID, status, signature, secret string) bool {
	signData := fmt.Sprintf("%s:%s:%s", paymentID, orderID, status)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(signData))
	expectedSig := hex.EncodeToString(h.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expectedSig))
}
