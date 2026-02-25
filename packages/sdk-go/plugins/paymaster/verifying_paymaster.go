package paymaster

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/core"
	corepaymaster "github.com/stablenet/sdk-go/core/paymaster"
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Verifying Paymaster Configuration
// ============================================================================

// VerifyingPaymasterConfig configures the verifying paymaster.
type VerifyingPaymasterConfig struct {
	// PaymasterAddress is the paymaster contract address.
	PaymasterAddress types.Address
	// EntryPointAddress is the EntryPoint contract address (default: ERC-4337 v0.7).
	EntryPointAddress *types.Address
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
	config          VerifyingPaymasterConfig
	privateKey      *ecdsa.PrivateKey
	entryPoint      types.Address
	domainSeparator types.Hash
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

	entryPoint := core.EntryPointV07Address
	if cfg.EntryPointAddress != nil {
		entryPoint = *cfg.EntryPointAddress
	}

	// Pre-compute domain separator (immutable for given chain/entrypoint/paymaster)
	chainID := new(big.Int).SetUint64(uint64(cfg.ChainID))
	domainSeparator := corepaymaster.ComputeDomainSeparator(chainID, entryPoint, cfg.PaymasterAddress)

	return &VerifyingPaymaster{
		config:          cfg,
		privateKey:      privateKey,
		entryPoint:      entryPoint,
		domainSeparator: domainSeparator,
	}, nil
}

// GetPaymasterStubData returns stub data for gas estimation.
func (v *VerifyingPaymaster) GetPaymasterStubData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*StubData, error) {
	// Build envelope with placeholder timestamps and empty payload
	validUntil := uint64(time.Now().Unix()) + uint64(v.config.ValiditySeconds)
	validAfter := uint64(0)

	envelope, err := corepaymaster.EncodePaymasterData(&corepaymaster.Envelope{
		PaymasterType: corepaymaster.PaymasterTypeVerifying,
		Flags:         0,
		ValidUntil:    validUntil,
		ValidAfter:    validAfter,
		Nonce:         0,
		Payload:       nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to encode stub envelope: %w", err)
	}

	// Append a 65-byte stub signature
	stubSig := make([]byte, 65)
	paymasterData := corepaymaster.ConcatWithSignature(envelope, stubSig)

	return &StubData{
		Paymaster:                     v.config.PaymasterAddress,
		PaymasterData:                 types.Hex(paymasterData),
		PaymasterVerificationGasLimit: big.NewInt(DefaultVerifyingPaymasterVerificationGas),
		PaymasterPostOpGasLimit:       big.NewInt(DefaultVerifyingPaymasterPostOpGas),
	}, nil
}

// GetPaymasterData returns the final paymaster data with signature.
func (v *VerifyingPaymaster) GetPaymasterData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*PaymasterData, error) {
	// Set validity window
	validUntil := uint64(time.Now().Unix()) + uint64(v.config.ValiditySeconds)
	validAfter := uint64(0)

	// Build v2 envelope (without signature)
	envelope, err := corepaymaster.EncodePaymasterData(&corepaymaster.Envelope{
		PaymasterType: corepaymaster.PaymasterTypeVerifying,
		Flags:         0,
		ValidUntil:    validUntil,
		ValidAfter:    validAfter,
		Nonce:         0,
		Payload:       nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to encode envelope: %w", err)
	}

	// Compute user op core hash
	nonce := big.NewInt(0)
	if userOp.Nonce != nil {
		nonce = userOp.Nonce
	}
	preVerificationGas := big.NewInt(0)
	if userOp.PreVerificationGas != nil {
		preVerificationGas = userOp.PreVerificationGas
	}

	// Build initCode from factory + factoryData
	var initCode []byte
	if userOp.Factory != nil {
		initCode = append(initCode, userOp.Factory.Bytes()...)
		initCode = append(initCode, userOp.FactoryData.Bytes()...)
	}

	accountGasLimits := corepaymaster.PackGasLimits(userOp.VerificationGasLimit, userOp.CallGasLimit)
	gasFees := corepaymaster.PackGasLimits(userOp.MaxPriorityFeePerGas, userOp.MaxFeePerGas)

	userOpCoreHash := corepaymaster.ComputeUserOpCoreHash(&corepaymaster.UserOpCoreFields{
		Sender:             userOp.Sender,
		Nonce:              nonce,
		InitCode:           initCode,
		CallData:           userOp.CallData.Bytes(),
		AccountGasLimits:   accountGasLimits,
		PreVerificationGas: preVerificationGas,
		GasFees:            gasFees,
	})

	// Compute the hash that needs to be signed
	paymasterHash := corepaymaster.ComputePaymasterHash(v.domainSeparator, userOpCoreHash, envelope)

	// Sign the hash
	signature, err := crypto.Sign(paymasterHash.Bytes(), v.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign paymaster hash: %w", err)
	}

	// Concatenate envelope + signature
	paymasterData := corepaymaster.ConcatWithSignature(envelope, signature)

	return &PaymasterData{
		Paymaster:                     v.config.PaymasterAddress,
		PaymasterData:                 types.Hex(paymasterData),
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

// DecodeVerifyingPaymasterData decodes verifying paymaster data using the v2 envelope format.
// Returns the decoded envelope and the trailing signature.
func DecodeVerifyingPaymasterData(data types.Hex) (*corepaymaster.Envelope, types.Hex, error) {
	envelope, sig, err := corepaymaster.SplitEnvelopeAndSignature(data.Bytes(), 65)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to split envelope and signature: %w", err)
	}

	env, err := corepaymaster.DecodePaymasterData(envelope)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decode envelope: %w", err)
	}

	return env, types.Hex(sig), nil
}
