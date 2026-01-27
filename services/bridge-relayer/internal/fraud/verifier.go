package fraud

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"math/big"
	"sync"
	"time"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
)

var (
	ErrInvalidProof       = errors.New("invalid fraud proof")
	ErrProofAlreadyExists = errors.New("fraud proof already exists")
	ErrProofExpired       = errors.New("fraud proof expired")
	ErrInvalidSignatures  = errors.New("invalid signatures")
	ErrInsufficientBond   = errors.New("insufficient bond")
)

// VerificationResult contains the result of a fraud proof verification
type VerificationResult struct {
	IsValid     bool                  `json:"isValid"`
	ProofType   domain.FraudProofType `json:"proofType"`
	RequestID   [32]byte              `json:"requestId"`
	ErrorReason string                `json:"errorReason,omitempty"`
	VerifiedAt  time.Time             `json:"verifiedAt"`
}

// FraudProofVerifier handles fraud proof verification logic
type FraudProofVerifier struct {
	cfg config.ContractConfig

	mu             sync.RWMutex
	pendingProofs  map[[32]byte]*domain.FraudProof
	verifiedProofs map[[32]byte]*VerificationResult

	// Challenge period in seconds
	challengePeriod uint64
	// Minimum bond required to submit fraud proof
	minBondAmount *big.Int
}

// NewFraudProofVerifier creates a new fraud proof verifier
func NewFraudProofVerifier(cfg config.ContractConfig) *FraudProofVerifier {
	return &FraudProofVerifier{
		cfg:             cfg,
		pendingProofs:   make(map[[32]byte]*domain.FraudProof),
		verifiedProofs:  make(map[[32]byte]*VerificationResult),
		challengePeriod: 86400,           // 24 hours default
		minBondAmount:   big.NewInt(1e18), // 1 ETH default
	}
}

// SetChallengePeriod sets the challenge period in seconds
func (v *FraudProofVerifier) SetChallengePeriod(period uint64) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.challengePeriod = period
}

// SetMinBondAmount sets the minimum bond amount required
func (v *FraudProofVerifier) SetMinBondAmount(amount *big.Int) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.minBondAmount = new(big.Int).Set(amount)
}

// GetChallengePeriod returns the challenge period
func (v *FraudProofVerifier) GetChallengePeriod() uint64 {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.challengePeriod
}

// GetMinBondAmount returns the minimum bond amount
func (v *FraudProofVerifier) GetMinBondAmount() *big.Int {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return new(big.Int).Set(v.minBondAmount)
}

// SubmitFraudProof submits a new fraud proof for verification
func (v *FraudProofVerifier) SubmitFraudProof(ctx context.Context, proof *domain.FraudProof) error {
	if proof == nil {
		return ErrInvalidProof
	}

	// Validate proof type
	if !isValidProofType(proof.ProofType) {
		return ErrInvalidProof
	}

	// Check proof data - need at least evidence or state proof
	if len(proof.Evidence) == 0 && len(proof.StateProof) == 0 {
		return ErrInvalidProof
	}

	v.mu.Lock()
	defer v.mu.Unlock()

	// Check if proof already exists
	if _, exists := v.pendingProofs[proof.RequestID]; exists {
		return ErrProofAlreadyExists
	}

	// Add to pending proofs
	v.pendingProofs[proof.RequestID] = proof

	return nil
}

// VerifyFraudProof verifies a pending fraud proof
func (v *FraudProofVerifier) VerifyFraudProof(ctx context.Context, requestID [32]byte) (*VerificationResult, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	proof, exists := v.pendingProofs[requestID]
	if !exists {
		return nil, ErrInvalidProof
	}

	result := &VerificationResult{
		ProofType:  proof.ProofType,
		RequestID:  requestID,
		VerifiedAt: time.Now(),
	}

	// Verify based on proof type
	switch proof.ProofType {
	case domain.FraudProofInvalidSignature:
		result.IsValid = v.verifyInvalidSignature(proof)
	case domain.FraudProofDoubleSpending:
		result.IsValid = v.verifyDoubleSpend(proof)
	case domain.FraudProofInvalidAmount:
		result.IsValid = v.verifyInvalidAmount(proof)
	case domain.FraudProofInvalidToken:
		result.IsValid = v.verifyInvalidToken(proof)
	case domain.FraudProofReplayAttack:
		result.IsValid = v.verifyReplayAttack(proof)
	default:
		result.IsValid = false
		result.ErrorReason = "unknown proof type"
	}

	if !result.IsValid && result.ErrorReason == "" {
		result.ErrorReason = "verification failed"
	}

	// Move to verified proofs
	delete(v.pendingProofs, requestID)
	v.verifiedProofs[requestID] = result

	return result, nil
}

