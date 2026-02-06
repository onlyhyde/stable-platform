package paymaster

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Verifying Paymaster Configuration
// ============================================================================

// VerifyingPaymasterConfig configures the verifying paymaster.
type VerifyingPaymasterConfig struct {
	// PaymasterAddress is the paymaster contract address.
	PaymasterAddress types.Address
	// PrivateKey is the signer's private key for signing paymaster data.
	PrivateKey types.Hex
	// ChainID is the chain ID.
	ChainID types.ChainID
	// ValiditySeconds is the validity window in seconds (default: 3600 = 1 hour).
	ValiditySeconds int
}

// Default gas limits for verifying paymaster operations.
const (
	DefaultVerifyingPaymasterVerificationGas = 100_000
	DefaultVerifyingPaymasterPostOpGas       = 50_000
	DefaultValiditySeconds                   = 3600
)

// ============================================================================
// Verifying Paymaster
// ============================================================================

// VerifyingPaymaster uses off-chain signature to approve gas sponsorship.
type VerifyingPaymaster struct {
	config     VerifyingPaymasterConfig
	privateKey *ecdsa.PrivateKey
}

// NewVerifyingPaymaster creates a new verifying paymaster.
func NewVerifyingPaymaster(cfg VerifyingPaymasterConfig) (*VerifyingPaymaster, error) {
	if len(cfg.PrivateKey) == 0 {
		return nil, fmt.Errorf("private key is required")
	}

	// Parse private key
	privateKey, err := crypto.ToECDSA(cfg.PrivateKey.Bytes())
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	if cfg.ValiditySeconds == 0 {
		cfg.ValiditySeconds = DefaultValiditySeconds
	}

	return &VerifyingPaymaster{
		config:     cfg,
		privateKey: privateKey,
	}, nil
}

// GetPaymasterStubData returns stub data for gas estimation.
func (v *VerifyingPaymaster) GetPaymasterStubData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*StubData, error) {
	// Create stub paymaster data with placeholder timestamps and signature
	validUntil := uint64(time.Now().Unix()) + uint64(v.config.ValiditySeconds)
	validAfter := uint64(0)

	paymasterData := encodeVerifyingPaymasterData(validUntil, validAfter, stubSignature())

	return &StubData{
		Paymaster:                     v.config.PaymasterAddress,
		PaymasterData:                 paymasterData,
		PaymasterVerificationGasLimit: big.NewInt(DefaultVerifyingPaymasterVerificationGas),
		PaymasterPostOpGasLimit:       big.NewInt(DefaultVerifyingPaymasterPostOpGas),
	}, nil
}

// GetPaymasterData returns the final paymaster data with signature.
func (v *VerifyingPaymaster) GetPaymasterData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*PaymasterData, error) {
	// Set validity window
	validUntil := uint64(time.Now().Unix()) + uint64(v.config.ValiditySeconds)
	validAfter := uint64(0)

	// Compute the hash that needs to be signed
	hash := computeVerifyingPaymasterHash(
		userOp,
		v.config.PaymasterAddress,
		uint64(v.config.ChainID),
		validUntil,
		validAfter,
	)

	// Sign the hash
	signature, err := crypto.Sign(hash, v.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign paymaster hash: %w", err)
	}

	// Encode paymaster data
	paymasterData := encodeVerifyingPaymasterData(validUntil, validAfter, types.Hex(signature))

	return &PaymasterData{
		Paymaster:                     v.config.PaymasterAddress,
		PaymasterData:                 paymasterData,
		PaymasterVerificationGasLimit: big.NewInt(DefaultVerifyingPaymasterVerificationGas),
		PaymasterPostOpGasLimit:       big.NewInt(DefaultVerifyingPaymasterPostOpGas),
	}, nil
}

// GetSupportedTokens returns empty list (verifying paymaster doesn't support tokens).
func (v *VerifyingPaymaster) GetSupportedTokens(ctx context.Context) ([]TokenInfo, error) {
	return nil, nil
}

// EstimateTokenPayment returns error (verifying paymaster doesn't support tokens).
func (v *VerifyingPaymaster) EstimateTokenPayment(ctx context.Context, userOp *types.PartialUserOperation, token types.Address) (*TokenEstimate, error) {
	return nil, fmt.Errorf("verifying paymaster does not support token payments")
}

// IsSponsorshipAvailable always returns true for verifying paymaster.
func (v *VerifyingPaymaster) IsSponsorshipAvailable(ctx context.Context, sender types.Address) (bool, error) {
	return true, nil
}

