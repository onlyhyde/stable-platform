// Package utils provides utility functions for ERC-7579 modules.
package utils

import (
	"fmt"
	"math/big"
	"regexp"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ValidationResult contains the result of a validation check.
type ValidationResult struct {
	Valid  bool
	Errors []string
}

// IsValid returns true if validation passed.
func (v *ValidationResult) IsValid() bool {
	return v.Valid
}

// AddError adds an error to the validation result.
func (v *ValidationResult) AddError(err string) {
	v.Errors = append(v.Errors, err)
	v.Valid = false
}

// addressRegex is used to validate Ethereum addresses.
var addressRegex = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)

// ZeroAddress is the zero Ethereum address.
var ZeroAddress = common.HexToAddress("0x0000000000000000000000000000000000000000")

// ============================================================================
// ECDSA Validator Utils
// ============================================================================

// EncodeECDSAValidatorInit encodes ECDSA validator initialization data.
// The init data is just the owner address (20 bytes).
func EncodeECDSAValidatorInit(config types.ECDSAValidatorConfig) (types.Hex, error) {
	addressType, _ := abi.NewType("address", "", nil)
	arguments := abi.Arguments{{Type: addressType}}

	encoded, err := arguments.Pack(config.Owner)
	if err != nil {
		return nil, fmt.Errorf("failed to encode ECDSA validator init: %w", err)
	}

	return types.Hex(encoded), nil
}

// DecodeECDSAValidatorInit decodes ECDSA validator initialization data.
func DecodeECDSAValidatorInit(data types.Hex) (*types.ECDSAValidatorConfig, error) {
	addressType, _ := abi.NewType("address", "", nil)
	arguments := abi.Arguments{{Type: addressType}}

	values, err := arguments.Unpack(data.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to decode ECDSA validator init: %w", err)
	}

	if len(values) < 1 {
		return nil, fmt.Errorf("insufficient data for ECDSA validator init")
	}

	owner, ok := values[0].(common.Address)
	if !ok {
		return nil, fmt.Errorf("invalid owner address type")
	}

	return &types.ECDSAValidatorConfig{Owner: owner}, nil
}

// ValidateECDSAValidatorConfig validates ECDSA validator configuration.
func ValidateECDSAValidatorConfig(config types.ECDSAValidatorConfig) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate owner address
	if config.Owner == (types.Address{}) {
		result.AddError("Owner address is required")
	} else if !addressRegex.MatchString(config.Owner.Hex()) {
		result.AddError("Owner must be a valid Ethereum address")
	} else if config.Owner == ZeroAddress {
		result.AddError("Owner cannot be zero address")
	}

	return result
}

// EncodeECDSASignature encodes an ECDSA signature (r || s || v format).
func EncodeECDSASignature(r, s types.Hex, v uint8) types.Hex {
	sig := make([]byte, 65)
	copy(sig[0:32], common.LeftPadBytes(r.Bytes(), 32))
	copy(sig[32:64], common.LeftPadBytes(s.Bytes(), 32))
	sig[64] = v
	return types.Hex(sig)
}

// ============================================================================
// WebAuthn Validator Utils
// ============================================================================

// P256N is the P-256 curve order.
var P256N, _ = new(big.Int).SetString("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", 16)

// EncodeWebAuthnValidatorInit encodes WebAuthn validator initialization data.
func EncodeWebAuthnValidatorInit(config types.WebAuthnValidatorConfig) (types.Hex, error) {
	uint256Type, _ := abi.NewType("uint256", "", nil)
	bytesType, _ := abi.NewType("bytes", "", nil)

	arguments := abi.Arguments{
		{Type: uint256Type, Name: "pubKeyX"},
		{Type: uint256Type, Name: "pubKeyY"},
		{Type: bytesType, Name: "credentialId"},
	}

	encoded, err := arguments.Pack(config.PubKeyX, config.PubKeyY, config.CredentialId.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to encode WebAuthn validator init: %w", err)
	}

	return types.Hex(encoded), nil
}

