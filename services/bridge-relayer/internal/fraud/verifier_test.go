package fraud

import (
	"context"
	"math/big"
	"testing"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
)

func TestNewFraudProofVerifier(t *testing.T) {
	cfg := config.ContractConfig{
		FraudProofVerifier: "0x1234567890abcdef1234567890abcdef12345678",
	}

	verifier := NewFraudProofVerifier(cfg)

	if verifier == nil {
		t.Fatal("expected verifier to be created")
	}
	if verifier.pendingProofs == nil {
		t.Fatal("expected pendingProofs map to be initialized")
	}
	if verifier.verifiedProofs == nil {
		t.Fatal("expected verifiedProofs map to be initialized")
	}
	if verifier.challengePeriod != 86400 {
		t.Errorf("expected default challenge period 86400, got %d", verifier.challengePeriod)
	}
	if verifier.minBondAmount.Cmp(big.NewInt(1e18)) != 0 {
		t.Errorf("expected default min bond 1e18, got %s", verifier.minBondAmount)
	}
}

func TestFraudProofVerifier_ChallengePeriod(t *testing.T) {
	verifier := NewFraudProofVerifier(config.ContractConfig{})

	// Test set and get
	verifier.SetChallengePeriod(172800)
	if verifier.GetChallengePeriod() != 172800 {
		t.Errorf("expected challenge period 172800, got %d", verifier.GetChallengePeriod())
	}
}

func TestFraudProofVerifier_MinBondAmount(t *testing.T) {
	verifier := NewFraudProofVerifier(config.ContractConfig{})

	// Test set and get
	newAmount := big.NewInt(5e18)
	verifier.SetMinBondAmount(newAmount)

	got := verifier.GetMinBondAmount()
	if got.Cmp(newAmount) != 0 {
		t.Errorf("expected min bond %s, got %s", newAmount, got)
	}

	// Verify it's a copy, not the same reference
	got.SetInt64(0)
	if verifier.GetMinBondAmount().Cmp(newAmount) != 0 {
		t.Error("GetMinBondAmount should return a copy")
	}
}

