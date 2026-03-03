// Package userop provides validation data utilities for EIP-4337.
package userop

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// ============================================================================
// Constants
// ============================================================================

// SigValidationFailed indicates signature validation failed (authorizer = 1).
var SigValidationFailed = big.NewInt(1)

// ValidityBlockRangeFlag is the bit 47 flag for block number mode.
// When set on validUntil or validAfter, the value is a block number, not a timestamp.
var ValidityBlockRangeFlag = new(big.Int).SetUint64(0x800_000_000_000)

// ValidityBlockRangeMask extracts the actual value (lower 47 bits).
var ValidityBlockRangeMask = new(big.Int).SetUint64(0x7ff_fff_fff_fff)

// uint48Mask is the mask for 6-byte (48-bit) values.
var uint48Mask = new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 48), big.NewInt(1))

// ============================================================================
// Types
// ============================================================================

// ValidationData represents parsed EIP-4337 validationData (uint256).
//
// Layout: | authorizer (20 bytes) | validUntil (6 bytes) | validAfter (6 bytes) |
type ValidationData struct {
	// Authorizer: zero address = valid, 0x01 = SIG_VALIDATION_FAILED, other = aggregator
	Authorizer common.Address

	// ValidUntil is the expiry time/block (0 = infinite).
	ValidUntil *big.Int

	// ValidAfter is the start time/block.
	ValidAfter *big.Int

	// ValidUntilIsBlockNumber is true if validUntil uses block number mode.
	ValidUntilIsBlockNumber bool

	// ValidAfterIsBlockNumber is true if validAfter uses block number mode.
	ValidAfterIsBlockNumber bool

	// IsSignatureFailed is true if authorizer = 1 (SIG_VALIDATION_FAILED).
	IsSignatureFailed bool
}

// ============================================================================
// Parse
// ============================================================================

// ParseValidationData parses a uint256 validationData into its components.
func ParseValidationData(data *big.Int) *ValidationData {
	if data == nil {
		data = big.NewInt(0)
	}

	// authorizer: top 20 bytes (bits 96..255)
	authorizerRaw := new(big.Int).Rsh(data, 96)

	// validUntil: next 6 bytes (bits 48..95)
	validUntilRaw := new(big.Int).And(new(big.Int).Rsh(data, 48), uint48Mask)

	// validAfter: bottom 6 bytes (bits 0..47)
	validAfterRaw := new(big.Int).And(data, uint48Mask)

	// Block number mode detection (bit 47)
	validUntilIsBlockNumber := new(big.Int).And(validUntilRaw, ValidityBlockRangeFlag).Sign() > 0
	validAfterIsBlockNumber := new(big.Int).And(validAfterRaw, ValidityBlockRangeFlag).Sign() > 0

	// Extract actual values (mask out bit 47 if block mode)
	validUntil := new(big.Int).Set(validUntilRaw)
	if validUntilIsBlockNumber {
		validUntil.And(validUntil, ValidityBlockRangeMask)
	}

	validAfter := new(big.Int).Set(validAfterRaw)
	if validAfterIsBlockNumber {
		validAfter.And(validAfter, ValidityBlockRangeMask)
	}

	// Authorizer interpretation
	isSigFailed := authorizerRaw.Cmp(SigValidationFailed) == 0
	authorizer := common.BigToAddress(authorizerRaw)

	return &ValidationData{
		Authorizer:              authorizer,
		ValidUntil:              validUntil,
		ValidAfter:              validAfter,
		ValidUntilIsBlockNumber: validUntilIsBlockNumber,
		ValidAfterIsBlockNumber: validAfterIsBlockNumber,
		IsSignatureFailed:       isSigFailed,
	}
}

// ============================================================================
// Pack
// ============================================================================

// PackValidationData packs validation data components into a uint256.
//
// Parameters:
//   - authorizer: 0 (valid), 1 (sig failed), or aggregator address
//   - validUntil: expiry time/block (0 = infinite)
//   - validAfter: start time/block
//   - useBlockNumbers: if true, sets bit 47 flag on both validUntil and validAfter
func PackValidationData(authorizer common.Address, validUntil, validAfter *big.Int, useBlockNumbers bool) *big.Int {
	until := new(big.Int).Set(validUntil)
	after := new(big.Int).Set(validAfter)

	if useBlockNumbers {
		until.Or(until, ValidityBlockRangeFlag)
		after.Or(after, ValidityBlockRangeFlag)
	}

	// Pack: authorizer(20B) << 96 | validUntil(6B) << 48 | validAfter(6B)
	result := new(big.Int).SetBytes(authorizer.Bytes())
	result.Lsh(result, 96)
	result.Or(result, new(big.Int).Lsh(new(big.Int).And(until, uint48Mask), 48))
	result.Or(result, new(big.Int).And(after, uint48Mask))

	return result
}

// ============================================================================
// Helpers
// ============================================================================

// IsSignatureValidationFailed checks if validationData indicates signature failure.
func IsSignatureValidationFailed(data *big.Int) bool {
	authorizer := new(big.Int).Rsh(data, 96)
	return authorizer.Cmp(SigValidationFailed) == 0
}

// UsesBlockNumberMode checks if validationData uses block number mode for either field.
func UsesBlockNumberMode(data *big.Int) bool {
	validUntilRaw := new(big.Int).And(new(big.Int).Rsh(data, 48), uint48Mask)
	validAfterRaw := new(big.Int).And(data, uint48Mask)
	return new(big.Int).And(validUntilRaw, ValidityBlockRangeFlag).Sign() > 0 ||
		new(big.Int).And(validAfterRaw, ValidityBlockRangeFlag).Sign() > 0
}
