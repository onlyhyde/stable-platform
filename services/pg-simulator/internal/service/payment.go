package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"sync"
	"time"
	"unicode"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/model"
)

// PaymentService handles payment operations
type PaymentService struct {
	cfg             *config.Config
	payments        map[string]*model.Payment // paymentID -> Payment
	idempotencyKeys map[string]string         // idempotencyKey -> paymentID (for duplicate detection)
	mu              sync.RWMutex
	rng             *rand.Rand
}

// NewPaymentService creates a new payment service
func NewPaymentService(cfg *config.Config) *PaymentService {
	return &PaymentService{
		cfg:             cfg,
		payments:        make(map[string]*model.Payment),
		idempotencyKeys: make(map[string]string),
		rng:             rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// CreatePayment creates a new payment
func (s *PaymentService) CreatePayment(req *model.CreatePaymentRequest) (*model.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for duplicate payment using idempotency key
	if req.IdempotencyKey != "" {
		if existingPaymentID, exists := s.idempotencyKeys[req.IdempotencyKey]; exists {
			// Return existing payment to prevent duplicate processing
			if existingPayment, ok := s.payments[existingPaymentID]; ok {
				log.Printf("Duplicate payment detected (idempotency key: %s), returning existing payment: %s",
					maskIdempotencyKey(req.IdempotencyKey), existingPaymentID)
				return existingPayment, nil
			}
		}
	}

	now := time.Now()
	payment := &model.Payment{
		ID:         uuid.New().String(),
		MerchantID: req.MerchantID,
		OrderID:    req.OrderID,
		Amount:     req.Amount,
		Currency:   req.Currency,
		Method:     req.Method,
		Status:     model.PaymentStatusPending,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Extract card details if provided
	if req.Card != nil && len(req.Card.Number) >= 4 {
		payment.CardLast4 = req.Card.Number[len(req.Card.Number)-4:]
		payment.CardBrand = detectCardBrand(req.Card.Number)
	}

	// Validate card details before processing
	if req.Method == model.PaymentMethodCard && req.Card != nil {
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
			go s.sendWebhook("payment."+string(payment.Status), &paymentCopy)

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
	go s.sendWebhook("payment."+string(payment.Status), &paymentCopy)

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
	go s.sendWebhook("payment.refunded", &paymentCopy)

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
	go s.sendWebhook("payment.cancelled", &paymentCopy)

	return payment, nil
}

// shouldSucceed determines if payment should succeed based on success rate
func (s *PaymentService) shouldSucceed() bool {
	return s.rng.Intn(100) < s.cfg.SuccessRate
}

// Webhook retry configuration
const (
	webhookMaxRetries     = 3
	webhookInitialBackoff = 1 * time.Second
	webhookMaxBackoff     = 10 * time.Second
	webhookTimeout        = 10 * time.Second
)

// sendWebhook sends a webhook notification with exponential backoff retry
func (s *PaymentService) sendWebhook(eventType string, data interface{}) {
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

		// Success on 2xx status codes
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			log.Printf("Webhook sent: %s, status: %d (attempt %d)", eventType, resp.StatusCode, attempt)
			return
		}

		// Retry on 5xx server errors
		if resp.StatusCode >= 500 {
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
	if len(cleanNumber) < 13 || len(cleanNumber) > 19 {
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
	if year < 100 {
		year += 2000
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
	if year > currentYear+20 {
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
	go s.sendWebhook("payment.3ds."+string(payment.ThreeDSecure.Status), &paymentCopy)

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
	go s.sendWebhook("payment."+string(payment.Status), &paymentCopy)

	return payment, nil
}

// shouldRequireChallenge determines if 3DS challenge is required
// Simulates risk-based authentication decision
func (s *PaymentService) shouldRequireChallenge(payment *model.Payment) bool {
	// Parse amount for risk assessment
	amount := 0.0
	if _, err := fmt.Sscanf(payment.Amount, "%f", &amount); err == nil {
		// High-value transactions always require challenge
		if amount >= 1000 {
			return true
		}
		// Medium-value transactions have 50% chance of challenge
		if amount >= 100 {
			return s.rng.Intn(100) < 50
		}
	}

	// Low-value transactions have 20% chance of challenge
	return s.rng.Intn(100) < 20
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
	return s.rng.Intn(100) < 95
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
	return s.rng.Intn(100) < 95
}
