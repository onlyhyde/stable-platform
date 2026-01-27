package model

import (
	"math/big"
	"testing"
	"time"
)

func TestSubscriptionStatus_Constants(t *testing.T) {
	// Verify status constants are defined correctly
	tests := []struct {
		status SubscriptionStatus
		want   string
	}{
		{StatusActive, "active"},
		{StatusPaused, "paused"},
		{StatusCancelled, "cancelled"},
		{StatusExpired, "expired"},
	}

	for _, tt := range tests {
		if string(tt.status) != tt.want {
			t.Errorf("status %v = %s, want %s", tt.status, tt.status, tt.want)
		}
	}
}

func TestSubscription_IsDue(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name string
		sub  *Subscription
		want bool
	}{
		{
			name: "active and past next execution",
			sub: &Subscription{
				Status:         StatusActive,
				NextExecution:  now.Add(-1 * time.Hour),
				MaxExecutions:  0,
				ExecutionCount: 0,
			},
			want: true,
		},
		{
			name: "active but not yet due",
			sub: &Subscription{
				Status:         StatusActive,
				NextExecution:  now.Add(1 * time.Hour),
				MaxExecutions:  0,
				ExecutionCount: 0,
			},
			want: false,
		},
		{
			name: "paused subscription",
			sub: &Subscription{
				Status:         StatusPaused,
				NextExecution:  now.Add(-1 * time.Hour),
				MaxExecutions:  0,
				ExecutionCount: 0,
			},
			want: false,
		},
		{
			name: "cancelled subscription",
			sub: &Subscription{
				Status:         StatusCancelled,
				NextExecution:  now.Add(-1 * time.Hour),
				MaxExecutions:  0,
				ExecutionCount: 0,
			},
			want: false,
		},
		{
			name: "expired subscription",
			sub: &Subscription{
				Status:         StatusExpired,
				NextExecution:  now.Add(-1 * time.Hour),
				MaxExecutions:  0,
				ExecutionCount: 0,
			},
			want: false,
		},
		{
			name: "max executions reached",
			sub: &Subscription{
				Status:         StatusActive,
				NextExecution:  now.Add(-1 * time.Hour),
				MaxExecutions:  5,
				ExecutionCount: 5,
			},
			want: false,
		},
		{
			name: "below max executions",
			sub: &Subscription{
				Status:         StatusActive,
				NextExecution:  now.Add(-1 * time.Hour),
				MaxExecutions:  5,
				ExecutionCount: 3,
			},
			want: true,
		},
		{
			name: "unlimited executions (max=0)",
			sub: &Subscription{
				Status:         StatusActive,
				NextExecution:  now.Add(-1 * time.Hour),
				MaxExecutions:  0, // unlimited
				ExecutionCount: 100,
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.sub.IsDue(); got != tt.want {
				t.Errorf("IsDue() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSubscription_ToResponse(t *testing.T) {
	now := time.Now()
	lastExec := now.Add(-24 * time.Hour)

	sub := &Subscription{
		ID:             "sub_123",
		SmartAccount:   "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:      "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:          "0x9876543210fedcba9876543210fedcba98765432",
		Amount:         big.NewInt(1000000),
		Interval:       86400 * 30, // 30 days in seconds
		NextExecution:  now,
		LastExecution:  &lastExec,
		ExecutionCount: 5,
		MaxExecutions:  12,
		Status:         StatusActive,
		CreatedAt:      now.Add(-90 * 24 * time.Hour),
	}

	resp := sub.ToResponse()

	// Verify basic fields
	if resp.ID != sub.ID {
		t.Errorf("ID = %s, want %s", resp.ID, sub.ID)
	}
	if resp.SmartAccount != sub.SmartAccount {
		t.Errorf("SmartAccount = %s, want %s", resp.SmartAccount, sub.SmartAccount)
	}
	if resp.Recipient != sub.Recipient {
		t.Errorf("Recipient = %s, want %s", resp.Recipient, sub.Recipient)
	}
	if resp.Token != sub.Token {
		t.Errorf("Token = %s, want %s", resp.Token, sub.Token)
	}
	if resp.Amount != "1000000" {
		t.Errorf("Amount = %s, want 1000000", resp.Amount)
	}
	if resp.IntervalDays != 30 {
		t.Errorf("IntervalDays = %d, want 30", resp.IntervalDays)
	}
	if resp.ExecutionCount != 5 {
		t.Errorf("ExecutionCount = %d, want 5", resp.ExecutionCount)
	}
	if resp.MaxExecutions != 12 {
		t.Errorf("MaxExecutions = %d, want 12", resp.MaxExecutions)
	}
	if resp.Status != "active" {
		t.Errorf("Status = %s, want active", resp.Status)
	}
	if resp.LastExecution == "" {
		t.Error("LastExecution should not be empty when set")
	}
}

func TestSubscription_ToResponse_NoLastExecution(t *testing.T) {
	now := time.Now()

	sub := &Subscription{
		ID:             "sub_456",
		SmartAccount:   "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:      "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:          "0x9876543210fedcba9876543210fedcba98765432",
		Amount:         big.NewInt(500000),
		Interval:       86400 * 7, // 7 days
		NextExecution:  now,
		LastExecution:  nil, // No execution yet
		ExecutionCount: 0,
		MaxExecutions:  0,
		Status:         StatusActive,
		CreatedAt:      now,
	}

	resp := sub.ToResponse()

	if resp.LastExecution != "" {
		t.Errorf("LastExecution = %s, want empty string", resp.LastExecution)
	}
	if resp.IntervalDays != 7 {
		t.Errorf("IntervalDays = %d, want 7", resp.IntervalDays)
	}
}

func TestSubscription_IntervalConversion(t *testing.T) {
	tests := []struct {
		intervalSeconds int64
		wantDays        int
	}{
		{86400, 1},      // 1 day
		{86400 * 7, 7},  // 7 days
		{86400 * 30, 30}, // 30 days
		{86400 * 365, 365}, // 365 days
	}

	for _, tt := range tests {
		sub := &Subscription{
			ID:            "test",
			SmartAccount:  "0x1234567890abcdef1234567890abcdef12345678",
			Recipient:     "0x1234567890abcdef1234567890abcdef12345678",
			Token:         "0x1234567890abcdef1234567890abcdef12345678",
			Amount:        big.NewInt(100),
			Interval:      tt.intervalSeconds,
			NextExecution: time.Now(),
			Status:        StatusActive,
			CreatedAt:     time.Now(),
		}

		resp := sub.ToResponse()
		if resp.IntervalDays != tt.wantDays {
			t.Errorf("Interval %d seconds: IntervalDays = %d, want %d", tt.intervalSeconds, resp.IntervalDays, tt.wantDays)
		}
	}
}

func TestExecutionRecord_Fields(t *testing.T) {
	now := time.Now()
	gasUsed := big.NewInt(150000)

	record := &ExecutionRecord{
		ID:             "exec_123",
		SubscriptionID: "sub_456",
		UserOpHash:     "0xuserophash123456",
		TxHash:         "0xtxhash123456",
		Status:         "success",
		Error:          "",
		GasUsed:        gasUsed,
		CreatedAt:      now,
	}

	if record.ID != "exec_123" {
		t.Errorf("ID = %s, want exec_123", record.ID)
	}
	if record.Status != "success" {
		t.Errorf("Status = %s, want success", record.Status)
	}
	if record.GasUsed.Cmp(gasUsed) != 0 {
		t.Errorf("GasUsed = %s, want %s", record.GasUsed, gasUsed)
	}
}

func TestCreateSubscriptionRequest_Fields(t *testing.T) {
	req := CreateSubscriptionRequest{
		SmartAccount:  "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:         "0x9876543210fedcba9876543210fedcba98765432",
		Amount:        "1000000",
		IntervalDays:  30,
		MaxExecutions: 12,
	}

	if req.SmartAccount == "" {
		t.Error("SmartAccount should not be empty")
	}
	if req.IntervalDays != 30 {
		t.Errorf("IntervalDays = %d, want 30", req.IntervalDays)
	}
}
