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
		log.Printf("Payment approved: %s (Order: %s, Amount: %s %s)", payment.ID, payment.OrderID, payment.Amount, payment.Currency)
	} else {
		payment.Status = model.PaymentStatusDeclined
		payment.FailureReason = getRandomDeclineReason(s.rng)
		log.Printf("Payment declined: %s (Reason: %s)", payment.ID, payment.FailureReason)
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

// sendWebhook sends a webhook notification
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

	req, err := http.NewRequest("POST", s.cfg.WebhookURL, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to create webhook request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	signature := computeHMAC(body, s.cfg.WebhookSecret)
	req.Header.Set("X-Webhook-Signature", signature)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send webhook: %v", err)
		return
	}
	defer resp.Body.Close()

	log.Printf("Webhook sent: %s, status: %d", eventType, resp.StatusCode)
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
