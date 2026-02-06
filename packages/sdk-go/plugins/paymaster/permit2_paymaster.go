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

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Permit2 Paymaster Configuration
// ============================================================================

// Permit2PaymasterConfig configures the Permit2 paymaster.
type Permit2PaymasterConfig struct {
	// PaymasterAddress is the Permit2Paymaster contract address.
	PaymasterAddress types.Address
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
	config       Permit2PaymasterConfig
	privateKey   *ecdsa.PrivateKey
	signerPubKey types.Address
	nonce        uint64
	nonceMu      sync.Mutex
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

	return &Permit2Paymaster{
		config:       cfg,
		privateKey:   privateKey,
		signerPubKey: signerPubKey,
		nonce:        cfg.InitialNonce,
	}, nil
}

// GetPaymasterStubData returns stub data for gas estimation.
func (p *Permit2Paymaster) GetPaymasterStubData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*StubData, error) {
	expiration := uint64(time.Now().Unix()) + uint64(p.config.ValiditySeconds)
	amount := maxUint128() // Max uint128

	p.nonceMu.Lock()
	nonce := p.nonce
	p.nonceMu.Unlock()

	paymasterData := encodePermit2PaymasterData(
		p.config.TokenAddress,
		amount,
		expiration,
		nonce,
		stubSignature(),
	)

	return &StubData{
		Paymaster:                     p.config.PaymasterAddress,
		PaymasterData:                 paymasterData,
		PaymasterVerificationGasLimit: big.NewInt(DefaultPermit2VerificationGas),
		PaymasterPostOpGasLimit:       big.NewInt(DefaultPermit2PostOpGas),
	}, nil
}

// GetPaymasterData returns the final paymaster data with Permit2 signature.
func (p *Permit2Paymaster) GetPaymasterData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*PaymasterData, error) {
	expiration := uint64(time.Now().Unix()) + uint64(p.config.ValiditySeconds)
	amount := maxUint128() // Max uint128

	p.nonceMu.Lock()
	nonce := p.nonce
	p.nonce++ // Increment nonce for next operation
	p.nonceMu.Unlock()

	// Create Permit2 permit data and sign it
	signature, err := p.signPermit2(amount, expiration, nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to sign Permit2 permit: %w", err)
	}

	// Encode paymaster data
	paymasterData := encodePermit2PaymasterData(
		p.config.TokenAddress,
		amount,
		expiration,
		nonce,
		signature,
	)

	return &PaymasterData{
		Paymaster:                     p.config.PaymasterAddress,
		PaymasterData:                 paymasterData,
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

	// Basic gas estimation - in production this would use actual gas prices and token exchange rates
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

	// Multiply by gas price
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

// encodePermit2PaymasterData encodes paymaster data for Permit2Paymaster.
// Format: [token (20 bytes)][amount (20 bytes)][expiration (6 bytes)][nonce (6 bytes)][signature (65 bytes)]
func encodePermit2PaymasterData(token types.Address, amount *big.Int, expiration, nonce uint64, signature types.Hex) types.Hex {
	data := make([]byte, 117) // 20 + 20 + 6 + 6 + 65

	// Token address (20 bytes)
	copy(data[0:20], token.Bytes())

	// Amount as uint160 (20 bytes)
	amountBytes := make([]byte, 20)
	amount.FillBytes(amountBytes)
	copy(data[20:40], amountBytes)

	// Expiration as uint48 (6 bytes, big-endian)
	for i := 0; i < 6; i++ {
		data[45-i] = byte(expiration >> (8 * i))
	}

	// Nonce as uint48 (6 bytes, big-endian)
	for i := 0; i < 6; i++ {
		data[51-i] = byte(nonce >> (8 * i))
	}

	// Signature (65 bytes)
	copy(data[52:], signature.Bytes())

	return types.Hex(data)
}

// signPermit2 signs a Permit2 permit using EIP-712 typed data.
func (p *Permit2Paymaster) signPermit2(amount *big.Int, expiration, nonce uint64) (types.Hex, error) {
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

	return types.Hex(signature), nil
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

// DecodePermit2PaymasterData decodes Permit2 paymaster data.
func DecodePermit2PaymasterData(data types.Hex) (token types.Address, amount *big.Int, expiration, nonce uint64, signature types.Hex, err error) {
	if len(data) < 117 {
		return types.Address{}, nil, 0, 0, nil, fmt.Errorf("invalid paymaster data length: expected at least 117 bytes")
	}

	// Token (20 bytes)
	token = common.BytesToAddress(data[0:20])

	// Amount (20 bytes)
	amount = new(big.Int).SetBytes(data[20:40])

	// Expiration (6 bytes, big-endian)
	for i := 0; i < 6; i++ {
		expiration |= uint64(data[45-i]) << (8 * i)
	}

	// Nonce (6 bytes, big-endian)
	for i := 0; i < 6; i++ {
		nonce |= uint64(data[51-i]) << (8 * i)
	}

	// Signature (remaining bytes)
	signature = types.Hex(data[52:])

	return token, amount, expiration, nonce, signature, nil
}
