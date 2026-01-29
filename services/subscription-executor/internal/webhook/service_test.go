package webhook

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestEventType_IsValid(t *testing.T) {
	tests := []struct {
		name     string
		event    EventType
		expected bool
	}{
		{"subscription.created", EventSubscriptionCreated, true},
		{"subscription.cancelled", EventSubscriptionCancelled, true},
		{"subscription.expiring", EventSubscriptionExpiring, true},
		{"payment.success", EventPaymentSuccess, true},
		{"payment.failed", EventPaymentFailed, true},
		{"invalid.event", EventType("invalid.event"), false},
		{"empty", EventType(""), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.event.IsValid(); got != tt.expected {
				t.Errorf("EventType.IsValid() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestWebhookEvent_Sign(t *testing.T) {
	event := NewEvent(EventPaymentSuccess, PaymentSuccessData{
		PaymentID:      "pay_123",
		SubscriptionID: "sub_456",
		Amount:         "100.00",
		Token:          "USDC",
		TxHash:         "0xabc123",
		BlockNumber:    12345,
		ExecutedAt:     time.Now().Unix(),
	})

	secret := "test_secret_key"

	// Sign the event
	err := event.Sign(secret)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}

	if event.Signature == "" {
		t.Error("Sign() did not set signature")
	}

	// Verify signature
	if !event.VerifySignature(secret) {
		t.Error("VerifySignature() returned false for valid signature")
	}

	// Verify with wrong secret
	if event.VerifySignature("wrong_secret") {
		t.Error("VerifySignature() returned true for wrong secret")
	}
}

func TestWebhookEndpoint_HasEvent(t *testing.T) {
	endpoint := &WebhookEndpoint{
		Events: []EventType{EventPaymentSuccess, EventPaymentFailed},
	}

	if !endpoint.HasEvent(EventPaymentSuccess) {
		t.Error("HasEvent() should return true for subscribed event")
	}

	if endpoint.HasEvent(EventSubscriptionCreated) {
		t.Error("HasEvent() should return false for non-subscribed event")
	}
}

func TestInMemoryStore_Endpoints(t *testing.T) {
	ctx := context.Background()
	store := NewInMemoryStore()

	// Create endpoint
	endpoint := &WebhookEndpoint{
		MerchantID: "merchant_123",
		URL:        "https://example.com/webhook",
		Events:     []EventType{EventPaymentSuccess},
		Active:     true,
	}

	err := store.CreateEndpoint(ctx, endpoint)
	if err != nil {
		t.Fatalf("CreateEndpoint() error = %v", err)
	}

	if endpoint.ID == "" {
		t.Error("CreateEndpoint() did not set ID")
	}
	if endpoint.Secret == "" {
		t.Error("CreateEndpoint() did not set Secret")
	}

	// Get endpoint
	retrieved, err := store.GetEndpoint(ctx, endpoint.ID)
	if err != nil {
		t.Fatalf("GetEndpoint() error = %v", err)
	}
	if retrieved.MerchantID != "merchant_123" {
		t.Errorf("GetEndpoint() MerchantID = %v, want %v", retrieved.MerchantID, "merchant_123")
	}

	// Get endpoints by merchant
	endpoints, err := store.GetEndpointsByMerchant(ctx, "merchant_123")
	if err != nil {
		t.Fatalf("GetEndpointsByMerchant() error = %v", err)
	}
	if len(endpoints) != 1 {
		t.Errorf("GetEndpointsByMerchant() returned %d endpoints, want 1", len(endpoints))
	}

	// Get endpoints by event
	endpoints, err = store.GetEndpointsByEvent(ctx, EventPaymentSuccess)
	if err != nil {
		t.Fatalf("GetEndpointsByEvent() error = %v", err)
	}
	if len(endpoints) != 1 {
		t.Errorf("GetEndpointsByEvent() returned %d endpoints, want 1", len(endpoints))
	}

	// Delete endpoint
	err = store.DeleteEndpoint(ctx, endpoint.ID)
	if err != nil {
		t.Fatalf("DeleteEndpoint() error = %v", err)
	}

	_, err = store.GetEndpoint(ctx, endpoint.ID)
	if err != ErrEndpointNotFound {
		t.Errorf("GetEndpoint() after delete error = %v, want ErrEndpointNotFound", err)
	}
}

func TestInMemoryStore_Deliveries(t *testing.T) {
	ctx := context.Background()
	store := NewInMemoryStore()

	delivery := &WebhookDelivery{
		EndpointID:  "ep_123",
		EventID:     "evt_456",
		EventType:   EventPaymentSuccess,
		Status:      StatusPending,
		Attempts:    0,
		MaxAttempts: MaxRetryAttempts,
	}

	err := store.CreateDelivery(ctx, delivery)
	if err != nil {
		t.Fatalf("CreateDelivery() error = %v", err)
	}

	if delivery.ID == "" {
		t.Error("CreateDelivery() did not set ID")
	}

	// Get delivery
	retrieved, err := store.GetDelivery(ctx, delivery.ID)
	if err != nil {
		t.Fatalf("GetDelivery() error = %v", err)
	}
	if retrieved.EventID != "evt_456" {
		t.Errorf("GetDelivery() EventID = %v, want %v", retrieved.EventID, "evt_456")
	}

	// Get pending deliveries
	pending, err := store.GetPendingDeliveries(ctx, 10)
	if err != nil {
		t.Fatalf("GetPendingDeliveries() error = %v", err)
	}
	if len(pending) != 1 {
		t.Errorf("GetPendingDeliveries() returned %d deliveries, want 1", len(pending))
	}
}

func TestService_Register(t *testing.T) {
	store := NewInMemoryStore()
	config := DefaultServiceConfig()
	config.WorkerEnabled = false
	svc := NewService(store, config, nil)

	ctx := context.Background()

	// Valid registration
	endpoint, err := svc.Register(ctx, "merchant_123", "https://example.com/webhook", []EventType{EventPaymentSuccess})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if endpoint.ID == "" {
		t.Error("Register() returned endpoint with empty ID")
	}

	// Invalid URL
	_, err = svc.Register(ctx, "merchant_123", "not-a-valid-url", []EventType{EventPaymentSuccess})
	if err == nil {
		t.Error("Register() should fail for invalid URL")
	}

	// Invalid event type
	_, err = svc.Register(ctx, "merchant_123", "https://example.com/webhook", []EventType{"invalid.event"})
	if err == nil {
		t.Error("Register() should fail for invalid event type")
	}
}

func TestService_Send(t *testing.T) {
	// Create test server
	var receivedCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedCount.Add(1)

		// Verify headers
		if r.Header.Get("Content-Type") != "application/json" {
			t.Error("Missing Content-Type header")
		}
		if r.Header.Get("X-Webhook-Event") == "" {
			t.Error("Missing X-Webhook-Event header")
		}
		if r.Header.Get("X-Webhook-Signature") == "" {
			t.Error("Missing X-Webhook-Signature header")
		}

		// Read and verify body
		body, _ := io.ReadAll(r.Body)
		var event WebhookEvent
		if err := json.Unmarshal(body, &event); err != nil {
			t.Errorf("Failed to unmarshal event: %v", err)
		}
		if event.Type != EventPaymentSuccess {
			t.Errorf("Wrong event type: %v", event.Type)
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "received"}`))
	}))
	defer server.Close()

	store := NewInMemoryStore()
	config := DefaultServiceConfig()
	config.WorkerEnabled = false
	svc := NewService(store, config, nil)

	ctx := context.Background()

	// Register endpoint
	_, err := svc.Register(ctx, "merchant_123", server.URL, []EventType{EventPaymentSuccess})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// Send event
	event := NewEvent(EventPaymentSuccess, PaymentSuccessData{
		PaymentID:      "pay_123",
		SubscriptionID: "sub_456",
		Amount:         "100.00",
		Token:          "USDC",
		TxHash:         "0xabc123",
		BlockNumber:    12345,
		ExecutedAt:     time.Now().Unix(),
	})

	err = svc.Send(ctx, event)
	if err != nil {
		t.Fatalf("Send() error = %v", err)
	}

	if receivedCount.Load() != 1 {
		t.Errorf("Server received %d requests, want 1", receivedCount.Load())
	}
}

func TestService_SendFailureAndRetry(t *testing.T) {
	// Create test server that fails first time
	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := callCount.Add(1)
		if count == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	store := NewInMemoryStore()
	config := DefaultServiceConfig()
	config.WorkerEnabled = false
	svc := NewService(store, config, nil)

	ctx := context.Background()

	// Register endpoint
	endpoint, err := svc.Register(ctx, "merchant_123", server.URL, []EventType{EventPaymentSuccess})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// Send event (first attempt will fail)
	event := NewEvent(EventPaymentSuccess, PaymentSuccessData{
		PaymentID: "pay_123",
	})

	_ = svc.Send(ctx, event)

	// Verify delivery is in retrying status
	deliveries, _ := store.GetDeliveriesByEndpoint(ctx, endpoint.ID, 10)
	if len(deliveries) == 0 {
		t.Fatal("No deliveries found")
	}

	delivery := deliveries[0]
	if delivery.Status != StatusRetrying {
		t.Errorf("Delivery status = %v, want %v", delivery.Status, StatusRetrying)
	}
	if delivery.Attempts != 1 {
		t.Errorf("Delivery attempts = %d, want 1", delivery.Attempts)
	}
}

func TestService_GetHistory(t *testing.T) {
	store := NewInMemoryStore()
	config := DefaultServiceConfig()
	config.WorkerEnabled = false
	svc := NewService(store, config, nil)

	ctx := context.Background()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Register endpoint
	_, err := svc.Register(ctx, "merchant_123", server.URL, []EventType{EventPaymentSuccess})
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// Send events
	for i := 0; i < 3; i++ {
		event := NewEvent(EventPaymentSuccess, PaymentSuccessData{
			PaymentID: "pay_" + string(rune('1'+i)),
		})
		_ = svc.Send(ctx, event)
	}

	// Get history
	history, err := svc.GetHistory(ctx, "merchant_123", 10)
	if err != nil {
		t.Fatalf("GetHistory() error = %v", err)
	}
	if len(history) != 3 {
		t.Errorf("GetHistory() returned %d deliveries, want 3", len(history))
	}
}

func TestRetrySchedule(t *testing.T) {
	expected := []time.Duration{
		0,
		5 * time.Minute,
		30 * time.Minute,
		2 * time.Hour,
		24 * time.Hour,
	}

	if len(RetrySchedule) != len(expected) {
		t.Errorf("RetrySchedule length = %d, want %d", len(RetrySchedule), len(expected))
	}

	for i, exp := range expected {
		if RetrySchedule[i] != exp {
			t.Errorf("RetrySchedule[%d] = %v, want %v", i, RetrySchedule[i], exp)
		}
	}
}

func TestAllEvents(t *testing.T) {
	events := AllEvents()
	if len(events) != 5 {
		t.Errorf("AllEvents() returned %d events, want 5", len(events))
	}

	expectedEvents := map[EventType]bool{
		EventSubscriptionCreated:   true,
		EventSubscriptionCancelled: true,
		EventSubscriptionExpiring:  true,
		EventPaymentSuccess:        true,
		EventPaymentFailed:         true,
	}

	for _, e := range events {
		if !expectedEvents[e] {
			t.Errorf("Unexpected event type: %v", e)
		}
	}
}