// DecodeWebAuthnValidatorInit decodes WebAuthn validator initialization data.
func DecodeWebAuthnValidatorInit(data types.Hex) (*types.WebAuthnValidatorConfig, error) {
	uint256Type, _ := abi.NewType("uint256", "", nil)
	bytesType, _ := abi.NewType("bytes", "", nil)

	arguments := abi.Arguments{
		{Type: uint256Type, Name: "pubKeyX"},
		{Type: uint256Type, Name: "pubKeyY"},
		{Type: bytesType, Name: "credentialId"},
	}

	values, err := arguments.Unpack(data.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to decode WebAuthn validator init: %w", err)
	}

	if len(values) < 3 {
		return nil, fmt.Errorf("insufficient data for WebAuthn validator init")
	}

	pubKeyX, ok := values[0].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid pubKeyX type")
	}

	pubKeyY, ok := values[1].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid pubKeyY type")
	}

	credentialId, ok := values[2].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid credentialId type")
	}

	return &types.WebAuthnValidatorConfig{
		PubKeyX:      pubKeyX,
		PubKeyY:      pubKeyY,
		CredentialId: types.Hex(credentialId),
	}, nil
}

// ValidateWebAuthnValidatorConfig validates WebAuthn validator configuration.
func ValidateWebAuthnValidatorConfig(config types.WebAuthnValidatorConfig) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate public key X
	if config.PubKeyX == nil {
		result.AddError("Public key X coordinate is required")
	} else if config.PubKeyX.Sign() <= 0 {
		result.AddError("Public key X must be positive")
	}

	// Validate public key Y
	if config.PubKeyY == nil {
		result.AddError("Public key Y coordinate is required")
	} else if config.PubKeyY.Sign() <= 0 {
		result.AddError("Public key Y must be positive")
	}

	// Validate credential ID
	if len(config.CredentialId) == 0 {
		result.AddError("Credential ID is required")
	}

	return result
}

// WebAuthnSignatureData contains WebAuthn signature data.
type WebAuthnSignatureData struct {
	AuthenticatorData types.Hex
	ClientDataJSON    types.Hex
	ChallengeIndex    int
	TypeIndex         int
	R                 *big.Int
	S                 *big.Int
}

// EncodeWebAuthnSignature encodes a WebAuthn signature.
func EncodeWebAuthnSignature(data WebAuthnSignatureData) (types.Hex, error) {
	bytesType, _ := abi.NewType("bytes", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)

	arguments := abi.Arguments{
		{Type: bytesType, Name: "authenticatorData"},
		{Type: bytesType, Name: "clientDataJSON"},
		{Type: uint256Type, Name: "challengeIndex"},
		{Type: uint256Type, Name: "typeIndex"},
		{Type: uint256Type, Name: "r"},
		{Type: uint256Type, Name: "s"},
	}

	// Ensure s is in lower half of curve order (malleability fix)
	s := new(big.Int).Set(data.S)
	halfN := new(big.Int).Div(P256N, big.NewInt(2))
	if s.Cmp(halfN) > 0 {
		s.Sub(P256N, s)
	}

	encoded, err := arguments.Pack(
		data.AuthenticatorData.Bytes(),
		data.ClientDataJSON.Bytes(),
		big.NewInt(int64(data.ChallengeIndex)),
		big.NewInt(int64(data.TypeIndex)),
		data.R,
		s,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode WebAuthn signature: %w", err)
	}

	return types.Hex(encoded), nil
}

// ============================================================================
// MultiSig Validator Utils
// ============================================================================

const (
	MinMultiSigSigners = 1
	MaxMultiSigSigners = 10
)

// EncodeMultiSigValidatorInit encodes MultiSig validator initialization data.
func EncodeMultiSigValidatorInit(config types.MultiSigValidatorConfig) (types.Hex, error) {
	addressArrayType, _ := abi.NewType("address[]", "", nil)
	uint8Type, _ := abi.NewType("uint8", "", nil)

	arguments := abi.Arguments{
		{Type: addressArrayType, Name: "signers"},
		{Type: uint8Type, Name: "threshold"},
	}

	// Convert signers to []common.Address
	signers := make([]common.Address, len(config.Signers))
	for i, s := range config.Signers {
		signers[i] = s
	}

	encoded, err := arguments.Pack(signers, config.Threshold)
	if err != nil {
		return nil, fmt.Errorf("failed to encode MultiSig validator init: %w", err)
	}

	return types.Hex(encoded), nil
}

