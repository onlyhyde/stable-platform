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
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/model"
)

// PaymentService handles payment operations
type PaymentService struct {
	cfg      *config.Config
	payments map[string]*model.Payment // paymentID -> Payment
	mu       sync.RWMutex
	rng      *rand.Rand
}

// NewPaymentService creates a new payment service
func NewPaymentService(cfg *config.Config) *PaymentService {
	return &PaymentService{
		cfg:      cfg,
		payments: make(map[string]*model.Payment),
		rng:      rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// CreatePayment creates a new payment
func (s *PaymentService) CreatePayment(req *model.CreatePaymentRequest) (*model.Payment, error) {
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
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Extract card details if provided
	if req.Card != nil && len(req.Card.Number) >= 4 {
		payment.CardLast4 = req.Card.Number[len(req.Card.Number)-4:]
		payment.CardBrand = detectCardBrand(req.Card.Number)
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

	// Send webhook notification
	go s.sendWebhook("payment."+string(payment.Status), payment)

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

	// Send webhook notification
	go s.sendWebhook("payment.refunded", payment)

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

	// Send webhook notification
	go s.sendWebhook("payment.cancelled", payment)

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
