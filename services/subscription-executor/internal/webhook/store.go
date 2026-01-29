package webhook

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

// Common errors
var (
	ErrEndpointNotFound = errors.New("webhook endpoint not found")
	ErrDeliveryNotFound = errors.New("webhook delivery not found")
	ErrInvalidURL       = errors.New("invalid webhook URL")
	ErrInvalidEvent     = errors.New("invalid event type")
)

// Store defines the interface for webhook persistence.
type Store interface {
	// Endpoint operations
	CreateEndpoint(ctx context.Context, endpoint *WebhookEndpoint) error
	GetEndpoint(ctx context.Context, id string) (*WebhookEndpoint, error)
	GetEndpointsByMerchant(ctx context.Context, merchantID string) ([]*WebhookEndpoint, error)
	GetEndpointsByEvent(ctx context.Context, eventType EventType) ([]*WebhookEndpoint, error)
	UpdateEndpoint(ctx context.Context, endpoint *WebhookEndpoint) error
	DeleteEndpoint(ctx context.Context, id string) error

	// Delivery operations
	CreateDelivery(ctx context.Context, delivery *WebhookDelivery) error
	GetDelivery(ctx context.Context, id string) (*WebhookDelivery, error)
	GetDeliveriesByEndpoint(ctx context.Context, endpointID string, limit int) ([]*WebhookDelivery, error)
	GetPendingDeliveries(ctx context.Context, limit int) ([]*WebhookDelivery, error)
	UpdateDelivery(ctx context.Context, delivery *WebhookDelivery) error

	// Event operations
	StoreEvent(ctx context.Context, event *WebhookEvent) error
	GetEvent(ctx context.Context, id string) (*WebhookEvent, error)
}

// InMemoryStore implements Store with in-memory storage for development/testing.
type InMemoryStore struct {
	mu         sync.RWMutex
	endpoints  map[string]*WebhookEndpoint
	deliveries map[string]*WebhookDelivery
	events     map[string]*WebhookEvent
}

// NewInMemoryStore creates a new in-memory store.
func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		endpoints:  make(map[string]*WebhookEndpoint),
		deliveries: make(map[string]*WebhookDelivery),
		events:     make(map[string]*WebhookEvent),
	}
}

// CreateEndpoint creates a new webhook endpoint.
func (s *InMemoryStore) CreateEndpoint(ctx context.Context, endpoint *WebhookEndpoint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if endpoint.ID == "" {
		endpoint.ID = generateID("ep")
	}
	if endpoint.Secret == "" {
		endpoint.Secret = generateSecret()
	}
	endpoint.CreatedAt = time.Now().UTC()
	endpoint.UpdatedAt = endpoint.CreatedAt

	s.endpoints[endpoint.ID] = endpoint
	return nil
}

// GetEndpoint retrieves an endpoint by ID.
func (s *InMemoryStore) GetEndpoint(ctx context.Context, id string) (*WebhookEndpoint, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	endpoint, ok := s.endpoints[id]
	if !ok {
		return nil, ErrEndpointNotFound
	}
	return endpoint, nil
}

// GetEndpointsByMerchant retrieves all endpoints for a merchant.
func (s *InMemoryStore) GetEndpointsByMerchant(ctx context.Context, merchantID string) ([]*WebhookEndpoint, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*WebhookEndpoint
	for _, ep := range s.endpoints {
		if ep.MerchantID == merchantID && ep.Active {
			result = append(result, ep)
		}
	}
	return result, nil
}

// GetEndpointsByEvent retrieves all active endpoints subscribed to an event type.
func (s *InMemoryStore) GetEndpointsByEvent(ctx context.Context, eventType EventType) ([]*WebhookEndpoint, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*WebhookEndpoint
	for _, ep := range s.endpoints {
		if ep.Active && ep.HasEvent(eventType) {
			result = append(result, ep)
		}
	}
	return result, nil
}

// UpdateEndpoint updates an existing endpoint.
func (s *InMemoryStore) UpdateEndpoint(ctx context.Context, endpoint *WebhookEndpoint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.endpoints[endpoint.ID]; !ok {
		return ErrEndpointNotFound
	}
	endpoint.UpdatedAt = time.Now().UTC()
	s.endpoints[endpoint.ID] = endpoint
	return nil
}

// DeleteEndpoint deletes an endpoint.
func (s *InMemoryStore) DeleteEndpoint(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.endpoints[id]; !ok {
		return ErrEndpointNotFound
	}
	delete(s.endpoints, id)
	return nil
}

// CreateDelivery creates a new delivery record.
func (s *InMemoryStore) CreateDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if delivery.ID == "" {
		delivery.ID = generateID("dlv")
	}
	delivery.CreatedAt = time.Now().UTC()
	s.deliveries[delivery.ID] = delivery
	return nil
}

// GetDelivery retrieves a delivery by ID.
func (s *InMemoryStore) GetDelivery(ctx context.Context, id string) (*WebhookDelivery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	delivery, ok := s.deliveries[id]
	if !ok {
		return nil, ErrDeliveryNotFound
	}
	return delivery, nil
}

// GetDeliveriesByEndpoint retrieves deliveries for an endpoint.
func (s *InMemoryStore) GetDeliveriesByEndpoint(ctx context.Context, endpointID string, limit int) ([]*WebhookDelivery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*WebhookDelivery
	for _, d := range s.deliveries {
		if d.EndpointID == endpointID {
			result = append(result, d)
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

// GetPendingDeliveries retrieves deliveries that need to be retried.
func (s *InMemoryStore) GetPendingDeliveries(ctx context.Context, limit int) ([]*WebhookDelivery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now().UTC()
	var result []*WebhookDelivery
	for _, d := range s.deliveries {
		if d.Status == StatusPending || (d.Status == StatusRetrying && d.NextRetry.Before(now)) {
			result = append(result, d)
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

// UpdateDelivery updates a delivery record.
func (s *InMemoryStore) UpdateDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.deliveries[delivery.ID]; !ok {
		return ErrDeliveryNotFound
	}
	s.deliveries[delivery.ID] = delivery
	return nil
}

// StoreEvent stores a webhook event.
func (s *InMemoryStore) StoreEvent(ctx context.Context, event *WebhookEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.events[event.ID] = event
	return nil
}

// GetEvent retrieves an event by ID.
func (s *InMemoryStore) GetEvent(ctx context.Context, id string) (*WebhookEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	event, ok := s.events[id]
	if !ok {
		return nil, errors.New("event not found")
	}
	return event, nil
}

// Helper functions

func generateID(prefix string) string {
	b := make([]byte, 12)
	rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

func generateSecret() string {
	b := make([]byte, 32)
	rand.Read(b)
	return "whsec_" + hex.EncodeToString(b)
}