// GetSponsorshipPolicy returns a basic policy.
func (v *VerifyingPaymaster) GetSponsorshipPolicy(ctx context.Context, sender types.Address) (*SponsorshipPolicy, error) {
	return &SponsorshipPolicy{
		IsAvailable: true,
	}, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// stubSignature returns a 65-byte stub signature for gas estimation.
func stubSignature() types.Hex {
	return make(types.Hex, 65)
}

// encodeVerifyingPaymasterData encodes paymaster data.
// Format: [validUntil (6 bytes)][validAfter (6 bytes)][signature (65 bytes)]
func encodeVerifyingPaymasterData(validUntil, validAfter uint64, signature types.Hex) types.Hex {
	data := make([]byte, 77) // 6 + 6 + 65

	// ValidUntil as uint48 (6 bytes, big-endian)
	for i := 0; i < 6; i++ {
		data[5-i] = byte(validUntil >> (8 * i))
	}

	// ValidAfter as uint48 (6 bytes, big-endian)
	for i := 0; i < 6; i++ {
		data[11-i] = byte(validAfter >> (8 * i))
	}

	// Signature (65 bytes)
	copy(data[12:], signature.Bytes())

	return types.Hex(data)
}

// computeVerifyingPaymasterHash computes the hash to sign for the verifying paymaster.
func computeVerifyingPaymasterHash(
	userOp *types.PartialUserOperation,
	paymasterAddress types.Address,
	chainID uint64,
	validUntil, validAfter uint64,
) []byte {
	// Build the hash following ERC-4337 v0.7 format
	// Pack: sender + nonce + initCodeHash + callDataHash + accountGasLimits + preVerificationGas + gasFees + chainId + paymaster + validUntil + validAfter

	// InitCode hash (empty for partial user op)
	initCodeHash := crypto.Keccak256(nil)

	// CallData hash
	callDataHash := crypto.Keccak256(userOp.CallData.Bytes())

	// Account gas limits (verificationGasLimit + callGasLimit as bytes32)
	accountGasLimits := packGasLimits(userOp.VerificationGasLimit, userOp.CallGasLimit)

	// Gas fees (maxPriorityFeePerGas + maxFeePerGas as bytes32)
	gasFees := packGasLimits(userOp.MaxPriorityFeePerGas, userOp.MaxFeePerGas)

	// Build the packed data
	data := make([]byte, 0, 320)

	// sender (20 bytes, padded to 32)
	data = append(data, common.LeftPadBytes(userOp.Sender.Bytes(), 32)...)

	// nonce (32 bytes)
	nonceBytes := make([]byte, 32)
	if userOp.Nonce != nil {
		userOp.Nonce.FillBytes(nonceBytes)
	}
	data = append(data, nonceBytes...)

	// initCodeHash (32 bytes)
	data = append(data, initCodeHash...)

	// callDataHash (32 bytes)
	data = append(data, callDataHash...)

	// accountGasLimits (32 bytes)
	data = append(data, accountGasLimits...)

	// preVerificationGas (32 bytes)
	preVerifGasBytes := make([]byte, 32)
	if userOp.PreVerificationGas != nil {
		userOp.PreVerificationGas.FillBytes(preVerifGasBytes)
	}
	data = append(data, preVerifGasBytes...)

	// gasFees (32 bytes)
	data = append(data, gasFees...)

	// chainId (32 bytes)
	chainIDBytes := make([]byte, 32)
	new(big.Int).SetUint64(chainID).FillBytes(chainIDBytes)
	data = append(data, chainIDBytes...)

	// paymaster address (20 bytes, padded to 32)
	data = append(data, common.LeftPadBytes(paymasterAddress.Bytes(), 32)...)

	// validUntil (6 bytes, padded to 32)
	validUntilBytes := make([]byte, 32)
	new(big.Int).SetUint64(validUntil).FillBytes(validUntilBytes)
	data = append(data, validUntilBytes...)

	// validAfter (6 bytes, padded to 32)
	validAfterBytes := make([]byte, 32)
	new(big.Int).SetUint64(validAfter).FillBytes(validAfterBytes)
	data = append(data, validAfterBytes...)

	return crypto.Keccak256(data)
}

// packGasLimits packs two gas values into a single bytes32.
func packGasLimits(a, b *big.Int) []byte {
	result := make([]byte, 32)

	// a as uint128 (16 bytes)
	if a != nil {
		aBytes := make([]byte, 16)
		a.FillBytes(aBytes)
		copy(result[0:16], aBytes)
	}

	// b as uint128 (16 bytes)
	if b != nil {
		bBytes := make([]byte, 16)
		b.FillBytes(bBytes)
		copy(result[16:32], bBytes)
	}

	return result
}

// DecodeVerifyingPaymasterData decodes verifying paymaster data.
func DecodeVerifyingPaymasterData(data types.Hex) (validUntil, validAfter uint64, signature types.Hex, err error) {
	if len(data) < 77 {
		return 0, 0, nil, fmt.Errorf("invalid paymaster data length: expected at least 77 bytes")
	}

	// ValidUntil (6 bytes, big-endian)
	for i := 0; i < 6; i++ {
		validUntil |= uint64(data[5-i]) << (8 * i)
	}

	// ValidAfter (6 bytes, big-endian)
	for i := 0; i < 6; i++ {
		validAfter |= uint64(data[11-i]) << (8 * i)
	}

	// Signature (remaining bytes)
	signature = types.Hex(data[12:])

	return validUntil, validAfter, signature, nil
}
