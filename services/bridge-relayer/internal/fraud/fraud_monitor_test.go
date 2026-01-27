package fraud

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
)

func TestNewFraudMonitor(t *testing.T) {
	contracts := config.ContractConfig{
		FraudProofVerifier: "0x1234567890abcdef1234567890abcdef12345678",
		SecureBridge:       "0xabcdef1234567890abcdef1234567890abcdef12",
	}

	monitor := NewFraudMonitor(nil, contracts)

	if monitor == nil {
		t.Fatal("expected monitor to be created")
	}
	if monitor.proofRecords == nil {
		t.Fatal("expected proofRecords map to be initialized")
	}
	if monitor.alertChan == nil {
		t.Fatal("expected alertChan to be initialized")
	}
	if cap(monitor.alertChan) != 100 {
		t.Errorf("expected alert channel capacity 100, got %d", cap(monitor.alertChan))
	}
}

func TestFraudMonitor_StartStop(t *testing.T) {
	monitor := NewFraudMonitor(nil, config.ContractConfig{})
	ctx, cancel := context.WithCancel(context.Background())

	// Initially not running
	monitor.mu.RLock()
	if monitor.isRunning {
		t.Error("expected monitor to not be running initially")
	}
	monitor.mu.RUnlock()

	// Start
	err := monitor.Start(ctx)
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}

	monitor.mu.RLock()
	if !monitor.isRunning {
		t.Error("expected monitor to be running after Start()")
	}
	monitor.mu.RUnlock()

	// Start again should be a no-op
	err = monitor.Start(ctx)
	if err != nil {
		t.Fatalf("second Start() error = %v", err)
	}

	// Stop
	monitor.Stop()
	monitor.mu.RLock()
	if monitor.isRunning {
		t.Error("expected monitor to not be running after Stop()")
	}
	monitor.mu.RUnlock()

	cancel()
}

func TestFraudMonitor_ValidateRequest(t *testing.T) {
	monitor := NewFraudMonitor(nil, config.ContractConfig{})
	ctx := context.Background()

	tests := []struct {
		name      string
		request   *domain.BridgeRequest
		wantValid bool
		wantMsg   string
	}{
		{
			name: "valid request",
			request: &domain.BridgeRequest{
				Sender:      "0x1234567890abcdef1234567890abcdef12345678",
				Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
				Amount:      big.NewInt(1000000),
				SourceChain: 1,
				TargetChain: 137,
				Deadline:    uint64(time.Now().Add(1 * time.Hour).Unix()),
			},
			wantValid: true,
			wantMsg:   "",
		},
		{
			name: "expired deadline",
			request: &domain.BridgeRequest{
				Sender:      "0x1234567890abcdef1234567890abcdef12345678",
				Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
				Amount:      big.NewInt(1000000),
				SourceChain: 1,
				TargetChain: 137,
				Deadline:    uint64(time.Now().Add(-1 * time.Hour).Unix()),
			},
			wantValid: false,
			wantMsg:   "request deadline expired",
		},
		{
			name: "nil amount",
			request: &domain.BridgeRequest{
				Sender:      "0x1234567890abcdef1234567890abcdef12345678",
				Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
				Amount:      nil,
				SourceChain: 1,
				TargetChain: 137,
			},
			wantValid: false,
			wantMsg:   "invalid amount",
		},
		{
			name: "zero amount",
			request: &domain.BridgeRequest{
				Sender:      "0x1234567890abcdef1234567890abcdef12345678",
				Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
				Amount:      big.NewInt(0),
				SourceChain: 1,
				TargetChain: 137,
			},
			wantValid: false,
			wantMsg:   "invalid amount",
		},
		{
			name: "negative amount",
			request: &domain.BridgeRequest{
				Sender:      "0x1234567890abcdef1234567890abcdef12345678",
				Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
				Amount:      big.NewInt(-1000),
				SourceChain: 1,
				TargetChain: 137,
			},
			wantValid: false,
			wantMsg:   "invalid amount",
		},
		{
			name: "empty sender",
			request: &domain.BridgeRequest{
				Sender:      "",
				Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
				Amount:      big.NewInt(1000000),
				SourceChain: 1,
				TargetChain: 137,
			},
			wantValid: false,
			wantMsg:   "invalid addresses",
		},
		{
			name: "empty recipient",
			request: &domain.BridgeRequest{
				Sender:      "0x1234567890abcdef1234567890abcdef12345678",
				Recipient:   "",
				Amount:      big.NewInt(1000000),
				SourceChain: 1,
				TargetChain: 137,
			},
			wantValid: false,
			wantMsg:   "invalid addresses",
		},
		{
			name: "same source and target chain",
			request: &domain.BridgeRequest{
				Sender:      "0x1234567890abcdef1234567890abcdef12345678",
				Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
				Amount:      big.NewInt(1000000),
				SourceChain: 1,
				TargetChain: 1,
			},
			wantValid: false,
			wantMsg:   "source and target chains must be different",
		},
		{
			name: "no deadline (0)",
			request: &domain.BridgeRequest{
				Sender:      "0x1234567890abcdef1234567890abcdef12345678",
				Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
				Amount:      big.NewInt(1000000),
				SourceChain: 1,
				TargetChain: 137,
				Deadline:    0,
			},
			wantValid: true,
			wantMsg:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid, msg := monitor.ValidateRequest(ctx, tt.request)
			if valid != tt.wantValid {
				t.Errorf("ValidateRequest() valid = %v, want %v", valid, tt.wantValid)
			}
			if msg != tt.wantMsg {
				t.Errorf("ValidateRequest() msg = %s, want %s", msg, tt.wantMsg)
			}
		})
	}
}

