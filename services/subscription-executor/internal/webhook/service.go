package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"
)

// Service provides webhook management and delivery functionality.
type Service interface {
	// Endpoint management
	Register(ctx context.Context, merchantID string, webhookURL string, events []EventType) (*WebhookEndpoint, error)
	Unregister(ctx context.Context, endpointID string) error
	GetEndpoints(ctx context.Context, merchantID string) ([]*WebhookEndpoint, error)
	UpdateEndpoint(ctx context.Context, endpointID string, webhookURL string, events []EventType, active bool) error

	// Event sending
	Send(ctx context.Context, event *WebhookEvent) error
	SendAsync(event *WebhookEvent)

	// History
	GetHistory(ctx context.Context, merchantID string, limit int) ([]*WebhookDelivery, error)
	GetDeliveryStatus(ctx context.Context, deliveryID string) (*WebhookDelivery, error)
}

// ServiceConfig holds configuration for the webhook service.
type ServiceConfig struct {
	// HTTPTimeout is the timeout for webhook HTTP requests.
	HTTPTimeout time.Duration
	// MaxConcurrentDeliveries is the maximum number of concurrent deliveries.
	MaxConcurrentDeliveries int
	// WorkerEnabled enables the background delivery worker.
	WorkerEnabled bool
	// WorkerInterval is the interval for checking pending deliveries.
	WorkerInterval time.Duration
}

// DefaultServiceConfig returns a default service configuration.
func DefaultServiceConfig() ServiceConfig {
	return ServiceConfig{
		HTTPTimeout:             30 * time.Second,
		MaxConcurrentDeliveries: 10,
		WorkerEnabled:           true,
		WorkerInterval:          10 * time.Second,
	}
}

// webhookService implements the Service interface.
type webhookService struct {
	store      Store
	config     ServiceConfig
	httpClient *http.Client
	logger     *slog.Logger
	eventChan  chan *WebhookEvent
	stopChan   chan struct{}
}

// NewService creates a new webhook service.
func NewService(store Store, config ServiceConfig, logger *slog.Logger) Service {
	if logger == nil {
		logger = slog.Default()
	}

	svc := &webhookService{
		store:  store,
		config: config,
		httpClient: &http.Client{
			Timeout: config.HTTPTimeout,
		},
		logger:    logger.With("component", "webhook"),
		eventChan: make(chan *WebhookEvent, 1000),
		stopChan:  make(chan struct{}),
	}

	if config.WorkerEnabled {
		go svc.startWorker()
	}

	return svc
}

// Register creates a new webhook endpoint for a merchant.
func (s *webhookService) Register(ctx context.Context, merchantID string, webhookURL string, events []EventType) (*WebhookEndpoint, error) {
	// Validate URL
	if _, err := url.ParseRequestURI(webhookURL); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidURL, err)
	}

	// Validate events
	for _, e := range events {
		if !e.IsValid() {
			return nil, fmt.Errorf("%w: %s", ErrInvalidEvent, e)
		}
	}

	endpoint := &WebhookEndpoint{
		MerchantID: merchantID,
		URL:        webhookURL,
		Events:     events,
		Active:     true,
	}

	if err := s.store.CreateEndpoint(ctx, endpoint); err != nil {
		return nil, fmt.Errorf("failed to create endpoint: %w", err)
	}

	s.logger.Info("webhook endpoint registered",
		"endpoint_id", endpoint.ID,
		"merchant_id", merchantID,
		"events", events,
	)

	return endpoint, nil
}

// Unregister removes a webhook endpoint.
func (s *webhookService) Unregister(ctx context.Context, endpointID string) error {
	if err := s.store.DeleteEndpoint(ctx, endpointID); err != nil {
		return fmt.Errorf("failed to delete endpoint: %w", err)
	}

	s.logger.Info("webhook endpoint unregistered", "endpoint_id", endpointID)
	return nil
}

// GetEndpoints returns all webhook endpoints for a merchant.
func (s *webhookService) GetEndpoints(ctx context.Context, merchantID string) ([]*WebhookEndpoint, error) {
	return s.store.GetEndpointsByMerchant(ctx, merchantID)
}

