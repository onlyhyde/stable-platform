package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/model"
)

const (
	feePercent = "1.5" // 1.5% fee
)

// OnRampService handles onramp operations
type OnRampService struct {
	cfg    *config.Config
	orders map[string]*model.Order // orderID -> Order
	mu     sync.RWMutex
	rng    *rand.Rand
}

// NewOnRampService creates a new onramp service
func NewOnRampService(cfg *config.Config) *OnRampService {
	return &OnRampService{
		cfg:    cfg,
		orders: make(map[string]*model.Order),
		rng:    rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// GetQuote returns a price quote for fiat to crypto conversion
func (s *OnRampService) GetQuote(req *model.QuoteRequest) (*model.QuoteResponse, error) {
	// Parse fiat amount
	fiatAmount, ok := new(big.Float).SetString(req.FiatAmount)
	if !ok {
		return nil, fmt.Errorf("invalid fiat amount: %s", req.FiatAmount)
	}

	// Get exchange rate
	rate, _ := new(big.Float).SetString(s.cfg.USDToUSDC)

	// Calculate fee (1.5%)
	feeRate, _ := new(big.Float).SetString(feePercent)
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
		ExchangeRate:   s.cfg.USDToUSDC,
		Fee:            fee.Text('f', 2),
		FeePercent:     feePercent,
		ExpiresAt:      expiresAt.Format(time.RFC3339),
	}, nil
}

// CreateOrder creates a new purchase order
func (s *OnRampService) CreateOrder(req *model.CreateOrderRequest) (*model.Order, error) {
	// Get quote first
	quote, err := s.GetQuote(&model.QuoteRequest{
		FiatAmount:     req.FiatAmount,
		FiatCurrency:   req.FiatCurrency,
		CryptoCurrency: req.CryptoCurrency,
	})
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

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
		Status:         model.OrderStatusPending,
		ChainID:        req.ChainID,
		KYCStatus:      "approved", // Simulated KYC approval
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	s.orders[order.ID] = order
	log.Printf("Order created: %s (User: %s, Amount: %s %s)", order.ID, order.UserID, order.FiatAmount, order.FiatCurrency)

	// Create a copy of order for webhook to avoid race condition
	// The webhook goroutine may execute while processOrder modifies the order
	orderCopy := *order

	// Send webhook notification with copy to prevent race condition
	go s.sendWebhook("order.created", &orderCopy)

	// Start async processing
	go s.processOrder(order.ID)

	return order, nil
}

// processOrder simulates order processing
func (s *OnRampService) processOrder(orderID string) {
	// Simulate payment processing delay
	time.Sleep(time.Duration(s.cfg.ProcessingTime) * time.Second)

	s.mu.Lock()
	order, exists := s.orders[orderID]
	if !exists {
		s.mu.Unlock()
		return
	}

	// Update to processing
	order.Status = model.OrderStatusProcessing
	order.UpdatedAt = time.Now()
	s.mu.Unlock()

	go s.sendWebhook("order.processing", order)

	// Simulate crypto transfer delay
	time.Sleep(time.Duration(s.cfg.ProcessingTime) * time.Second)

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// Determine success or failure
	if s.shouldSucceed() {
		order.Status = model.OrderStatusCompleted
		order.TxHash = generateTxHash()
		order.CompletedAt = &now
		log.Printf("Order completed: %s (TxHash: %s)", orderID, order.TxHash)
	} else {
		order.Status = model.OrderStatusFailed
		order.FailureReason = getRandomFailureReason(s.rng)
		log.Printf("Order failed: %s (Reason: %s)", orderID, order.FailureReason)
	}
	order.UpdatedAt = now

	go s.sendWebhook("order."+string(order.Status), order)
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

	if order.Status != model.OrderStatusPending {
		return nil, fmt.Errorf("order cannot be cancelled: status is %s", order.Status)
	}

	order.Status = model.OrderStatusCancelled
	order.UpdatedAt = time.Now()

	log.Printf("Order cancelled: %s", id)

	go s.sendWebhook("order.cancelled", order)

	return order, nil
}

// shouldSucceed determines if order should succeed based on success rate
func (s *OnRampService) shouldSucceed() bool {
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
func (s *OnRampService) sendWebhook(eventType string, data interface{}) {
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

// generateTxHash generates a random transaction hash
func generateTxHash() string {
	hash := make([]byte, 32)
	rand.Read(hash)
	return "0x" + hex.EncodeToString(hash)
}

// getRandomFailureReason returns a random failure reason
func getRandomFailureReason(rng *rand.Rand) string {
	reasons := []string{
		"payment_declined",
		"insufficient_liquidity",
		"compliance_check_failed",
		"rate_limit_exceeded",
		"network_error",
	}
	return reasons[rng.Intn(len(reasons))]
}

// computeHMAC computes HMAC-SHA256 signature
func computeHMAC(data []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}
