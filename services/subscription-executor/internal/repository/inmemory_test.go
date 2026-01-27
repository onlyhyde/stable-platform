package repository

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/stablenet/stable-platform/services/subscription-executor/internal/model"
)

func TestNewInMemoryRepository(t *testing.T) {
	repo := NewInMemoryRepository()
	if repo == nil {
		t.Fatal("expected repository to be created")
	}
	if repo.subscriptions == nil {
		t.Fatal("expected subscriptions map to be initialized")
	}
	if repo.executionRecords == nil {
		t.Fatal("expected executionRecords map to be initialized")
	}
}

func TestInMemoryRepository_Create(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	sub := &model.Subscription{
		ID:            "sub_123",
		SmartAccount:  "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:         "0x9876543210fedcba9876543210fedcba98765432",
		Amount:        big.NewInt(1000000),
		Interval:      86400 * 30,
		NextExecution: time.Now().Add(30 * 24 * time.Hour),
		Status:        model.StatusActive,
		CreatedAt:     time.Now(),
	}

	err := repo.Create(ctx, sub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify subscription was stored
	stored, err := repo.GetByID(ctx, "sub_123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stored == nil {
		t.Fatal("expected subscription to be found")
	}
	if stored.ID != "sub_123" {
		t.Errorf("ID = %s, want sub_123", stored.ID)
	}
}

func TestInMemoryRepository_GetByID(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	// Test non-existent
	sub, err := repo.GetByID(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sub != nil {
		t.Error("expected nil for non-existent subscription")
	}

	// Create and retrieve
	newSub := &model.Subscription{
		ID:            "sub_456",
		SmartAccount:  "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:         "0x9876543210fedcba9876543210fedcba98765432",
		Amount:        big.NewInt(500000),
		Interval:      86400 * 7,
		NextExecution: time.Now(),
		Status:        model.StatusActive,
		CreatedAt:     time.Now(),
	}

	_ = repo.Create(ctx, newSub)

	sub, err = repo.GetByID(ctx, "sub_456")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sub == nil {
		t.Fatal("expected subscription to be found")
	}
	if sub.Amount.Cmp(big.NewInt(500000)) != 0 {
		t.Errorf("Amount = %s, want 500000", sub.Amount)
	}
}

func TestInMemoryRepository_GetByAccount(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	account := "0xaabbccdd1234567890abcdef1234567890abcdef"

	// Create multiple subscriptions for same account
	for i := 0; i < 3; i++ {
		sub := &model.Subscription{
			ID:            "sub_" + string(rune('a'+i)),
			SmartAccount:  account,
			Recipient:     "0xabcdef1234567890abcdef1234567890abcdef12",
			Token:         "0x9876543210fedcba9876543210fedcba98765432",
			Amount:        big.NewInt(1000000),
			Interval:      86400,
			NextExecution: time.Now(),
			Status:        model.StatusActive,
			CreatedAt:     time.Now(),
		}
		_ = repo.Create(ctx, sub)
	}

	// Create subscription for different account
	otherSub := &model.Subscription{
		ID:            "sub_other",
		SmartAccount:  "0x0000000000000000000000000000000000000001",
		Recipient:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:         "0x9876543210fedcba9876543210fedcba98765432",
		Amount:        big.NewInt(1000000),
		Interval:      86400,
		NextExecution: time.Now(),
		Status:        model.StatusActive,
		CreatedAt:     time.Now(),
	}
	_ = repo.Create(ctx, otherSub)

	// Get by account
	subs, err := repo.GetByAccount(ctx, account)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(subs) != 3 {
		t.Errorf("expected 3 subscriptions, got %d", len(subs))
	}
}

func TestInMemoryRepository_Update(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	sub := &model.Subscription{
		ID:            "sub_update",
		SmartAccount:  "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:         "0x9876543210fedcba9876543210fedcba98765432",
		Amount:        big.NewInt(1000000),
		Interval:      86400,
		NextExecution: time.Now(),
		Status:        model.StatusActive,
		CreatedAt:     time.Now(),
	}

	_ = repo.Create(ctx, sub)

	// Update
	sub.Amount = big.NewInt(2000000)
	sub.ExecutionCount = 5

	err := repo.Update(ctx, sub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify update
	updated, _ := repo.GetByID(ctx, "sub_update")
	if updated.Amount.Cmp(big.NewInt(2000000)) != 0 {
		t.Errorf("Amount = %s, want 2000000", updated.Amount)
	}
	if updated.ExecutionCount != 5 {
		t.Errorf("ExecutionCount = %d, want 5", updated.ExecutionCount)
	}
}

func TestInMemoryRepository_Update_NotFound(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	sub := &model.Subscription{
		ID:     "nonexistent",
		Amount: big.NewInt(1000),
	}

	err := repo.Update(ctx, sub)
	if err == nil {
		t.Fatal("expected error for non-existent subscription")
	}
}

func TestInMemoryRepository_UpdateStatus(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	sub := &model.Subscription{
		ID:            "sub_status",
		SmartAccount:  "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:         "0x9876543210fedcba9876543210fedcba98765432",
		Amount:        big.NewInt(1000000),
		Interval:      86400,
		NextExecution: time.Now(),
		Status:        model.StatusActive,
		CreatedAt:     time.Now(),
	}

	_ = repo.Create(ctx, sub)

	// Update status
	err := repo.UpdateStatus(ctx, "sub_status", model.StatusPaused)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify
	updated, _ := repo.GetByID(ctx, "sub_status")
	if updated.Status != model.StatusPaused {
		t.Errorf("Status = %s, want paused", updated.Status)
	}
}

func TestInMemoryRepository_UpdateStatus_NotFound(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	err := repo.UpdateStatus(ctx, "nonexistent", model.StatusPaused)
	if err == nil {
		t.Fatal("expected error for non-existent subscription")
	}
}

func TestInMemoryRepository_GetDueSubscriptions(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()
	now := time.Now()

	// Create due subscription
	dueSub := &model.Subscription{
		ID:             "sub_due",
		SmartAccount:   "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:      "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:          "0x9876543210fedcba9876543210fedcba98765432",
		Amount:         big.NewInt(1000000),
		Interval:       86400,
		NextExecution:  now.Add(-1 * time.Hour), // Past due
		Status:         model.StatusActive,
		MaxExecutions:  0,
		ExecutionCount: 0,
		CreatedAt:      now,
	}
	_ = repo.Create(ctx, dueSub)

	// Create not due subscription
	notDueSub := &model.Subscription{
		ID:             "sub_notdue",
		SmartAccount:   "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:      "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:          "0x9876543210fedcba9876543210fedcba98765432",
		Amount:         big.NewInt(1000000),
		Interval:       86400,
		NextExecution:  now.Add(1 * time.Hour), // Future
		Status:         model.StatusActive,
		MaxExecutions:  0,
		ExecutionCount: 0,
		CreatedAt:      now,
	}
	_ = repo.Create(ctx, notDueSub)

	// Create paused subscription
	pausedSub := &model.Subscription{
		ID:             "sub_paused",
		SmartAccount:   "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:      "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:          "0x9876543210fedcba9876543210fedcba98765432",
		Amount:         big.NewInt(1000000),
		Interval:       86400,
		NextExecution:  now.Add(-1 * time.Hour), // Past due but paused
		Status:         model.StatusPaused,
		MaxExecutions:  0,
		ExecutionCount: 0,
		CreatedAt:      now,
	}
	_ = repo.Create(ctx, pausedSub)

	// Create max executions reached
	maxedSub := &model.Subscription{
		ID:             "sub_maxed",
		SmartAccount:   "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:      "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:          "0x9876543210fedcba9876543210fedcba98765432",
		Amount:         big.NewInt(1000000),
		Interval:       86400,
		NextExecution:  now.Add(-1 * time.Hour), // Past due but maxed
		Status:         model.StatusActive,
		MaxExecutions:  5,
		ExecutionCount: 5,
		CreatedAt:      now,
	}
	_ = repo.Create(ctx, maxedSub)

	// Get due subscriptions
	due, err := repo.GetDueSubscriptions(ctx, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(due) != 1 {
		t.Errorf("expected 1 due subscription, got %d", len(due))
	}
	if len(due) > 0 && due[0].ID != "sub_due" {
		t.Errorf("expected sub_due, got %s", due[0].ID)
	}
}

func TestInMemoryRepository_GetDueSubscriptions_Limit(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()
	now := time.Now()

	// Create 5 due subscriptions
	for i := 0; i < 5; i++ {
		sub := &model.Subscription{
			ID:             "sub_" + string(rune('a'+i)),
			SmartAccount:   "0x1234567890abcdef1234567890abcdef12345678",
			Recipient:      "0xabcdef1234567890abcdef1234567890abcdef12",
			Token:          "0x9876543210fedcba9876543210fedcba98765432",
			Amount:         big.NewInt(1000000),
			Interval:       86400,
			NextExecution:  now.Add(-1 * time.Hour),
			Status:         model.StatusActive,
			MaxExecutions:  0,
			ExecutionCount: 0,
			CreatedAt:      now,
		}
		_ = repo.Create(ctx, sub)
	}

	// Get with limit 3
	due, err := repo.GetDueSubscriptions(ctx, 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(due) != 3 {
		t.Errorf("expected 3 due subscriptions (limit), got %d", len(due))
	}
}

func TestInMemoryRepository_ExecutionRecords(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	// Create execution record
	record := &model.ExecutionRecord{
		SubscriptionID: "sub_123",
		UserOpHash:     "0xuserop123",
		Status:         "pending",
		CreatedAt:      time.Now(),
	}

	err := repo.CreateExecutionRecord(ctx, record)
	if err != nil {
		t.Fatalf("unexpected error creating record: %v", err)
	}

	// Verify ID was assigned
	if record.ID == "" {
		t.Error("expected ID to be assigned")
	}

	// Get execution records
	records, err := repo.GetExecutionRecords(ctx, "sub_123", 10)
	if err != nil {
		t.Fatalf("unexpected error getting records: %v", err)
	}
	if len(records) != 1 {
		t.Errorf("expected 1 record, got %d", len(records))
	}
}

func TestInMemoryRepository_UpdateExecutionRecord(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	// Create execution record
	record := &model.ExecutionRecord{
		SubscriptionID: "sub_123",
		UserOpHash:     "0xuserop123",
		Status:         "pending",
		CreatedAt:      time.Now(),
	}

	_ = repo.CreateExecutionRecord(ctx, record)

	// Update record
	err := repo.UpdateExecutionRecord(ctx, 1, "success", "0xtxhash456", "", "150000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify update
	records, _ := repo.GetExecutionRecords(ctx, "sub_123", 10)
	if len(records) == 0 {
		t.Fatal("expected records")
	}
	if records[0].Status != "success" {
		t.Errorf("Status = %s, want success", records[0].Status)
	}
	if records[0].TxHash != "0xtxhash456" {
		t.Errorf("TxHash = %s, want 0xtxhash456", records[0].TxHash)
	}
}

func TestInMemoryRepository_UpdateExecutionRecord_NotFound(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	err := repo.UpdateExecutionRecord(ctx, 999, "success", "0xtx", "", "")
	if err == nil {
		t.Fatal("expected error for non-existent record")
	}
}

func TestInMemoryRepository_GetExecutionRecords_Limit(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	// Create 5 records
	for i := 0; i < 5; i++ {
		record := &model.ExecutionRecord{
			SubscriptionID: "sub_123",
			UserOpHash:     "0xuserop",
			Status:         "success",
			CreatedAt:      time.Now(),
		}
		_ = repo.CreateExecutionRecord(ctx, record)
	}

	// Get with limit 3
	records, err := repo.GetExecutionRecords(ctx, "sub_123", 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 3 {
		t.Errorf("expected 3 records (limit), got %d", len(records))
	}
}

func TestInMemoryRepository_Ping(t *testing.T) {
	repo := NewInMemoryRepository()
	ctx := context.Background()

	err := repo.Ping(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestInMemoryRepository_Close(t *testing.T) {
	repo := NewInMemoryRepository()

	// Should not panic
	repo.Close()
}