// DecodeMultiSigValidatorInit decodes MultiSig validator initialization data.
func DecodeMultiSigValidatorInit(data types.Hex) (*types.MultiSigValidatorConfig, error) {
	addressArrayType, _ := abi.NewType("address[]", "", nil)
	uint8Type, _ := abi.NewType("uint8", "", nil)

	arguments := abi.Arguments{
		{Type: addressArrayType, Name: "signers"},
		{Type: uint8Type, Name: "threshold"},
	}

	values, err := arguments.Unpack(data.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to decode MultiSig validator init: %w", err)
	}

	if len(values) < 2 {
		return nil, fmt.Errorf("insufficient data for MultiSig validator init")
	}

	signersRaw, ok := values[0].([]common.Address)
	if !ok {
		return nil, fmt.Errorf("invalid signers type")
	}

	threshold, ok := values[1].(uint8)
	if !ok {
		return nil, fmt.Errorf("invalid threshold type")
	}

	signers := make([]types.Address, len(signersRaw))
	for i, s := range signersRaw {
		signers[i] = s
	}

	return &types.MultiSigValidatorConfig{
		Signers:   signers,
		Threshold: threshold,
	}, nil
}

// ValidateMultiSigValidatorConfig validates MultiSig validator configuration.
func ValidateMultiSigValidatorConfig(config types.MultiSigValidatorConfig) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate signers array
	if len(config.Signers) == 0 {
		result.AddError("At least one signer is required")
	} else if len(config.Signers) < MinMultiSigSigners {
		result.AddError(fmt.Sprintf("At least %d signer is required", MinMultiSigSigners))
	} else if len(config.Signers) > MaxMultiSigSigners {
		result.AddError(fmt.Sprintf("Maximum %d signers allowed", MaxMultiSigSigners))
	} else {
		// Validate each signer address
		for i, signer := range config.Signers {
			if !addressRegex.MatchString(signer.Hex()) {
				result.AddError(fmt.Sprintf("Signer %d must be a valid Ethereum address", i+1))
			}
			if signer == ZeroAddress {
				result.AddError(fmt.Sprintf("Signer %d cannot be zero address", i+1))
			}
		}

		// Check for duplicates
		seen := make(map[string]bool)
		for _, signer := range config.Signers {
			addr := strings.ToLower(signer.Hex())
			if seen[addr] {
				result.AddError("Duplicate signer addresses are not allowed")
				break
			}
			seen[addr] = true
		}
	}

	// Validate threshold
	if config.Threshold < 1 {
		result.AddError("Threshold must be at least 1")
	} else if len(config.Signers) > 0 && int(config.Threshold) > len(config.Signers) {
		result.AddError("Threshold cannot be greater than number of signers")
	}

	return result
}

// MultiSigSignature represents a signature for multi-sig validation.
type MultiSigSignature struct {
	Signer types.Address
	R      types.Hex
	S      types.Hex
	V      uint8
}

// EncodeMultiSigSignature encodes multiple signatures for multi-sig validation.
// Signatures are sorted by signer address for deterministic ordering.
func EncodeMultiSigSignature(signatures []MultiSigSignature) types.Hex {
	// Sort by signer address
	sorted := make([]MultiSigSignature, len(signatures))
	copy(sorted, signatures)
	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if strings.ToLower(sorted[i].Signer.Hex()) > strings.ToLower(sorted[j].Signer.Hex()) {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	// Concatenate signatures
	result := make([]byte, 0, len(sorted)*65)
	for _, sig := range sorted {
		sigBytes := EncodeECDSASignature(sig.R, sig.S, sig.V)
		result = append(result, sigBytes.Bytes()...)
	}

	return types.Hex(result)
}

// ============================================================================
// Common Validator Utils
// ============================================================================

// IdentifyValidatorType returns the validator type name based on address.
func IdentifyValidatorType(address types.Address, knownValidators map[string]types.Address) string {
	normalizedAddress := strings.ToLower(address.Hex())

	for typeName, addr := range knownValidators {
		if strings.ToLower(addr.Hex()) == normalizedAddress {
			return typeName
		}
	}

	return ""
}

// IsValidSignatureFormat checks if a signature has valid format (at least 65 bytes).
func IsValidSignatureFormat(signature types.Hex) bool {
	return len(signature) >= 65
}
