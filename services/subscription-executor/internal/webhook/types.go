package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"
)

// EventType represents the type of webhook event.
type EventType string

const (
	// Subscription events
	EventSubscriptionCreated   EventType = "subscription.created"
	EventSubscriptionCancelled EventType = "subscription.cancelled"
	EventSubscriptionExpiring  EventType = "subscription.expiring"

	// Payment events
	EventPaymentSuccess EventType = "payment.success"
	EventPaymentFailed  EventType = "payment.failed"
)

// AllEvents returns all supported event types.
func AllEvents() []EventType {
	return []EventType{
		EventSubscriptionCreated,
		EventSubscriptionCancelled,
		EventSubscriptionExpiring,
		EventPaymentSuccess,
		EventPaymentFailed,
	}
}

// IsValid checks if an event type is valid.
func (e EventType) IsValid() bool {
	for _, valid := range AllEvents() {
		if e == valid {
			return true
		}
	}
	return false
}

// DeliveryStatus represents the status of a webhook delivery.
type DeliveryStatus string

const (
	StatusPending   DeliveryStatus = "pending"
	StatusDelivered DeliveryStatus = "delivered"
	StatusFailed    DeliveryStatus = "failed"
	StatusRetrying  DeliveryStatus = "retrying"
)

// WebhookEvent represents an event to be sent to a webhook endpoint.
type WebhookEvent struct {
	ID        string    `json:"id"`
	Type      EventType `json:"type"`
	Timestamp time.Time `json:"timestamp"`
	Data      any       `json:"data"`
	Signature string    `json:"signature,omitempty"`
}

// NewEvent creates a new webhook event.
func NewEvent(eventType EventType, data any) *WebhookEvent {
	return &WebhookEvent{
		ID:        generateEventID(),
		Type:      eventType,
		Timestamp: time.Now().UTC(),
		Data:      data,
	}
}

// Sign generates an HMAC-SHA256 signature for the event.
func (e *WebhookEvent) Sign(secret string) error {
	payload, err := json.Marshal(struct {
		ID        string    `json:"id"`
		Type      EventType `json:"type"`
		Timestamp time.Time `json:"timestamp"`
		Data      any       `json:"data"`
	}{
		ID:        e.ID,
		Type:      e.Type,
		Timestamp: e.Timestamp,
		Data:      e.Data,
	})
	if err != nil {
		return err
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	e.Signature = hex.EncodeToString(mac.Sum(nil))
	return nil
}

// VerifySignature verifies the HMAC-SHA256 signature of the event.
func (e *WebhookEvent) VerifySignature(secret string) bool {
	original := e.Signature
	if err := e.Sign(secret); err != nil {
		return false
	}
	valid := hmac.Equal([]byte(original), []byte(e.Signature))
	e.Signature = original
	return valid
}

// WebhookEndpoint represents a registered webhook endpoint.
type WebhookEndpoint struct {
	ID         string      `json:"id"`
	MerchantID string      `json:"merchant_id"`
	URL        string      `json:"url"`
	Secret     string      `json:"-"` // Never expose in JSON
	Events     []EventType `json:"events"`
	Active     bool        `json:"active"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

// HasEvent checks if the endpoint is subscribed to a specific event type.
func (e *WebhookEndpoint) HasEvent(eventType EventType) bool {
	for _, et := range e.Events {
		if et == eventType {
			return true
		}
	}
	return false
}

// WebhookDelivery represents a webhook delivery attempt.
type WebhookDelivery struct {
	ID           string         `json:"id"`
	EndpointID   string         `json:"endpoint_id"`
	EventID      string         `json:"event_id"`
	EventType    EventType      `json:"event_type"`
	Status       DeliveryStatus `json:"status"`
	Attempts     int            `json:"attempts"`
	MaxAttempts  int            `json:"max_attempts"`
	LastAttempt  time.Time      `json:"last_attempt,omitempty"`
	NextRetry    time.Time      `json:"next_retry,omitempty"`
	ResponseCode int            `json:"response_code,omitempty"`
	ResponseBody string         `json:"response_body,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	DeliveredAt  *time.Time     `json:"delivered_at,omitempty"`
}

// SubscriptionCreatedData represents data for subscription.created event.
type SubscriptionCreatedData struct {
	SubscriptionID    string `json:"subscription_id"`
	PlanID            string `json:"plan_id"`
	SubscriberAddress string `json:"subscriber_address"`
	MerchantAddress   string `json:"merchant_address"`
	Amount            string `json:"amount"`
	Token             string `json:"token"`
	Interval          uint64 `json:"interval"`
	StartTime         int64  `json:"start_time"`
}

// SubscriptionCancelledData represents data for subscription.cancelled event.
type SubscriptionCancelledData struct {
	SubscriptionID string `json:"subscription_id"`
	Reason         string `json:"reason"`
	CancelledAt    int64  `json:"cancelled_at"`
}

// SubscriptionExpiringData represents data for subscription.expiring event.
type SubscriptionExpiringData struct {
	SubscriptionID string `json:"subscription_id"`
	ExpiresAt      int64  `json:"expires_at"`
	DaysRemaining  int    `json:"days_remaining"`
}

// PaymentSuccessData represents data for payment.success event.
type PaymentSuccessData struct {
	PaymentID      string `json:"payment_id"`
	SubscriptionID string `json:"subscription_id"`
	Amount         string `json:"amount"`
	Token          string `json:"token"`
	TxHash         string `json:"tx_hash"`
	BlockNumber    uint64 `json:"block_number"`
	ExecutedAt     int64  `json:"executed_at"`
}

// PaymentFailedData represents data for payment.failed event.
type PaymentFailedData struct {
	PaymentID      string `json:"payment_id"`
	SubscriptionID string `json:"subscription_id"`
	ErrorCode      string `json:"error_code"`
	ErrorMessage   string `json:"error_message"`
	AttemptNumber  int    `json:"attempt_number"`
	FailedAt       int64  `json:"failed_at"`
}

// RetrySchedule defines the retry intervals for webhook delivery.
var RetrySchedule = []time.Duration{
	0,                // 1st attempt: immediate
	5 * time.Minute,  // 2nd attempt: 5 minutes
	30 * time.Minute, // 3rd attempt: 30 minutes
	2 * time.Hour,    // 4th attempt: 2 hours
	24 * time.Hour,   // 5th attempt: 24 hours (final)
}

// MaxRetryAttempts is the maximum number of delivery attempts.
const MaxRetryAttempts = 5

// Helper functions

func generateEventID() string {
	return "evt_" + generateRandomString(24)
}

func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
		time.Sleep(time.Nanosecond) // Ensure uniqueness
	}
	return string(b)
}