// UpdateEndpoint updates a webhook endpoint.
func (s *webhookService) UpdateEndpoint(ctx context.Context, endpointID string, webhookURL string, events []EventType, active bool) error {
	endpoint, err := s.store.GetEndpoint(ctx, endpointID)
	if err != nil {
		return err
	}

	if webhookURL != "" {
		if _, err := url.ParseRequestURI(webhookURL); err != nil {
			return fmt.Errorf("%w: %v", ErrInvalidURL, err)
		}
		endpoint.URL = webhookURL
	}

	if len(events) > 0 {
		for _, e := range events {
			if !e.IsValid() {
				return fmt.Errorf("%w: %s", ErrInvalidEvent, e)
			}
		}
		endpoint.Events = events
	}

	endpoint.Active = active

	return s.store.UpdateEndpoint(ctx, endpoint)
}

// Send synchronously sends an event to all subscribed endpoints.
func (s *webhookService) Send(ctx context.Context, event *WebhookEvent) error {
	// Store the event
	if err := s.store.StoreEvent(ctx, event); err != nil {
		s.logger.Error("failed to store event", "error", err, "event_id", event.ID)
	}

	// Get all endpoints subscribed to this event type
	endpoints, err := s.store.GetEndpointsByEvent(ctx, event.Type)
	if err != nil {
		return fmt.Errorf("failed to get endpoints: %w", err)
	}

	if len(endpoints) == 0 {
		s.logger.Debug("no endpoints subscribed to event", "event_type", event.Type)
		return nil
	}

	// Send to each endpoint
	var lastErr error
	for _, endpoint := range endpoints {
		if err := s.deliverToEndpoint(ctx, event, endpoint); err != nil {
			s.logger.Error("failed to deliver webhook",
				"endpoint_id", endpoint.ID,
				"event_id", event.ID,
				"error", err,
			)
			lastErr = err
		}
	}

	return lastErr
}

// SendAsync queues an event for asynchronous delivery.
func (s *webhookService) SendAsync(event *WebhookEvent) {
	select {
	case s.eventChan <- event:
		s.logger.Debug("event queued for async delivery", "event_id", event.ID)
	default:
		s.logger.Warn("event channel full, dropping event", "event_id", event.ID)
	}
}

// GetHistory returns webhook delivery history for a merchant.
func (s *webhookService) GetHistory(ctx context.Context, merchantID string, limit int) ([]*WebhookDelivery, error) {
	endpoints, err := s.store.GetEndpointsByMerchant(ctx, merchantID)
	if err != nil {
		return nil, err
	}

	var allDeliveries []*WebhookDelivery
	for _, ep := range endpoints {
		deliveries, err := s.store.GetDeliveriesByEndpoint(ctx, ep.ID, limit)
		if err != nil {
			continue
		}
		allDeliveries = append(allDeliveries, deliveries...)
	}

	// Sort by created_at descending and limit
	// (In production, this would be done in the database query)
	if limit > 0 && len(allDeliveries) > limit {
		allDeliveries = allDeliveries[:limit]
	}

	return allDeliveries, nil
}

// GetDeliveryStatus returns the status of a specific delivery.
func (s *webhookService) GetDeliveryStatus(ctx context.Context, deliveryID string) (*WebhookDelivery, error) {
	return s.store.GetDelivery(ctx, deliveryID)
}

// deliverToEndpoint delivers an event to a specific endpoint.
func (s *webhookService) deliverToEndpoint(ctx context.Context, event *WebhookEvent, endpoint *WebhookEndpoint) error {
	// Create delivery record
	delivery := &WebhookDelivery{
		EndpointID:  endpoint.ID,
		EventID:     event.ID,
		EventType:   event.Type,
		Status:      StatusPending,
		Attempts:    0,
		MaxAttempts: MaxRetryAttempts,
	}

	if err := s.store.CreateDelivery(ctx, delivery); err != nil {
		return fmt.Errorf("failed to create delivery: %w", err)
	}

	// Attempt delivery
	return s.attemptDelivery(ctx, delivery, event, endpoint)
}

// attemptDelivery attempts to deliver an event to an endpoint.
func (s *webhookService) attemptDelivery(ctx context.Context, delivery *WebhookDelivery, event *WebhookEvent, endpoint *WebhookEndpoint) error {
	// Sign the event
	eventCopy := *event
	if err := eventCopy.Sign(endpoint.Secret); err != nil {
		return fmt.Errorf("failed to sign event: %w", err)
	}

	// Serialize event
	payload, err := json.Marshal(eventCopy)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.URL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Event", string(event.Type))
	req.Header.Set("X-Webhook-Signature", eventCopy.Signature)
	req.Header.Set("X-Webhook-ID", event.ID)
	req.Header.Set("X-Webhook-Timestamp", event.Timestamp.Format(time.RFC3339))

	// Update delivery attempt
	delivery.Attempts++
	delivery.LastAttempt = time.Now().UTC()

	// Send request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return s.handleDeliveryFailure(ctx, delivery, 0, "", err.Error())
	}
	defer resp.Body.Close()

	// Read response body (limited)
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	delivery.ResponseCode = resp.StatusCode
	delivery.ResponseBody = string(body)

	// Check for success (2xx)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return s.handleDeliverySuccess(ctx, delivery)
	}

	return s.handleDeliveryFailure(ctx, delivery, resp.StatusCode, string(body), "")
}