// verifyInvalidSignature verifies an invalid signature proof
func (v *FraudProofVerifier) verifyInvalidSignature(proof *domain.FraudProof) bool {
	// In production, this would:
	// 1. Extract the claimed signature from evidence
	// 2. Recover the signer address
	// 3. Verify it doesn't match authorized signers
	return len(proof.Evidence) >= 65 // Minimum signature length
}

// verifyDoubleSpend verifies a double spend proof
func (v *FraudProofVerifier) verifyDoubleSpend(proof *domain.FraudProof) bool {
	// In production, this would:
	// 1. Extract both transaction hashes from evidence
	// 2. Verify both use the same nonce
	// 3. Verify the requests are different
	return len(proof.Evidence) >= 64 // Two 32-byte tx hashes
}

// verifyInvalidAmount verifies an invalid amount proof
func (v *FraudProofVerifier) verifyInvalidAmount(proof *domain.FraudProof) bool {
	// In production, this would:
	// 1. Extract the claimed amount from state proof
	// 2. Compare with on-chain data
	// 3. Verify the mismatch
	return len(proof.StateProof) >= 32 || len(proof.Evidence) >= 32
}

// verifyInvalidToken verifies an invalid token proof
func (v *FraudProofVerifier) verifyInvalidToken(proof *domain.FraudProof) bool {
	// In production, this would:
	// 1. Extract the token address from evidence
	// 2. Verify it's not in the allowed token list
	return len(proof.Evidence) >= 20 // Address length
}

// verifyReplayAttack verifies a replay attack proof
func (v *FraudProofVerifier) verifyReplayAttack(proof *domain.FraudProof) bool {
	// In production, this would:
	// 1. Verify the same request was processed twice
	// 2. Check nonce reuse across chains
	return len(proof.Evidence) >= 64 && len(proof.MerkleProof) >= 1
}

// GetPendingProof returns a pending fraud proof
func (v *FraudProofVerifier) GetPendingProof(requestID [32]byte) (*domain.FraudProof, bool) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	proof, exists := v.pendingProofs[requestID]
	return proof, exists
}

// GetVerifiedProof returns a verified proof result
func (v *FraudProofVerifier) GetVerifiedProof(requestID [32]byte) (*VerificationResult, bool) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	result, exists := v.verifiedProofs[requestID]
	return result, exists
}

// GetPendingProofsCount returns the number of pending proofs
func (v *FraudProofVerifier) GetPendingProofsCount() int {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return len(v.pendingProofs)
}

// GetVerifiedProofsCount returns the number of verified proofs
func (v *FraudProofVerifier) GetVerifiedProofsCount() int {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return len(v.verifiedProofs)
}

// ComputeProofHash computes a hash for a fraud proof
func ComputeProofHash(proof *domain.FraudProof) [32]byte {
	data := append(proof.RequestID[:], proof.Evidence...)
	data = append(data, proof.StateProof...)
	data = append(data, byte(proof.ProofType))
	return sha256.Sum256(data)
}

// ProofHashToHex converts a proof hash to hex string
func ProofHashToHex(hash [32]byte) string {
	return hex.EncodeToString(hash[:])
}

// isValidProofType checks if the proof type is valid
func isValidProofType(pt domain.FraudProofType) bool {
	switch pt {
	case domain.FraudProofInvalidSignature,
		domain.FraudProofDoubleSpending,
		domain.FraudProofInvalidAmount,
		domain.FraudProofInvalidToken,
		domain.FraudProofReplayAttack:
		return true
	default:
		return false
	}
}