func TestFraudMonitor_RecordFraudProof(t *testing.T) {
	monitor := NewFraudMonitor(nil, config.ContractConfig{})

	proofHash := [32]byte{1, 2, 3, 4, 5}
	record := &domain.ProofRecord{
		Submitter:   "0x1234567890abcdef1234567890abcdef12345678",
		ProofType:   domain.FraudProofDoubleSpending,
		ProofHash:   proofHash,
		SubmittedAt: time.Now(),
		Verified:    false,
		IsValid:     false,
	}

	monitor.RecordFraudProof(record)

	// Verify record was stored
	stored, exists := monitor.GetProofRecord(proofHash)
	if !exists {
		t.Fatal("expected proof record to be stored")
	}
	if stored.Submitter != record.Submitter {
		t.Errorf("Submitter = %s, want %s", stored.Submitter, record.Submitter)
	}
	if stored.ProofType != record.ProofType {
		t.Errorf("ProofType = %d, want %d", stored.ProofType, record.ProofType)
	}

	// Verify alert was sent
	select {
	case alert := <-monitor.GetAlertChannel():
		if alert.AlertType != "fraud_proof_submitted" {
			t.Errorf("AlertType = %s, want fraud_proof_submitted", alert.AlertType)
		}
		if alert.Severity != "high" {
			t.Errorf("Severity = %s, want high", alert.Severity)
		}
		if alert.ProofType != domain.FraudProofDoubleSpending {
			t.Errorf("ProofType = %d, want %d", alert.ProofType, domain.FraudProofDoubleSpending)
		}
	default:
		t.Error("expected alert to be sent")
	}
}

func TestFraudMonitor_GetProofRecords(t *testing.T) {
	monitor := NewFraudMonitor(nil, config.ContractConfig{})

	// Initially empty
	records := monitor.GetProofRecords()
	if len(records) != 0 {
		t.Errorf("expected 0 records initially, got %d", len(records))
	}

	// Add multiple records
	for i := 0; i < 3; i++ {
		record := &domain.ProofRecord{
			Submitter:   "0x1234567890abcdef1234567890abcdef12345678",
			ProofType:   domain.FraudProofInvalidSignature,
			ProofHash:   [32]byte{byte(i)},
			SubmittedAt: time.Now(),
		}
		monitor.RecordFraudProof(record)
	}

	// Drain alert channel
	for i := 0; i < 3; i++ {
		<-monitor.GetAlertChannel()
	}

	// Verify all records
	records = monitor.GetProofRecords()
	if len(records) != 3 {
		t.Errorf("expected 3 records, got %d", len(records))
	}
}

func TestFraudMonitor_GetProofRecord_NotFound(t *testing.T) {
	monitor := NewFraudMonitor(nil, config.ContractConfig{})

	_, exists := monitor.GetProofRecord([32]byte{9, 9, 9})
	if exists {
		t.Error("expected proof record to not exist")
	}
}

func TestFraudMonitor_SendAlert(t *testing.T) {
	monitor := NewFraudMonitor(nil, config.ContractConfig{})

	alert := FraudAlert{
		RequestID: [32]byte{1, 2, 3},
		AlertType: "test_alert",
		Severity:  "critical",
		Details:   "Test alert details",
		Timestamp: time.Now(),
	}

	monitor.SendAlert(alert)

	// Receive alert
	select {
	case received := <-monitor.GetAlertChannel():
		if received.AlertType != alert.AlertType {
			t.Errorf("AlertType = %s, want %s", received.AlertType, alert.AlertType)
		}
		if received.Severity != alert.Severity {
			t.Errorf("Severity = %s, want %s", received.Severity, alert.Severity)
		}
		if received.Details != alert.Details {
			t.Errorf("Details = %s, want %s", received.Details, alert.Details)
		}
	default:
		t.Error("expected alert to be received")
	}
}

func TestFraudMonitor_AlertChannelFull(t *testing.T) {
	monitor := NewFraudMonitor(nil, config.ContractConfig{})

	// Fill the alert channel
	for i := 0; i < 100; i++ {
		monitor.SendAlert(FraudAlert{
			AlertType: "fill_channel",
			Severity:  "low",
		})
	}

	// This should not block even though channel is full
	done := make(chan bool)
	go func() {
		monitor.SendAlert(FraudAlert{
			AlertType: "overflow_alert",
			Severity:  "high",
		})
		done <- true
	}()

	select {
	case <-done:
		// Expected - alert was dropped but didn't block
	case <-time.After(1 * time.Second):
		t.Error("SendAlert blocked when channel was full")
	}
}

func TestFraudAlert_Fields(t *testing.T) {
	now := time.Now()
	alert := FraudAlert{
		RequestID: [32]byte{1, 2, 3, 4},
		AlertType: "suspicious_activity",
		Severity:  "medium",
		Details:   "Unusual transaction pattern detected",
		Timestamp: now,
		ProofType: domain.FraudProofReplayAttack,
	}

	if alert.AlertType != "suspicious_activity" {
		t.Errorf("AlertType = %s, want suspicious_activity", alert.AlertType)
	}
	if alert.Severity != "medium" {
		t.Errorf("Severity = %s, want medium", alert.Severity)
	}
	if alert.ProofType != domain.FraudProofReplayAttack {
		t.Errorf("ProofType = %d, want %d", alert.ProofType, domain.FraudProofReplayAttack)
	}
}
