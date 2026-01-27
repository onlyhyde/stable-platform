package domain

import (
	"math/big"
	"testing"
	"time"
)

func TestRequestStatus_String(t *testing.T) {
	tests := []struct {
		status RequestStatus
		want   string
	}{
		{StatusNone, "none"},
		{StatusPending, "pending"},
		{StatusApproved, "approved"},
		{StatusChallenged, "challenged"},
		{StatusExecuted, "executed"},
		{StatusRefunded, "refunded"},
		{StatusCancelled, "cancelled"},
		{RequestStatus(999), "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := tt.status.String(); got != tt.want {
				t.Errorf("RequestStatus.String() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestFraudProofType_String(t *testing.T) {
	tests := []struct {
		proofType FraudProofType
		want      string
	}{
		{FraudProofNone, "none"},
		{FraudProofInvalidSignature, "invalid_signature"},
		{FraudProofDoubleSpending, "double_spending"},
		{FraudProofInvalidAmount, "invalid_amount"},
		{FraudProofInvalidToken, "invalid_token"},
		{FraudProofReplayAttack, "replay_attack"},
		{FraudProofType(999), "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := tt.proofType.String(); got != tt.want {
				t.Errorf("FraudProofType.String() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestRequestStatus_Values(t *testing.T) {
	// Verify status constants are defined correctly
	if StatusNone != 0 {
		t.Errorf("StatusNone = %d, want 0", StatusNone)
	}
	if StatusPending != 1 {
		t.Errorf("StatusPending = %d, want 1", StatusPending)
	}
	if StatusApproved != 2 {
		t.Errorf("StatusApproved = %d, want 2", StatusApproved)
	}
	if StatusChallenged != 3 {
		t.Errorf("StatusChallenged = %d, want 3", StatusChallenged)
	}
	if StatusExecuted != 4 {
		t.Errorf("StatusExecuted = %d, want 4", StatusExecuted)
	}
	if StatusRefunded != 5 {
		t.Errorf("StatusRefunded = %d, want 5", StatusRefunded)
	}
	if StatusCancelled != 6 {
		t.Errorf("StatusCancelled = %d, want 6", StatusCancelled)
	}
}

func TestFraudProofType_Values(t *testing.T) {
	if FraudProofNone != 0 {
		t.Errorf("FraudProofNone = %d, want 0", FraudProofNone)
	}
	if FraudProofInvalidSignature != 1 {
		t.Errorf("FraudProofInvalidSignature = %d, want 1", FraudProofInvalidSignature)
	}
	if FraudProofDoubleSpending != 2 {
		t.Errorf("FraudProofDoubleSpending = %d, want 2", FraudProofDoubleSpending)
	}
	if FraudProofInvalidAmount != 3 {
		t.Errorf("FraudProofInvalidAmount = %d, want 3", FraudProofInvalidAmount)
	}
	if FraudProofInvalidToken != 4 {
		t.Errorf("FraudProofInvalidToken = %d, want 4", FraudProofInvalidToken)
	}
	if FraudProofReplayAttack != 5 {
		t.Errorf("FraudProofReplayAttack = %d, want 5", FraudProofReplayAttack)
	}
}

func TestBridgeRequest_Fields(t *testing.T) {
	now := time.Now()
	amount := big.NewInt(1000000000000000000)
	fee := big.NewInt(1000000000000000)

	req := BridgeRequest{
		RequestID:    [32]byte{1, 2, 3, 4},
		Sender:       "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:    "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:        "0x9876543210fedcba9876543210fedcba98765432",
		Amount:       amount,
		SourceChain:  1,
		TargetChain:  137,
		Nonce:        42,
		Deadline:     uint64(now.Add(1 * time.Hour).Unix()),
		Fee:          fee,
		Status:       StatusPending,
		InitiatedAt:  now,
		BlockNumber:  12345678,
		TxHash:       "0xtxhash123",
	}

	if req.Sender != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("unexpected Sender: %s", req.Sender)
	}
	if req.SourceChain != 1 {
		t.Errorf("expected SourceChain 1, got %d", req.SourceChain)
	}
	if req.TargetChain != 137 {
		t.Errorf("expected TargetChain 137, got %d", req.TargetChain)
	}
	if req.Status != StatusPending {
		t.Errorf("expected status pending, got %s", req.Status.String())
	}
	if req.Amount.Cmp(amount) != 0 {
		t.Errorf("unexpected Amount: %s", req.Amount)
	}
}

func TestBridgeMessage_Fields(t *testing.T) {
	amount := big.NewInt(500000000000000000)

	msg := BridgeMessage{
		RequestID:   [32]byte{5, 6, 7, 8},
		Sender:      "0x1111111111111111111111111111111111111111",
		Recipient:   "0x2222222222222222222222222222222222222222",
		Token:       "0x3333333333333333333333333333333333333333",
		Amount:      amount,
		SourceChain: 1,
		TargetChain: 10,
		Nonce:       100,
		Deadline:    1700000000,
	}

	if msg.Nonce != 100 {
		t.Errorf("expected Nonce 100, got %d", msg.Nonce)
	}
	if msg.SourceChain != 1 {
		t.Errorf("expected SourceChain 1, got %d", msg.SourceChain)
	}
	if msg.Amount.Cmp(amount) != 0 {
		t.Errorf("unexpected Amount: %s", msg.Amount)
	}
}

func TestDepositInfo_Fields(t *testing.T) {
	amount := big.NewInt(1000000)

	info := DepositInfo{
		Sender:    "0x1234567890abcdef1234567890abcdef12345678",
		Token:     "0x9876543210fedcba9876543210fedcba98765432",
		Amount:    amount,
		Timestamp: 1700000000,
		Executed:  true,
		Refunded:  false,
	}

	if !info.Executed {
		t.Error("expected Executed to be true")
	}
	if info.Refunded {
		t.Error("expected Refunded to be false")
	}
	if info.Amount.Cmp(amount) != 0 {
		t.Errorf("unexpected Amount: %s", info.Amount)
	}
}

func TestSignatureRequest_Fields(t *testing.T) {
	now := time.Now()
	msg := BridgeMessage{
		RequestID:   [32]byte{1},
		Sender:      "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:       "0x9876543210fedcba9876543210fedcba98765432",
		Amount:      big.NewInt(1000),
		SourceChain: 1,
		TargetChain: 137,
		Nonce:       1,
		Deadline:    1700000000,
	}

	req := SignatureRequest{
		Message:     msg,
		SignerID:    3,
		RequestedAt: now,
	}

	if req.SignerID != 3 {
		t.Errorf("expected SignerID 3, got %d", req.SignerID)
	}
	if req.RequestedAt != now {
		t.Errorf("unexpected RequestedAt")
	}
}

func TestSignatureResponse_Fields(t *testing.T) {
	signature := []byte{1, 2, 3, 4, 5}

	resp := SignatureResponse{
		SignerID:  5,
		Signature: signature,
		Error:     "",
	}

	if resp.SignerID != 5 {
		t.Errorf("expected SignerID 5, got %d", resp.SignerID)
	}
	if len(resp.Signature) != 5 {
		t.Errorf("expected signature length 5, got %d", len(resp.Signature))
	}
	if resp.Error != "" {
		t.Errorf("expected no error, got %s", resp.Error)
	}
}

func TestSignatureResponse_WithError(t *testing.T) {
	resp := SignatureResponse{
		SignerID:  2,
		Signature: nil,
		Error:     "signer unavailable",
	}

	if resp.Error != "signer unavailable" {
		t.Errorf("expected error 'signer unavailable', got %s", resp.Error)
	}
	if resp.Signature != nil {
		t.Error("expected nil signature on error")
	}
}

func TestFraudProof_Fields(t *testing.T) {
	proof := FraudProof{
		RequestID:   [32]byte{1, 2, 3},
		ProofType:   FraudProofDoubleSpending,
		MerkleProof: [][32]byte{{1}, {2}, {3}},
		StateProof:  []byte{4, 5, 6},
		Evidence:    []byte{7, 8, 9},
	}

	if proof.ProofType != FraudProofDoubleSpending {
		t.Errorf("expected ProofType double_spending, got %s", proof.ProofType.String())
	}
	if len(proof.MerkleProof) != 3 {
		t.Errorf("expected 3 merkle proof elements, got %d", len(proof.MerkleProof))
	}
}

func TestProofRecord_Fields(t *testing.T) {
	now := time.Now()

	record := ProofRecord{
		Submitter:   "0x1234567890abcdef1234567890abcdef12345678",
		ProofType:   FraudProofInvalidSignature,
		ProofHash:   [32]byte{1, 2, 3},
		SubmittedAt: now,
		Verified:    true,
		IsValid:     true,
	}

	if record.ProofType != FraudProofInvalidSignature {
		t.Errorf("expected ProofType invalid_signature, got %s", record.ProofType.String())
	}
	if !record.Verified {
		t.Error("expected Verified to be true")
	}
	if !record.IsValid {
		t.Error("expected IsValid to be true")
	}
}

func TestGuardianProposal_Fields(t *testing.T) {
	now := time.Now()
	expires := now.Add(7 * 24 * time.Hour)

	proposal := GuardianProposal{
		ID:            1,
		ProposalType:  "upgrade",
		Proposer:      "0x1234567890abcdef1234567890abcdef12345678",
		Target:        "0xabcdef1234567890abcdef1234567890abcdef12",
		Data:          []byte{1, 2, 3},
		DataHash:      [32]byte{4, 5, 6},
		ApprovalCount: 3,
		CreatedAt:     now,
		ExpiresAt:     expires,
		Status:        "active",
	}

	if proposal.ID != 1 {
		t.Errorf("expected ID 1, got %d", proposal.ID)
	}
	if proposal.ProposalType != "upgrade" {
		t.Errorf("expected ProposalType upgrade, got %s", proposal.ProposalType)
	}
	if proposal.ApprovalCount != 3 {
		t.Errorf("expected ApprovalCount 3, got %d", proposal.ApprovalCount)
	}
}

func TestRateLimitStatus_Fields(t *testing.T) {
	status := RateLimitStatus{
		HourlyUsage:    big.NewInt(100000),
		DailyUsage:     big.NewInt(500000),
		HourlyLimit:    big.NewInt(1000000),
		DailyLimit:     big.NewInt(10000000),
		UsagePercent:   5.0,
		AlertTriggered: false,
		IsPaused:       false,
	}

	if status.UsagePercent != 5.0 {
		t.Errorf("expected UsagePercent 5.0, got %f", status.UsagePercent)
	}
	if status.AlertTriggered {
		t.Error("expected AlertTriggered to be false")
	}
	if status.IsPaused {
		t.Error("expected IsPaused to be false")
	}
}

func TestRelayerStatus_Fields(t *testing.T) {
	now := time.Now()

	status := RelayerStatus{
		IsHealthy:          true,
		IsPaused:           false,
		SourceChainSynced:  true,
		TargetChainSynced:  true,
		LastProcessedBlock: 12345678,
		PendingRequests:    5,
		ProcessedRequests:  100,
		FailedRequests:     2,
		MPCSignersOnline:   5,
		LastUpdated:        now,
	}

	if !status.IsHealthy {
		t.Error("expected IsHealthy to be true")
	}
	if !status.SourceChainSynced {
		t.Error("expected SourceChainSynced to be true")
	}
	if status.PendingRequests != 5 {
		t.Errorf("expected PendingRequests 5, got %d", status.PendingRequests)
	}
	if status.MPCSignersOnline != 5 {
		t.Errorf("expected MPCSignersOnline 5, got %d", status.MPCSignersOnline)
	}
}

func TestBridgeEvent_Fields(t *testing.T) {
	now := time.Now()

	event := BridgeEvent{
		EventType:   "BridgeInitiated",
		BlockNumber: 12345678,
		TxHash:      "0xtxhash123",
		LogIndex:    5,
		Timestamp:   now,
		Data:        map[string]interface{}{"key": "value"},
	}

	if event.EventType != "BridgeInitiated" {
		t.Errorf("expected EventType BridgeInitiated, got %s", event.EventType)
	}
	if event.BlockNumber != 12345678 {
		t.Errorf("expected BlockNumber 12345678, got %d", event.BlockNumber)
	}
	if event.LogIndex != 5 {
		t.Errorf("expected LogIndex 5, got %d", event.LogIndex)
	}
}

func TestBridgeInitiatedEvent_Fields(t *testing.T) {
	amount := big.NewInt(1000000000000000000)
	fee := big.NewInt(1000000000000000)

	event := BridgeInitiatedEvent{
		RequestID:   [32]byte{1, 2, 3},
		Sender:      "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:       "0x9876543210fedcba9876543210fedcba98765432",
		Amount:      amount,
		SourceChain: 1,
		TargetChain: 137,
		Fee:         fee,
	}

	if event.SourceChain != 1 {
		t.Errorf("expected SourceChain 1, got %d", event.SourceChain)
	}
	if event.TargetChain != 137 {
		t.Errorf("expected TargetChain 137, got %d", event.TargetChain)
	}
	if event.Amount.Cmp(amount) != 0 {
		t.Errorf("unexpected Amount: %s", event.Amount)
	}
}

func TestBridgeCompletedEvent_Fields(t *testing.T) {
	amount := big.NewInt(1000000000000000000)

	event := BridgeCompletedEvent{
		RequestID: [32]byte{1, 2, 3},
		Recipient: "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:     "0x9876543210fedcba9876543210fedcba98765432",
		Amount:    amount,
	}

	if event.Amount.Cmp(amount) != 0 {
		t.Errorf("unexpected Amount: %s", event.Amount)
	}
}

func TestChallengeResolvedEvent_Fields(t *testing.T) {
	reward := big.NewInt(100000000000000000)

	event := ChallengeResolvedEvent{
		RequestID:        [32]byte{1, 2, 3},
		ChallengeSuccess: true,
		Challenger:       "0x1234567890abcdef1234567890abcdef12345678",
		Reward:           reward,
	}

	if !event.ChallengeSuccess {
		t.Error("expected ChallengeSuccess to be true")
	}
	if event.Reward.Cmp(reward) != 0 {
		t.Errorf("unexpected Reward: %s", event.Reward)
	}
}
