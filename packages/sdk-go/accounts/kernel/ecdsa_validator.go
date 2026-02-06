package kernel

import (
	"context"
	"crypto/ecdsa"
	"fmt"

	"github.com/ethereum/go-ethereum/common"
	ethaccounts "github.com/ethereum/go-ethereum/accounts"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/accounts"
	"github.com/stablenet/sdk-go/types"
)

// ECDSAValidatorAddress is the default ECDSA validator address.
// This should be updated with the actual deployed address.
var ECDSAValidatorAddress = common.HexToAddress("0x0000000000000000000000000000000000000000")

// SignMode represents the signing mode for ECDSA validator.
type SignMode uint8

const (
	// SignModePersonal uses EIP-191 personal_sign format.
	// This prepends "\x19Ethereum Signed Message:\n32" before signing.
	// This is the default mode and matches TypeScript SDK behavior.
	SignModePersonal SignMode = iota

	// SignModeRaw signs the hash directly without any prefix.
	// Use this mode if the validator contract expects raw signatures.
	SignModeRaw
)

// ECDSAValidator implements the Validator interface using ECDSA signing.
type ECDSAValidator struct {
	address    types.Address
	privateKey *ecdsa.PrivateKey
	owner      types.Address
	signMode   SignMode
}

// ECDSAValidatorConfig configures an ECDSA validator.
type ECDSAValidatorConfig struct {
	// ValidatorAddress is the ECDSA validator module address.
	// If not set, uses the default ECDSAValidatorAddress.
	ValidatorAddress types.Address

	// PrivateKey is the ECDSA private key for signing.
	PrivateKey *ecdsa.PrivateKey

	// SignMode determines how signatures are created.
	// Default is SignModePersonal (EIP-191) to match TypeScript SDK.
	SignMode SignMode
}

// NewECDSAValidator creates a new ECDSA validator.
func NewECDSAValidator(config ECDSAValidatorConfig) (*ECDSAValidator, error) {
	if config.PrivateKey == nil {
		return nil, fmt.Errorf("private key is required")
	}

	address := config.ValidatorAddress
	if address == (types.Address{}) {
		address = ECDSAValidatorAddress
	}

	owner := ethcrypto.PubkeyToAddress(config.PrivateKey.PublicKey)

	return &ECDSAValidator{
		address:    address,
		privateKey: config.PrivateKey,
		owner:      owner,
		signMode:   config.SignMode,
	}, nil
}

// Address returns the validator module address.
func (v *ECDSAValidator) Address() types.Address {
	return v.address
}

// GetInitData returns the initialization data for the validator.
// For ECDSA validator, this is the owner address (20 bytes).
func (v *ECDSAValidator) GetInitData(ctx context.Context) (types.Hex, error) {
	return types.Hex(v.owner.Bytes()), nil
}

// SignHash signs a hash with this validator.
// Uses EIP-191 personal_sign format by default (matching TypeScript SDK).
func (v *ECDSAValidator) SignHash(ctx context.Context, hash types.Hash) (types.Hex, error) {
	var hashToSign []byte

	switch v.signMode {
	case SignModePersonal:
		// EIP-191 personal_sign: sign the hash as an Ethereum signed message
		// This matches viem's signMessage({ message: { raw: hash } })
		hashToSign = ethaccounts.TextHash(hash[:])
	case SignModeRaw:
		// Raw mode: sign the hash directly
		hashToSign = hash[:]
	default:
		// Default to personal sign mode
		hashToSign = ethaccounts.TextHash(hash[:])
	}

	sig, err := ethcrypto.Sign(hashToSign, v.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign hash: %w", err)
	}

	// Adjust V value for Ethereum compatibility (27 or 28)
	if sig[64] < 27 {
		sig[64] += 27
	}

	return types.Hex(sig), nil
}

// SignRawHash signs a hash directly without EIP-191 prefix.
// This is useful when you need raw signature regardless of the validator's default mode.
func (v *ECDSAValidator) SignRawHash(ctx context.Context, hash types.Hash) (types.Hex, error) {
	sig, err := ethcrypto.Sign(hash[:], v.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign hash: %w", err)
	}

	// Adjust V value for Ethereum compatibility (27 or 28)
	if sig[64] < 27 {
		sig[64] += 27
	}

	return types.Hex(sig), nil
}

// SignPersonalHash signs a hash with EIP-191 personal_sign format.
// This is useful when you need personal_sign regardless of the validator's default mode.
func (v *ECDSAValidator) SignPersonalHash(ctx context.Context, hash types.Hash) (types.Hex, error) {
	hashToSign := ethaccounts.TextHash(hash[:])
	sig, err := ethcrypto.Sign(hashToSign, v.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign hash: %w", err)
	}

	// Adjust V value for Ethereum compatibility (27 or 28)
	if sig[64] < 27 {
		sig[64] += 27
	}

	return types.Hex(sig), nil
}

// GetSignerAddress returns the signer address.
func (v *ECDSAValidator) GetSignerAddress() types.Address {
	return v.owner
}

// Ensure ECDSAValidator implements the Validator interface.
var _ accounts.Validator = (*ECDSAValidator)(nil)
