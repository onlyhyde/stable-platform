package paymaster

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/core"
	corepaymaster "github.com/stablenet/sdk-go/core/paymaster"
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Permit2 Paymaster Configuration
// ============================================================================

// Permit2PaymasterConfig configures the Permit2 paymaster.
type Permit2PaymasterConfig struct {
	// PaymasterAddress is the Permit2Paymaster contract address.
	PaymasterAddress types.Address
	// EntryPointAddress is the EntryPoint contract address (default: ERC-4337 v0.7).
	EntryPointAddress *types.Address
	// Permit2Address is the Permit2 contract address.
	Permit2Address types.Address
	// PrivateKey is the signer's private key for signing permits.
	PrivateKey types.Hex
	// ChainID is the chain ID.
	ChainID types.ChainID
	// TokenAddress is the ERC20 token address for gas payment.
	TokenAddress types.Address
	// ValiditySeconds is the permit validity in seconds (default: 3600).
	ValiditySeconds int
	// InitialNonce is the initial Permit2 nonce (auto-incremented).
	InitialNonce uint64
}

// Default gas limits for Permit2Paymaster operations.
const (
	DefaultPermit2VerificationGas = 150_000 // Higher due to Permit2 verification
	DefaultPermit2PostOpGas       = 80_000
)

// Permit2 EIP-712 constants.
const (
	Permit2DomainName = "Permit2"
)

// ============================================================================
// Permit2 Paymaster
// ============================================================================

// Permit2Paymaster uses Uniswap Permit2 for gasless token approvals.
type Permit2Paymaster struct {
	config          Permit2PaymasterConfig
	privateKey      *ecdsa.PrivateKey
	signerPubKey    types.Address
	entryPoint      types.Address
	domainSeparator types.Hash
	nonce           uint64
	nonceMu         sync.Mutex
}

// NewPermit2Paymaster creates a new Permit2 paymaster.
func NewPermit2Paymaster(cfg Permit2PaymasterConfig) (*Permit2Paymaster, error) {
	if len(cfg.PrivateKey) == 0 {
		return nil, fmt.Errorf("private key is required")
	}

	// Parse private key
	privateKey, err := crypto.ToECDSA(cfg.PrivateKey.Bytes())
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	// Derive signer address
	publicKey := privateKey.Public().(*ecdsa.PublicKey)
	signerPubKey := crypto.PubkeyToAddress(*publicKey)

	if cfg.ValiditySeconds == 0 {
		cfg.ValiditySeconds = DefaultValiditySeconds
	}

	entryPoint := core.EntryPointV07Address
	if cfg.EntryPointAddress != nil {
		entryPoint = *cfg.EntryPointAddress
	}

	// Pre-compute domain separator
	chainID := new(big.Int).SetUint64(uint64(cfg.ChainID))
	domainSeparator := corepaymaster.ComputeDomainSeparator(chainID, entryPoint, cfg.PaymasterAddress)

	return &Permit2Paymaster{
		config:          cfg,
		privateKey:      privateKey,
		signerPubKey:    signerPubKey,
		entryPoint:      entryPoint,
		domainSeparator: domainSeparator,
		nonce:           cfg.InitialNonce,
	}, nil
}

