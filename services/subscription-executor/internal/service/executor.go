package service

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/stablenet/stable-platform/services/subscription-executor/internal/config"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/model"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/repository"
)

// ExecutorService handles subscription execution
type ExecutorService struct {
	cfg    *config.Config
	repo   repository.SubscriptionRepository
	stopCh chan struct{}
}

// NewExecutorService creates a new executor service with the given repository
func NewExecutorService(cfg *config.Config, repo repository.SubscriptionRepository) *ExecutorService {
	return &ExecutorService{
		cfg:    cfg,
		repo:   repo,
		stopCh: make(chan struct{}),
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
func (s *ExecutorService) CreateSubscription(ctx context.Context, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
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

	if err := s.repo.Create(ctx, sub); err != nil {
		return nil, fmt.Errorf("failed to save subscription: %w", err)
	}

	log.Printf("Created subscription: %s for account: %s", sub.ID, sub.SmartAccount)
	return sub, nil
}

// GetSubscription returns a subscription by ID
func (s *ExecutorService) GetSubscription(ctx context.Context, id string) (*model.Subscription, error) {
	sub, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found: %s", id)
	}
	return sub, nil
}

// GetSubscriptionsByAccount returns all subscriptions for an account
func (s *ExecutorService) GetSubscriptionsByAccount(ctx context.Context, account string) ([]*model.Subscription, error) {
	subs, err := s.repo.GetByAccount(ctx, account)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscriptions: %w", err)
	}
	return subs, nil
}

// CancelSubscription cancels a subscription
func (s *ExecutorService) CancelSubscription(ctx context.Context, id string) error {
	if err := s.repo.UpdateStatus(ctx, id, model.StatusCancelled); err != nil {
		return fmt.Errorf("failed to cancel subscription: %w", err)
	}
	log.Printf("Cancelled subscription: %s", id)
	return nil
}

// PauseSubscription pauses a subscription
func (s *ExecutorService) PauseSubscription(ctx context.Context, id string) error {
	if err := s.repo.UpdateStatus(ctx, id, model.StatusPaused); err != nil {
		return fmt.Errorf("failed to pause subscription: %w", err)
	}
	log.Printf("Paused subscription: %s", id)
	return nil
}

// ResumeSubscription resumes a paused subscription
func (s *ExecutorService) ResumeSubscription(ctx context.Context, id string) error {
	sub, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return fmt.Errorf("subscription not found: %s", id)
	}
	if sub.Status != model.StatusPaused {
		return fmt.Errorf("subscription is not paused: %s", id)
	}

	if err := s.repo.UpdateStatus(ctx, id, model.StatusActive); err != nil {
		return fmt.Errorf("failed to resume subscription: %w", err)
	}
	log.Printf("Resumed subscription: %s", id)
	return nil
}

// processDueSubscriptions processes all subscriptions that are due
func (s *ExecutorService) processDueSubscriptions(ctx context.Context) {
	// Use GetDueSubscriptions for read-only check
	// In production, consider using GetDueSubscriptionsWithLock for concurrent workers
	dueSubscriptions, err := s.repo.GetDueSubscriptions(ctx, 100)
	if err != nil {
		log.Printf("Failed to get due subscriptions: %v", err)
		return
	}

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

	// Create execution record
	record := &model.ExecutionRecord{
		SubscriptionID: sub.ID,
		Status:         "pending",
		CreatedAt:      time.Now(),
	}
	if err := s.repo.CreateExecutionRecord(ctx, record); err != nil {
		log.Printf("Failed to create execution record: %v", err)
		// Continue with execution even if record creation fails
	}

	// TODO: Build and submit UserOperation via bundler
	// 1. Build calldata for ERC20 transfer or RecurringPaymentExecutor
	// 2. Create UserOperation
	// 3. Get paymaster signature
	// 4. Submit to bundler
	// 5. Wait for receipt

	// For now, simulate execution
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

	// Update subscription in database
	if err := s.repo.Update(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	// Update execution record as success
	// TODO: In production, update with actual txHash and gasUsed
	// For now, we'll skip updating since we don't have the record ID readily available

	log.Printf("Successfully executed subscription: %s (count: %d)", sub.ID, sub.ExecutionCount)
	return nil
}

// generateID generates a unique ID
func generateID() string {
	return fmt.Sprintf("sub_%d", time.Now().UnixNano())
}
