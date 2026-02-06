// Package ecdsa provides an ECDSA validator for ERC-7579 smart accounts.
//
// The ECDSA validator allows smart accounts to validate signatures
// using the standard ECDSA algorithm with secp256k1 curve.
//
// # Basic Usage
//
//	// Create validator from private key
//	privateKey, _ := crypto.GenerateKey()
//	validator, err := ecdsa.CreateEcdsaValidator(&ecdsa.CreateEcdsaValidatorConfig{
//	    Signer: privateKey,
//	})
//
//	// Get init data for module installation
//	initData, _ := validator.GetInitData()
//
//	// Sign a hash
//	signature, _ := validator.SignHash(hash)
//
//	// Get signer address
//	signerAddr := validator.GetSignerAddress()
package ecdsa

import (
	"context"
	"crypto/ecdsa"
	"fmt"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/types"
)

// Default ECDSA validator contract address (mainnet).
var DefaultECDSAValidatorAddress = common.HexToAddress("0x2E8E4f74B6c6a8b71c4D7F8c5d6b5e8b9c0d1e2f")

// Sepolia ECDSA validator contract address.
var SepoliaECDSAValidatorAddress = common.HexToAddress("0x3F9A8b7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A")

// ============================================================================
// Types
// ============================================================================

// CreateEcdsaValidatorConfig contains configuration for creating an ECDSA validator.
type CreateEcdsaValidatorConfig struct {
	// Signer is the ECDSA private key for signing.
	Signer *ecdsa.PrivateKey
	// ValidatorAddress is the optional validator contract address.
	// If not provided, DefaultECDSAValidatorAddress is used.
	ValidatorAddress *types.Address
}

// Validator represents an ECDSA validator instance.
type Validator struct {
	// Address is the validator contract address.
	Address types.Address
	// Type is always "validator".
	Type string
	// signer is the private key.
	signer *ecdsa.PrivateKey
	// signerAddress is the derived public address.
	signerAddress types.Address
}

// SerializedValidator represents a serialized validator for storage.
type SerializedValidator struct {
	// Address is the validator contract address.
	Address types.Address `json:"address"`
	// SignerAddress is the signer's public address.
	SignerAddress types.Address `json:"signerAddress"`
}

// ============================================================================
// Factory Functions
// ============================================================================

// CreateEcdsaValidator creates a new ECDSA validator from a private key.
func CreateEcdsaValidator(config *CreateEcdsaValidatorConfig) (*Validator, error) {
	if config.Signer == nil {
		return nil, fmt.Errorf("signer private key is required")
	}

	// Get validator address
	validatorAddr := types.Address(DefaultECDSAValidatorAddress)
	if config.ValidatorAddress != nil {
		validatorAddr = *config.ValidatorAddress
	}

	// Derive signer address from public key
	publicKey := config.Signer.Public().(*ecdsa.PublicKey)
	signerAddr := types.Address(crypto.PubkeyToAddress(*publicKey))

	return &Validator{
		Address:       validatorAddr,
		Type:          "validator",
		signer:        config.Signer,
		signerAddress: signerAddr,
	}, nil
}

// CreateEcdsaValidatorFromPrivateKey creates a validator from a hex-encoded private key.
func CreateEcdsaValidatorFromPrivateKey(privateKeyHex string, validatorAddress *types.Address) (*Validator, error) {
	// Parse private key
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	return CreateEcdsaValidator(&CreateEcdsaValidatorConfig{
		Signer:           privateKey,
		ValidatorAddress: validatorAddress,
	})
}

// ============================================================================
// Validator Methods
// ============================================================================

// GetInitData returns the initialization data for installing this validator.
// For ECDSA validator, init data is simply the signer address (20 bytes).
func (v *Validator) GetInitData() (types.Hex, error) {
	return types.Hex(v.signerAddress[:]), nil
}

// SignHash signs a hash using the ECDSA private key.
// Returns the signature in the format expected by the validator contract.
func (v *Validator) SignHash(hash types.Hash) (types.Hex, error) {
	// Sign the hash
	signature, err := crypto.Sign(hash[:], v.signer)
	if err != nil {
		return nil, fmt.Errorf("failed to sign hash: %w", err)
	}

	// Adjust recovery ID (v) for Ethereum compatibility
	// go-ethereum returns v as 0 or 1, but Ethereum expects 27 or 28
	if signature[64] < 27 {
		signature[64] += 27
	}

	return types.Hex(signature), nil
}

// SignHashWithContext signs a hash with context support.
func (v *Validator) SignHashWithContext(ctx context.Context, hash types.Hash) (types.Hex, error) {
	// Check context
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	return v.SignHash(hash)
}

// GetSignerAddress returns the signer's public address.
func (v *Validator) GetSignerAddress() types.Address {
	return v.signerAddress
}

// GetAddress returns the validator contract address.
func (v *Validator) GetAddress() types.Address {
	return v.Address
}

// GetType returns the validator type.
func (v *Validator) GetType() string {
	return v.Type
}

// ============================================================================
// Serialization
// ============================================================================

// Serialize serializes the validator for storage.
// Note: The private key is NOT included in serialization.
func (v *Validator) Serialize() *SerializedValidator {
	return &SerializedValidator{
		Address:       v.Address,
		SignerAddress: v.signerAddress,
	}
}

// ============================================================================
// Signature Utilities
// ============================================================================

// EncodeSignature encodes a signature in the standard Ethereum format.
// Input: r (32 bytes) + s (32 bytes) + v (1 byte)
// Output: concatenated bytes
func EncodeSignature(r, s types.Hash, v uint8) types.Hex {
	sig := make([]byte, 65)
	copy(sig[0:32], r[:])
	copy(sig[32:64], s[:])
	sig[64] = v
	return types.Hex(sig)
}

// DecodeSignature decodes a signature from the standard Ethereum format.
func DecodeSignature(sig types.Hex) (r, s types.Hash, v uint8, err error) {
	if len(sig) != 65 {
		return types.Hash{}, types.Hash{}, 0, fmt.Errorf("invalid signature length: expected 65, got %d", len(sig))
	}

	copy(r[:], sig[0:32])
	copy(s[:], sig[32:64])
	v = sig[64]

	return r, s, v, nil
}

// RecoverAddress recovers the signer address from a signature and message hash.
func RecoverAddress(hash types.Hash, sig types.Hex) (types.Address, error) {
	if len(sig) != 65 {
		return types.Address{}, fmt.Errorf("invalid signature length: expected 65, got %d", len(sig))
	}

	// Adjust v if needed
	sigCopy := make([]byte, 65)
	copy(sigCopy, sig)
	if sigCopy[64] >= 27 {
		sigCopy[64] -= 27
	}

	// Recover public key
	pubKey, err := crypto.SigToPub(hash[:], sigCopy)
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to recover public key: %w", err)
	}

	return types.Address(crypto.PubkeyToAddress(*pubKey)), nil
}

// VerifySignature verifies that a signature was made by the expected signer.
func VerifySignature(hash types.Hash, sig types.Hex, expectedSigner types.Address) (bool, error) {
	recoveredAddr, err := RecoverAddress(hash, sig)
	if err != nil {
		return false, err
	}

	return recoveredAddr == expectedSigner, nil
}