// GetPaymasterStubData returns stub data for gas estimation.
func (p *Permit2Paymaster) GetPaymasterStubData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*StubData, error) {
	expiration := uint64(time.Now().Unix()) + uint64(p.config.ValiditySeconds)
	amount := maxUint128()

	p.nonceMu.Lock()
	nonce := p.nonce
	p.nonceMu.Unlock()

	// Encode Permit2 payload using core encoder
	permit2Payload, err := corepaymaster.EncodePermit2Payload(&corepaymaster.Permit2Payload{
		Token:            p.config.TokenAddress,
		PermitAmount:     amount,
		PermitExpiration: expiration,
		PermitNonce:      nonce,
		PermitSig:        make([]byte, 65), // stub signature
		Permit2Extra:     nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to encode permit2 payload: %w", err)
	}

	// Build envelope
	envelope, err := corepaymaster.EncodePaymasterData(&corepaymaster.Envelope{
		PaymasterType: corepaymaster.PaymasterTypePermit2,
		Flags:         0,
		ValidUntil:    expiration,
		ValidAfter:    0,
		Nonce:         nonce,
		Payload:       permit2Payload,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to encode stub envelope: %w", err)
	}

	// Append a 65-byte stub signature
	stubSig := make([]byte, 65)
	paymasterData := corepaymaster.ConcatWithSignature(envelope, stubSig)

	return &StubData{
		Paymaster:                     p.config.PaymasterAddress,
		PaymasterData:                 types.Hex(paymasterData),
		PaymasterVerificationGasLimit: big.NewInt(DefaultPermit2VerificationGas),
		PaymasterPostOpGasLimit:       big.NewInt(DefaultPermit2PostOpGas),
	}, nil
}

// GetPaymasterData returns the final paymaster data with Permit2 signature.
func (p *Permit2Paymaster) GetPaymasterData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*PaymasterData, error) {
	expiration := uint64(time.Now().Unix()) + uint64(p.config.ValiditySeconds)
	amount := maxUint128()

	p.nonceMu.Lock()
	nonce := p.nonce
	p.nonce++ // Increment nonce for next operation
	p.nonceMu.Unlock()

	// Create Permit2 permit signature
	permitSig, err := p.signPermit2(amount, expiration, nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to sign Permit2 permit: %w", err)
	}

	// Encode Permit2 payload using core encoder
	permit2Payload, err := corepaymaster.EncodePermit2Payload(&corepaymaster.Permit2Payload{
		Token:            p.config.TokenAddress,
		PermitAmount:     amount,
		PermitExpiration: expiration,
		PermitNonce:      nonce,
		PermitSig:        permitSig,
		Permit2Extra:     nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to encode permit2 payload: %w", err)
	}

	// Build v2 envelope (without paymaster signature)
	envelope, err := corepaymaster.EncodePaymasterData(&corepaymaster.Envelope{
		PaymasterType: corepaymaster.PaymasterTypePermit2,
		Flags:         0,
		ValidUntil:    expiration,
		ValidAfter:    0,
		Nonce:         nonce,
		Payload:       permit2Payload,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to encode envelope: %w", err)
	}

	// Compute user op core hash
	nonceBig := big.NewInt(0)
	if userOp.Nonce != nil {
		nonceBig = userOp.Nonce
	}
	preVerificationGas := big.NewInt(0)
	if userOp.PreVerificationGas != nil {
		preVerificationGas = userOp.PreVerificationGas
	}

	var initCode []byte
	if userOp.Factory != nil {
		initCode = append(initCode, userOp.Factory.Bytes()...)
		initCode = append(initCode, userOp.FactoryData.Bytes()...)
	}

	accountGasLimits := corepaymaster.PackGasLimits(userOp.VerificationGasLimit, userOp.CallGasLimit)
	gasFees := corepaymaster.PackGasLimits(userOp.MaxPriorityFeePerGas, userOp.MaxFeePerGas)

	userOpCoreHash := corepaymaster.ComputeUserOpCoreHash(&corepaymaster.UserOpCoreFields{
		Sender:             userOp.Sender,
		Nonce:              nonceBig,
		InitCode:           initCode,
		CallData:           userOp.CallData.Bytes(),
		AccountGasLimits:   accountGasLimits,
		PreVerificationGas: preVerificationGas,
		GasFees:            gasFees,
	})

	// Compute paymaster hash and sign
	paymasterHash := corepaymaster.ComputePaymasterHash(p.domainSeparator, userOpCoreHash, envelope)

	signature, err := crypto.Sign(paymasterHash.Bytes(), p.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign paymaster hash: %w", err)
	}

	// Concatenate envelope + paymaster signature
	paymasterData := corepaymaster.ConcatWithSignature(envelope, signature)

	return &PaymasterData{
		Paymaster:                     p.config.PaymasterAddress,
		PaymasterData:                 types.Hex(paymasterData),
		PaymasterVerificationGasLimit: big.NewInt(DefaultPermit2VerificationGas),
		PaymasterPostOpGasLimit:       big.NewInt(DefaultPermit2PostOpGas),
	}, nil
}

// GetSupportedTokens returns the configured token.
func (p *Permit2Paymaster) GetSupportedTokens(ctx context.Context) ([]TokenInfo, error) {
	return []TokenInfo{
		{
			Address:  p.config.TokenAddress,
			Symbol:   "TOKEN", // Would need to be fetched from contract
			Decimals: 18,
		},
	}, nil
}

// EstimateTokenPayment returns a basic estimate.
func (p *Permit2Paymaster) EstimateTokenPayment(ctx context.Context, userOp *types.PartialUserOperation, token types.Address) (*TokenEstimate, error) {
	if token != p.config.TokenAddress {
		return nil, fmt.Errorf("token not supported: %s", token.Hex())
	}

	// Basic gas estimation
	gasUsed := big.NewInt(0)
	if userOp.CallGasLimit != nil {
		gasUsed.Add(gasUsed, userOp.CallGasLimit)
	}
	if userOp.VerificationGasLimit != nil {
		gasUsed.Add(gasUsed, userOp.VerificationGasLimit)
	}
	if userOp.PreVerificationGas != nil {
		gasUsed.Add(gasUsed, userOp.PreVerificationGas)
	}

	gasPrice := big.NewInt(0)
	if userOp.MaxFeePerGas != nil {
		gasPrice = userOp.MaxFeePerGas
	}
	estimatedCost := new(big.Int).Mul(gasUsed, gasPrice)

	return &TokenEstimate{
		Token: TokenInfo{
			Address:  p.config.TokenAddress,
			Decimals: 18,
		},
		Amount:      estimatedCost,
		MaxSlippage: 5.0, // 5% slippage
	}, nil
}

// IsSponsorshipAvailable returns true (Permit2 paymaster supports token payment).
func (p *Permit2Paymaster) IsSponsorshipAvailable(ctx context.Context, sender types.Address) (bool, error) {
	return true, nil
}

// GetSponsorshipPolicy returns a basic policy.
func (p *Permit2Paymaster) GetSponsorshipPolicy(ctx context.Context, sender types.Address) (*SponsorshipPolicy, error) {
	return &SponsorshipPolicy{
		IsAvailable: true,
	}, nil
}

// GetSignerAddress returns the signer's address.
func (p *Permit2Paymaster) GetSignerAddress() types.Address {
	return p.signerPubKey
}

// SetNonce sets the current nonce (useful for syncing with on-chain state).
func (p *Permit2Paymaster) SetNonce(nonce uint64) {
	p.nonceMu.Lock()
	defer p.nonceMu.Unlock()
	p.nonce = nonce
}

// GetNonce returns the current nonce.
func (p *Permit2Paymaster) GetNonce() uint64 {
	p.nonceMu.Lock()
	defer p.nonceMu.Unlock()
	return p.nonce
}

// ============================================================================
// Helper Functions
// ============================================================================

// maxUint128 returns the maximum uint128 value.
func maxUint128() *big.Int {
	max := new(big.Int)
	max.SetString("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", 16)
	return max
}

// signPermit2 signs a Permit2 permit using EIP-712 typed data.
func (p *Permit2Paymaster) signPermit2(amount *big.Int, expiration, nonce uint64) ([]byte, error) {
	// Build the EIP-712 domain separator
	domainSeparator := buildPermit2DomainSeparator(p.config.Permit2Address, uint64(p.config.ChainID))

	// Build the permit struct hash
	permitStructHash := buildPermitSingleStructHash(
		p.config.TokenAddress,
		amount,
		expiration,
		nonce,
		p.config.PaymasterAddress,
		expiration, // sigDeadline = expiration
	)

	// Compute the final hash to sign
	// hash = keccak256("\x19\x01" + domainSeparator + structHash)
	hashToSign := make([]byte, 66)
	hashToSign[0] = 0x19
	hashToSign[1] = 0x01
	copy(hashToSign[2:34], domainSeparator)
	copy(hashToSign[34:66], permitStructHash)

	finalHash := crypto.Keccak256(hashToSign)

	// Sign the hash
	signature, err := crypto.Sign(finalHash, p.privateKey)
	if err != nil {
		return nil, err
	}

	// Fix v value (Ethereum uses 27/28 for v, go-ethereum uses 0/1)
	if signature[64] < 27 {
		signature[64] += 27
	}

	return signature, nil
}

// buildPermit2DomainSeparator builds the EIP-712 domain separator for Permit2.
func buildPermit2DomainSeparator(permit2Address types.Address, chainID uint64) []byte {
	// EIP-712 domain type hash
	domainTypeHash := crypto.Keccak256([]byte("EIP712Domain(string name,uint256 chainId,address verifyingContract)"))

	// Name hash
	nameHash := crypto.Keccak256([]byte(Permit2DomainName))

	// Chain ID (32 bytes)
	chainIDBytes := make([]byte, 32)
	new(big.Int).SetUint64(chainID).FillBytes(chainIDBytes)

	// Build domain separator
	data := make([]byte, 128)
	copy(data[0:32], domainTypeHash)
	copy(data[32:64], nameHash)
	copy(data[64:96], chainIDBytes)
	copy(data[96:128], common.LeftPadBytes(permit2Address.Bytes(), 32))

	return crypto.Keccak256(data)
}

// buildPermitSingleStructHash builds the EIP-712 struct hash for PermitSingle.
func buildPermitSingleStructHash(token types.Address, amount *big.Int, expiration, nonce uint64, spender types.Address, sigDeadline uint64) []byte {
	// PermitDetails type hash
	permitDetailsTypeHash := crypto.Keccak256([]byte("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"))

	// PermitSingle type hash
	permitSingleTypeHash := crypto.Keccak256([]byte("PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"))

	// Build PermitDetails struct hash
	detailsData := make([]byte, 160)
	copy(detailsData[0:32], permitDetailsTypeHash)
	copy(detailsData[32:64], common.LeftPadBytes(token.Bytes(), 32))
	amountBytes := make([]byte, 32)
	amount.FillBytes(amountBytes)
	copy(detailsData[64:96], amountBytes)
	expirationBytes := make([]byte, 32)
	new(big.Int).SetUint64(expiration).FillBytes(expirationBytes)
	copy(detailsData[96:128], expirationBytes)
	nonceBytes := make([]byte, 32)
	new(big.Int).SetUint64(nonce).FillBytes(nonceBytes)
	copy(detailsData[128:160], nonceBytes)

	detailsHash := crypto.Keccak256(detailsData)

	// Build PermitSingle struct hash
	permitData := make([]byte, 128)
	copy(permitData[0:32], permitSingleTypeHash)
	copy(permitData[32:64], detailsHash)
	copy(permitData[64:96], common.LeftPadBytes(spender.Bytes(), 32))
	deadlineBytes := make([]byte, 32)
	new(big.Int).SetUint64(sigDeadline).FillBytes(deadlineBytes)
	copy(permitData[96:128], deadlineBytes)

	return crypto.Keccak256(permitData)
}

// DecodePermit2PaymasterData decodes Permit2 paymaster data using the v2 envelope format.
// Returns the decoded envelope, the Permit2 payload, and the trailing paymaster signature.
func DecodePermit2PaymasterData(data types.Hex) (*corepaymaster.Envelope, *corepaymaster.Permit2Payload, types.Hex, error) {
	envelopeBytes, sig, err := corepaymaster.SplitEnvelopeAndSignature(data.Bytes(), 65)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to split envelope and signature: %w", err)
	}

	env, err := corepaymaster.DecodePaymasterData(envelopeBytes)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to decode envelope: %w", err)
	}

	if env.PaymasterType != corepaymaster.PaymasterTypePermit2 {
		return nil, nil, nil, fmt.Errorf("expected Permit2 type, got %d", env.PaymasterType)
	}

	var permit2Payload *corepaymaster.Permit2Payload
	if len(env.Payload) > 0 {
		permit2Payload, err = corepaymaster.DecodePermit2Payload(env.Payload)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to decode permit2 payload: %w", err)
		}
	}

	return env, permit2Payload, types.Hex(sig), nil
}
