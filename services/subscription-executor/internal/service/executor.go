package service

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/stablenet/stable-platform/services/subscription-executor/internal/config"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/model"
)

// ExecutorService handles subscription execution
type ExecutorService struct {
	cfg           *config.Config
	subscriptions map[string]*model.Subscription
	mu            sync.RWMutex
	stopCh        chan struct{}
}

// NewExecutorService creates a new executor service
func NewExecutorService(cfg *config.Config) *ExecutorService {
	return &ExecutorService{
		cfg:           cfg,
		subscriptions: make(map[string]*model.Subscription),
		stopCh:        make(chan struct{}),
	}
}

// Start begins the subscription polling loop
func (s *ExecutorService) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(s.cfg.PollingInterval) * time.Second)
	defer ticker.Stop()

	log.Printf("Starting executor service with polling interval: %d seconds", s.cfg.PollingInterval)

	for {
		select {
		case <-ctx.Done():
			log.Println("Executor service stopped due to context cancellation")
			return
		case <-s.stopCh:
			log.Println("Executor service stopped")
			return
		case <-ticker.C:
			s.processDueSubscriptions(ctx)
		}
	}
}

// Stop stops the executor service
func (s *ExecutorService) Stop() {
	close(s.stopCh)
}

// CreateSubscription creates a new subscription
func (s *ExecutorService) CreateSubscription(req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", req.Amount)
	}

	now := time.Now()
	sub := &model.Subscription{
		ID:             generateID(),
		SmartAccount:   req.SmartAccount,
		Recipient:      req.Recipient,
		Token:          req.Token,
		Amount:         amount,
		Interval:       int64(req.IntervalDays) * 86400,
		NextExecution:  now.Add(time.Duration(req.IntervalDays) * 24 * time.Hour),
		ExecutionCount: 0,
		MaxExecutions:  req.MaxExecutions,
		Status:         model.StatusActive,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	s.mu.Lock()
	s.subscriptions[sub.ID] = sub
	s.mu.Unlock()

	log.Printf("Created subscription: %s for account: %s", sub.ID, sub.SmartAccount)
	return sub, nil
}

// GetSubscription returns a subscription by ID
func (s *ExecutorService) GetSubscription(id string) (*model.Subscription, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sub, exists := s.subscriptions[id]
	if !exists {
		return nil, fmt.Errorf("subscription not found: %s", id)
	}
	return sub, nil
}

// GetSubscriptionsByAccount returns all subscriptions for an account
func (s *ExecutorService) GetSubscriptionsByAccount(account string) []*model.Subscription {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*model.Subscription
	for _, sub := range s.subscriptions {
		if sub.SmartAccount == account {
			result = append(result, sub)
		}
	}
	return result
}

// CancelSubscription cancels a subscription
func (s *ExecutorService) CancelSubscription(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sub, exists := s.subscriptions[id]
	if !exists {
		return fmt.Errorf("subscription not found: %s", id)
	}

	sub.Status = model.StatusCancelled
	sub.UpdatedAt = time.Now()
	log.Printf("Cancelled subscription: %s", id)
	return nil
}

// PauseSubscription pauses a subscription
func (s *ExecutorService) PauseSubscription(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sub, exists := s.subscriptions[id]
	if !exists {
		return fmt.Errorf("subscription not found: %s", id)
	}

	sub.Status = model.StatusPaused
	sub.UpdatedAt = time.Now()
	log.Printf("Paused subscription: %s", id)
	return nil
}

// ResumeSubscription resumes a paused subscription
func (s *ExecutorService) ResumeSubscription(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sub, exists := s.subscriptions[id]
	if !exists {
		return fmt.Errorf("subscription not found: %s", id)
	}

	if sub.Status != model.StatusPaused {
		return fmt.Errorf("subscription is not paused: %s", id)
	}

	sub.Status = model.StatusActive
	sub.UpdatedAt = time.Now()
	log.Printf("Resumed subscription: %s", id)
	return nil
}

// processDueSubscriptions processes all subscriptions that are due
func (s *ExecutorService) processDueSubscriptions(ctx context.Context) {
	s.mu.RLock()
	var dueSubscriptions []*model.Subscription
	for _, sub := range s.subscriptions {
		if sub.IsDue() {
			dueSubscriptions = append(dueSubscriptions, sub)
		}
	}
	s.mu.RUnlock()

	if len(dueSubscriptions) == 0 {
		return
	}

	log.Printf("Found %d due subscriptions", len(dueSubscriptions))

	for _, sub := range dueSubscriptions {
		if err := s.executeSubscription(ctx, sub); err != nil {
			log.Printf("Failed to execute subscription %s: %v", sub.ID, err)
		}
	}
}

// executeSubscription executes a single subscription payment
func (s *ExecutorService) executeSubscription(ctx context.Context, sub *model.Subscription) error {
	log.Printf("Executing subscription: %s", sub.ID)

	// TODO: Build and submit UserOperation via bundler
	// 1. Build calldata for ERC20 transfer or RecurringPaymentExecutor
	// 2. Create UserOperation
	// 3. Get paymaster signature
	// 4. Submit to bundler
	// 5. Wait for receipt

	// For now, simulate execution
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	sub.LastExecution = &now
	sub.ExecutionCount++
	sub.NextExecution = now.Add(time.Duration(sub.Interval) * time.Second)
	sub.UpdatedAt = now

	// Check if max executions reached
	if sub.MaxExecutions > 0 && sub.ExecutionCount >= sub.MaxExecutions {
		sub.Status = model.StatusExpired
		log.Printf("Subscription %s reached max executions", sub.ID)
	}

	log.Printf("Successfully executed subscription: %s (count: %d)", sub.ID, sub.ExecutionCount)
	return nil
}

// generateID generates a unique ID
func generateID() string {
	return fmt.Sprintf("sub_%d", time.Now().UnixNano())
}