func TestFraudProofVerifier_SubmitFraudProof(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name    string
		proof   *domain.FraudProof
		wantErr error
	}{
		{
			name:    "nil proof",
			proof:   nil,
			wantErr: ErrInvalidProof,
		},
		{
			name: "invalid proof type",
			proof: &domain.FraudProof{
				RequestID: [32]byte{1, 2, 3},
				ProofType: domain.FraudProofNone, // Invalid for submission
				Evidence:  []byte("data"),
			},
			wantErr: ErrInvalidProof,
		},
		{
			name: "empty evidence and state proof",
			proof: &domain.FraudProof{
				RequestID:  [32]byte{1, 2, 3},
				ProofType:  domain.FraudProofInvalidSignature,
				Evidence:   []byte{},
				StateProof: []byte{},
			},
			wantErr: ErrInvalidProof,
		},
		{
			name: "valid proof with evidence",
			proof: &domain.FraudProof{
				RequestID: [32]byte{1, 2, 3},
				ProofType: domain.FraudProofInvalidSignature,
				Evidence:  make([]byte, 65),
			},
			wantErr: nil,
		},
		{
			name: "valid proof with state proof",
			proof: &domain.FraudProof{
				RequestID:  [32]byte{4, 5, 6},
				ProofType:  domain.FraudProofInvalidAmount,
				StateProof: make([]byte, 32),
			},
			wantErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset verifier for each test
			v := NewFraudProofVerifier(config.ContractConfig{})
			err := v.SubmitFraudProof(ctx, tt.proof)
			if err != tt.wantErr {
				t.Errorf("SubmitFraudProof() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestFraudProofVerifier_SubmitDuplicateProof(t *testing.T) {
	verifier := NewFraudProofVerifier(config.ContractConfig{})
	ctx := context.Background()

	proof := &domain.FraudProof{
		RequestID: [32]byte{1, 2, 3},
		ProofType: domain.FraudProofInvalidSignature,
		Evidence:  make([]byte, 65),
	}

	// First submission should succeed
	err := verifier.SubmitFraudProof(ctx, proof)
	if err != nil {
		t.Fatalf("first submission failed: %v", err)
	}

	// Second submission should fail
	err = verifier.SubmitFraudProof(ctx, proof)
	if err != ErrProofAlreadyExists {
		t.Errorf("expected ErrProofAlreadyExists, got %v", err)
	}
}

func TestFraudProofVerifier_VerifyFraudProof(t *testing.T) {
	tests := []struct {
		name       string
		proofType  domain.FraudProofType
		evidence   []byte
		stateProof []byte
		merkleProof [][32]byte
		wantValid  bool
	}{
		{
			name:      "valid invalid signature proof",
			proofType: domain.FraudProofInvalidSignature,
			evidence:  make([]byte, 65),
			wantValid: true,
		},
		{
			name:      "invalid signature proof - too short",
			proofType: domain.FraudProofInvalidSignature,
			evidence:  make([]byte, 64),
			wantValid: false,
		},
		{
			name:      "valid double spend proof",
			proofType: domain.FraudProofDoubleSpending,
			evidence:  make([]byte, 64),
			wantValid: true,
		},
		{
			name:      "invalid double spend proof - too short",
			proofType: domain.FraudProofDoubleSpending,
			evidence:  make([]byte, 63),
			wantValid: false,
		},
		{
			name:       "valid invalid amount proof with state proof",
			proofType:  domain.FraudProofInvalidAmount,
			stateProof: make([]byte, 32),
			wantValid:  true,
		},
		{
			name:      "valid invalid amount proof with evidence",
			proofType: domain.FraudProofInvalidAmount,
			evidence:  make([]byte, 32),
			wantValid: true,
		},
		{
			name:       "invalid amount proof - too short",
			proofType:  domain.FraudProofInvalidAmount,
			stateProof: make([]byte, 31),
			evidence:   make([]byte, 31),
			wantValid:  false,
		},
		{
			name:      "valid invalid token proof",
			proofType: domain.FraudProofInvalidToken,
			evidence:  make([]byte, 20),
			wantValid: true,
		},
		{
			name:      "invalid token proof - too short",
			proofType: domain.FraudProofInvalidToken,
			evidence:  make([]byte, 19),
			wantValid: false,
		},
		{
			name:        "valid replay attack proof",
			proofType:   domain.FraudProofReplayAttack,
			evidence:    make([]byte, 64),
			merkleProof: [][32]byte{{1, 2, 3}},
			wantValid:   true,
		},
		{
			name:      "invalid replay attack proof - no merkle proof",
			proofType: domain.FraudProofReplayAttack,
			evidence:  make([]byte, 64),
			wantValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			verifier := NewFraudProofVerifier(config.ContractConfig{})
			ctx := context.Background()

			requestID := [32]byte{1, 2, 3}
			proof := &domain.FraudProof{
				RequestID:   requestID,
				ProofType:   tt.proofType,
				Evidence:    tt.evidence,
				StateProof:  tt.stateProof,
				MerkleProof: tt.merkleProof,
			}

			// Submit the proof
			err := verifier.SubmitFraudProof(ctx, proof)
			if err != nil {
				t.Fatalf("failed to submit proof: %v", err)
			}

			// Verify the proof
			result, err := verifier.VerifyFraudProof(ctx, requestID)
			if err != nil {
				t.Fatalf("failed to verify proof: %v", err)
			}

			if result.IsValid != tt.wantValid {
				t.Errorf("VerifyFraudProof() IsValid = %v, want %v", result.IsValid, tt.wantValid)
			}
			if result.ProofType != tt.proofType {
				t.Errorf("VerifyFraudProof() ProofType = %v, want %v", result.ProofType, tt.proofType)
			}
			if result.RequestID != requestID {
				t.Errorf("VerifyFraudProof() RequestID mismatch")
			}
		})
	}
}

func TestFraudProofVerifier_VerifyNonExistentProof(t *testing.T) {
	verifier := NewFraudProofVerifier(config.ContractConfig{})
	ctx := context.Background()

	_, err := verifier.VerifyFraudProof(ctx, [32]byte{9, 9, 9})
	if err != ErrInvalidProof {
		t.Errorf("expected ErrInvalidProof, got %v", err)
	}
}

func TestFraudProofVerifier_GetPendingProof(t *testing.T) {
	verifier := NewFraudProofVerifier(config.ContractConfig{})
	ctx := context.Background()

	requestID := [32]byte{1, 2, 3}

	// Test non-existent
	_, exists := verifier.GetPendingProof(requestID)
	if exists {
		t.Error("expected pending proof to not exist")
	}

	// Add proof
	proof := &domain.FraudProof{
		RequestID: requestID,
		ProofType: domain.FraudProofInvalidSignature,
		Evidence:  make([]byte, 65),
	}
	_ = verifier.SubmitFraudProof(ctx, proof)

	// Test exists
	got, exists := verifier.GetPendingProof(requestID)
	if !exists {
		t.Error("expected pending proof to exist")
	}
	if got.RequestID != requestID {
		t.Error("returned proof has wrong request ID")
	}
}

func TestFraudProofVerifier_GetVerifiedProof(t *testing.T) {
	verifier := NewFraudProofVerifier(config.ContractConfig{})
	ctx := context.Background()

	requestID := [32]byte{1, 2, 3}

	// Test non-existent
	_, exists := verifier.GetVerifiedProof(requestID)
	if exists {
		t.Error("expected verified proof to not exist")
	}

	// Add and verify proof
	proof := &domain.FraudProof{
		RequestID: requestID,
		ProofType: domain.FraudProofInvalidSignature,
		Evidence:  make([]byte, 65),
	}
	_ = verifier.SubmitFraudProof(ctx, proof)
	_, _ = verifier.VerifyFraudProof(ctx, requestID)

	// Test exists
	result, exists := verifier.GetVerifiedProof(requestID)
	if !exists {
		t.Error("expected verified proof to exist")
	}
	if result.RequestID != requestID {
		t.Error("returned result has wrong request ID")
	}
}

func TestFraudProofVerifier_ProofsCounts(t *testing.T) {
	verifier := NewFraudProofVerifier(config.ContractConfig{})
	ctx := context.Background()

	// Initially 0
	if verifier.GetPendingProofsCount() != 0 {
		t.Errorf("expected 0 pending proofs, got %d", verifier.GetPendingProofsCount())
	}
	if verifier.GetVerifiedProofsCount() != 0 {
		t.Errorf("expected 0 verified proofs, got %d", verifier.GetVerifiedProofsCount())
	}

	// Add proofs
	for i := 0; i < 3; i++ {
		proof := &domain.FraudProof{
			RequestID: [32]byte{byte(i)},
			ProofType: domain.FraudProofInvalidSignature,
			Evidence:  make([]byte, 65),
		}
		_ = verifier.SubmitFraudProof(ctx, proof)
	}

	if verifier.GetPendingProofsCount() != 3 {
		t.Errorf("expected 3 pending proofs, got %d", verifier.GetPendingProofsCount())
	}

	// Verify one proof
	_, _ = verifier.VerifyFraudProof(ctx, [32]byte{0})

	if verifier.GetPendingProofsCount() != 2 {
		t.Errorf("expected 2 pending proofs, got %d", verifier.GetPendingProofsCount())
	}
	if verifier.GetVerifiedProofsCount() != 1 {
		t.Errorf("expected 1 verified proof, got %d", verifier.GetVerifiedProofsCount())
	}
}

func TestComputeProofHash(t *testing.T) {
	proof := &domain.FraudProof{
		RequestID:  [32]byte{1, 2, 3, 4, 5},
		ProofType:  domain.FraudProofDoubleSpending,
		Evidence:   []byte("test evidence data"),
		StateProof: []byte("test state proof"),
	}

	hash1 := ComputeProofHash(proof)
	hash2 := ComputeProofHash(proof)

	// Same input should produce same hash
	if hash1 != hash2 {
		t.Error("same proof should produce same hash")
	}

	// Different proof should produce different hash
	proof2 := &domain.FraudProof{
		RequestID:  [32]byte{5, 4, 3, 2, 1},
		ProofType:  domain.FraudProofDoubleSpending,
		Evidence:   []byte("test evidence data"),
		StateProof: []byte("test state proof"),
	}
	hash3 := ComputeProofHash(proof2)
	if hash1 == hash3 {
		t.Error("different proofs should produce different hashes")
	}
}

func TestProofHashToHex(t *testing.T) {
	hash := [32]byte{0x12, 0x34, 0x56, 0x78}
	hex := ProofHashToHex(hash)

	if len(hex) != 64 {
		t.Errorf("expected hex length 64, got %d", len(hex))
	}
	if hex[:8] != "12345678" {
		t.Errorf("expected hex to start with 12345678, got %s", hex[:8])
	}
}

func TestIsValidProofType(t *testing.T) {
	tests := []struct {
		proofType domain.FraudProofType
		want      bool
	}{
		{domain.FraudProofInvalidSignature, true},
		{domain.FraudProofDoubleSpending, true},
		{domain.FraudProofInvalidAmount, true},
		{domain.FraudProofInvalidToken, true},
		{domain.FraudProofReplayAttack, true},
		{domain.FraudProofNone, false},
		{domain.FraudProofType(99), false},
	}

	for _, tt := range tests {
		if got := isValidProofType(tt.proofType); got != tt.want {
			t.Errorf("isValidProofType(%d) = %v, want %v", tt.proofType, got, tt.want)
		}
	}
}