// handleDeliverySuccess marks a delivery as successful.
func (s *webhookService) handleDeliverySuccess(ctx context.Context, delivery *WebhookDelivery) error {
	now := time.Now().UTC()
	delivery.Status = StatusDelivered
	delivery.DeliveredAt = &now

	if err := s.store.UpdateDelivery(ctx, delivery); err != nil {
		return err
	}

	s.logger.Info("webhook delivered",
		"delivery_id", delivery.ID,
		"endpoint_id", delivery.EndpointID,
		"event_id", delivery.EventID,
		"attempts", delivery.Attempts,
	)

	return nil
}

// handleDeliveryFailure handles a failed delivery attempt.
func (s *webhookService) handleDeliveryFailure(ctx context.Context, delivery *WebhookDelivery, statusCode int, responseBody string, errorMsg string) error {
	delivery.ResponseCode = statusCode
	delivery.ResponseBody = responseBody
	delivery.ErrorMessage = errorMsg

	if delivery.Attempts >= delivery.MaxAttempts {
		delivery.Status = StatusFailed
		s.logger.Error("webhook delivery failed permanently",
			"delivery_id", delivery.ID,
			"endpoint_id", delivery.EndpointID,
			"event_id", delivery.EventID,
			"attempts", delivery.Attempts,
			"error", errorMsg,
		)
	} else {
		delivery.Status = StatusRetrying
		// Calculate next retry time based on schedule
		if delivery.Attempts < len(RetrySchedule) {
			delivery.NextRetry = time.Now().UTC().Add(RetrySchedule[delivery.Attempts])
		} else {
			delivery.NextRetry = time.Now().UTC().Add(RetrySchedule[len(RetrySchedule)-1])
		}
		s.logger.Warn("webhook delivery failed, will retry",
			"delivery_id", delivery.ID,
			"endpoint_id", delivery.EndpointID,
			"event_id", delivery.EventID,
			"attempts", delivery.Attempts,
			"next_retry", delivery.NextRetry,
		)
	}

	return s.store.UpdateDelivery(ctx, delivery)
}

// startWorker starts the background delivery worker.
func (s *webhookService) startWorker() {
	ticker := time.NewTicker(s.config.WorkerInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case event := <-s.eventChan:
			s.processAsyncEvent(event)
		case <-ticker.C:
			s.processPendingDeliveries()
		}
	}
}

// processAsyncEvent processes an asynchronously queued event.
func (s *webhookService) processAsyncEvent(event *WebhookEvent) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := s.Send(ctx, event); err != nil {
		s.logger.Error("failed to send async event", "event_id", event.ID, "error", err)
	}
}

// processPendingDeliveries retries pending deliveries.
func (s *webhookService) processPendingDeliveries() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	deliveries, err := s.store.GetPendingDeliveries(ctx, s.config.MaxConcurrentDeliveries)
	if err != nil {
		s.logger.Error("failed to get pending deliveries", "error", err)
		return
	}

	for _, delivery := range deliveries {
		s.retryDelivery(ctx, delivery)
	}
}

// retryDelivery retries a failed delivery.
func (s *webhookService) retryDelivery(ctx context.Context, delivery *WebhookDelivery) {
	// Get the original event
	event, err := s.store.GetEvent(ctx, delivery.EventID)
	if err != nil {
		s.logger.Error("failed to get event for retry", "delivery_id", delivery.ID, "error", err)
		return
	}

	// Get the endpoint
	endpoint, err := s.store.GetEndpoint(ctx, delivery.EndpointID)
	if err != nil {
		s.logger.Error("failed to get endpoint for retry", "delivery_id", delivery.ID, "error", err)
		return
	}

	// Attempt delivery
	if err := s.attemptDelivery(ctx, delivery, event, endpoint); err != nil {
		s.logger.Error("retry delivery failed", "delivery_id", delivery.ID, "error", err)
	}
}

// Stop stops the webhook service worker.
func (s *webhookService) Stop() {
	close(s.stopChan)
}
