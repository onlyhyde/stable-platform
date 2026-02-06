// Package paymaster provides a paymaster plugin for gas sponsorship integration.
package paymaster

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/stablenet/sdk-go/config"
	"github.com/stablenet/sdk-go/core/paymaster"
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Plugin Interface
// ============================================================================

// Plugin is the interface for paymaster plugins.
type Plugin interface {
	// GetPaymasterStubData returns stub data for initial gas estimation.
	GetPaymasterStubData(ctx context.Context, userOp *types.PartialUserOperation, config PaymentConfig) (*StubData, error)

	// GetPaymasterData returns the final paymaster data for signing.
	GetPaymasterData(ctx context.Context, userOp *types.PartialUserOperation, config PaymentConfig) (*PaymasterData, error)

	// GetSupportedTokens returns supported ERC20 tokens for gas payment.
	GetSupportedTokens(ctx context.Context) ([]TokenInfo, error)

	// EstimateTokenPayment estimates token amount for gas payment.
	EstimateTokenPayment(ctx context.Context, userOp *types.PartialUserOperation, token types.Address) (*TokenEstimate, error)

	// IsSponsorshipAvailable checks if sponsorship is available.
	IsSponsorshipAvailable(ctx context.Context, sender types.Address) (bool, error)

	// GetSponsorshipPolicy returns the sponsorship policy for a sender.
	GetSponsorshipPolicy(ctx context.Context, sender types.Address) (*SponsorshipPolicy, error)
}

// ============================================================================
// Types
// ============================================================================

// PaymentType represents the type of gas payment.
type PaymentType string

const (
	// PaymentTypeNative pays gas with native currency (ETH).
	PaymentTypeNative PaymentType = "native"

	// PaymentTypeSponsored means gas is sponsored by a paymaster.
	PaymentTypeSponsored PaymentType = "sponsored"

	// PaymentTypeERC20 pays gas with an ERC20 token.
	PaymentTypeERC20 PaymentType = "erc20"
)

// PaymentConfig configures how gas should be paid.
type PaymentConfig struct {
	// Type is the payment type.
	Type PaymentType `json:"type"`

	// TokenAddress is the token address for ERC20 payments.
	TokenAddress *types.Address `json:"tokenAddress,omitempty"`

	// MaxTokenAmount is the maximum token amount to approve for ERC20 payments.
	MaxTokenAmount *big.Int `json:"maxTokenAmount,omitempty"`

	// SponsorContext is optional context for sponsorship requests.
	SponsorContext *SponsorContext `json:"sponsorContext,omitempty"`
}

// SponsorContext contains context for sponsorship requests.
type SponsorContext struct {
	// AppID is the application ID for sponsorship.
	AppID string `json:"appId,omitempty"`

	// UserID is the user ID for sponsorship.
	UserID string `json:"userId,omitempty"`

	// Operation is the operation type (e.g., "transfer", "swap").
	Operation string `json:"operation,omitempty"`
}

// StubData contains paymaster stub data for gas estimation.
type StubData struct {
	// Paymaster is the paymaster address.
	Paymaster types.Address `json:"paymaster"`

	// PaymasterData is the stub paymaster data.
	PaymasterData types.Hex `json:"paymasterData"`

	// PaymasterVerificationGasLimit is the verification gas limit.
	PaymasterVerificationGasLimit *big.Int `json:"paymasterVerificationGasLimit"`

	// PaymasterPostOpGasLimit is the post-op gas limit.
	PaymasterPostOpGasLimit *big.Int `json:"paymasterPostOpGasLimit"`
}

// PaymasterData contains the final paymaster data for signing.
type PaymasterData struct {
	// Paymaster is the paymaster address.
	Paymaster types.Address `json:"paymaster"`

	// PaymasterData is the paymaster data.
	PaymasterData types.Hex `json:"paymasterData"`

	// PaymasterVerificationGasLimit is the verification gas limit.
	PaymasterVerificationGasLimit *big.Int `json:"paymasterVerificationGasLimit"`

	// PaymasterPostOpGasLimit is the post-op gas limit.
	PaymasterPostOpGasLimit *big.Int `json:"paymasterPostOpGasLimit"`

	// TokenAmount is the token amount for ERC20 payments.
	TokenAmount *big.Int `json:"tokenAmount,omitempty"`
}

// TokenInfo contains information about a supported ERC20 token.
type TokenInfo struct {
	// Address is the token contract address.
	Address types.Address `json:"address"`

	// Symbol is the token symbol.
	Symbol string `json:"symbol"`

	// Decimals is the token decimals.
	Decimals uint8 `json:"decimals"`

	// ExchangeRate is the token/ETH exchange rate.
	ExchangeRate *big.Int `json:"exchangeRate"`

	// LogoURL is the token logo URL.
	LogoURL string `json:"logoUrl,omitempty"`
}

// TokenEstimate contains the estimated token amount for gas payment.
type TokenEstimate struct {
	// Token is the token information.
	Token TokenInfo `json:"token"`

	// Amount is the estimated token amount.
	Amount *big.Int `json:"amount"`

	// MaxSlippage is the maximum slippage percentage.
	MaxSlippage float64 `json:"maxSlippage"`
}

// SponsorshipPolicy contains sponsorship policy information.
type SponsorshipPolicy struct {
	// IsAvailable indicates if sponsorship is available.
	IsAvailable bool `json:"isAvailable"`

	// Reason is the reason if sponsorship is not available.
	Reason string `json:"reason,omitempty"`

	// RemainingQuota is the remaining sponsorship quota.
	RemainingQuota *big.Int `json:"remainingQuota,omitempty"`

	// DailyLimit is the daily sponsorship limit.
	DailyLimit *big.Int `json:"dailyLimit,omitempty"`

	// UsedToday is the amount used today.
	UsedToday *big.Int `json:"usedToday,omitempty"`
}

// ============================================================================
// Default Plugin Implementation
// ============================================================================

// DefaultPlugin is the default paymaster plugin implementation.
type DefaultPlugin struct {
	client      *paymaster.Client
	chainID     types.ChainID
	mu          sync.RWMutex
	tokenCache  []TokenInfo
	cacheExpiry time.Time
}

// PluginConfig configures the paymaster plugin.
type PluginConfig struct {
	// PaymasterURL is the paymaster service URL.
	PaymasterURL string

	// ChainID is the chain ID.
	ChainID types.ChainID

	// APIKey is the optional API key for authentication.
	APIKey string

	// Timeout is the request timeout.
	Timeout time.Duration
}

// NewPlugin creates a new paymaster plugin.
func NewPlugin(cfg PluginConfig) *DefaultPlugin {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	client := paymaster.NewClient(paymaster.ClientConfig{
		URL:     cfg.PaymasterURL,
		ChainID: cfg.ChainID,
		APIKey:  cfg.APIKey,
		Timeout: timeout,
	})

	return &DefaultPlugin{
		client:  client,
		chainID: cfg.ChainID,
	}
}

// GetPaymasterStubData returns stub data for initial gas estimation.
func (p *DefaultPlugin) GetPaymasterStubData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*StubData, error) {
	switch cfg.Type {
	case PaymentTypeNative:
		return nil, nil

	case PaymentTypeSponsored:
		return p.getSponsoredStubData(ctx, userOp)

	case PaymentTypeERC20:
		if cfg.TokenAddress == nil {
			return nil, fmt.Errorf("token address required for ERC20 payment")
		}
		return p.getERC20StubData(ctx, userOp, *cfg.TokenAddress)

	default:
		return nil, fmt.Errorf("unknown payment type: %s", cfg.Type)
	}
}

// getSponsoredStubData returns stub data for sponsored transactions.
func (p *DefaultPlugin) getSponsoredStubData(ctx context.Context, userOp *types.PartialUserOperation) (*StubData, error) {
	// Check if sponsorship is available
	policy, err := p.GetSponsorshipPolicy(ctx, userOp.Sender)
	if err != nil {
		return nil, fmt.Errorf("failed to get sponsorship policy: %w", err)
	}

	if !policy.IsAvailable {
		return nil, fmt.Errorf("sponsorship not available: %s", policy.Reason)
	}

	// Return stub data with default gas limits
	return &StubData{
		// Paymaster address will be filled by the service
		PaymasterVerificationGasLimit: new(big.Int).Set(config.GasConfig.PaymasterVerificationGas),
		PaymasterPostOpGasLimit:       new(big.Int).Set(config.GasConfig.PaymasterPostOpGas),
	}, nil
}

// getERC20StubData returns stub data for ERC20 token payments.
func (p *DefaultPlugin) getERC20StubData(ctx context.Context, userOp *types.PartialUserOperation, token types.Address) (*StubData, error) {
	// Validate token is supported
	_, err := p.EstimateTokenPayment(ctx, userOp, token)
	if err != nil {
		return nil, fmt.Errorf("failed to estimate token payment: %w", err)
	}

	// Return stub data with estimated gas limits
	return &StubData{
		PaymasterVerificationGasLimit: new(big.Int).Set(config.GasConfig.PaymasterVerificationGas),
		PaymasterPostOpGasLimit:       new(big.Int).Set(config.GasConfig.PaymasterPostOpGas),
	}, nil
}

// GetPaymasterData returns the final paymaster data for signing.
func (p *DefaultPlugin) GetPaymasterData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*PaymasterData, error) {
	switch cfg.Type {
	case PaymentTypeNative:
		return nil, nil

	case PaymentTypeSponsored:
		return p.getSponsoredPaymasterData(ctx, userOp)

	case PaymentTypeERC20:
		if cfg.TokenAddress == nil {
			return nil, fmt.Errorf("token address required for ERC20 payment")
		}
		return p.getERC20PaymasterData(ctx, userOp, *cfg.TokenAddress)

	default:
		return nil, fmt.Errorf("unknown payment type: %s", cfg.Type)
	}
}

// getSponsoredPaymasterData returns paymaster data for sponsored transactions.
func (p *DefaultPlugin) getSponsoredPaymasterData(ctx context.Context, userOp *types.PartialUserOperation) (*PaymasterData, error) {
	partialOp := toClientPartialUserOp(userOp)

	resp, err := p.client.GetSponsoredPaymasterData(ctx, partialOp)
	if err != nil {
		return nil, err
	}

	return &PaymasterData{
		Paymaster:                     resp.Paymaster,
		PaymasterData:                 resp.PaymasterData,
		PaymasterVerificationGasLimit: resp.PaymasterVerificationGasLimit,
		PaymasterPostOpGasLimit:       resp.PaymasterPostOpGasLimit,
	}, nil
}

// getERC20PaymasterData returns paymaster data for ERC20 token payments.
func (p *DefaultPlugin) getERC20PaymasterData(ctx context.Context, userOp *types.PartialUserOperation, token types.Address) (*PaymasterData, error) {
	partialOp := toClientPartialUserOp(userOp)

	resp, err := p.client.GetERC20PaymasterData(ctx, partialOp, token)
	if err != nil {
		return nil, err
	}

	return &PaymasterData{
		Paymaster:                     resp.Paymaster,
		PaymasterData:                 resp.PaymasterData,
		PaymasterVerificationGasLimit: resp.PaymasterVerificationGasLimit,
		PaymasterPostOpGasLimit:       resp.PaymasterPostOpGasLimit,
		TokenAmount:                   resp.TokenAmount,
	}, nil
}

// GetSupportedTokens returns supported ERC20 tokens for gas payment.
func (p *DefaultPlugin) GetSupportedTokens(ctx context.Context) ([]TokenInfo, error) {
	// Check cache
	p.mu.RLock()
	if time.Now().Before(p.cacheExpiry) && len(p.tokenCache) > 0 {
		tokens := make([]TokenInfo, len(p.tokenCache))
		copy(tokens, p.tokenCache)
		p.mu.RUnlock()
		return tokens, nil
	}
	p.mu.RUnlock()

	// Fetch from service
	clientTokens, err := p.client.GetSupportedTokens(ctx)
	if err != nil {
		return nil, err
	}

	tokens := make([]TokenInfo, len(clientTokens))
	for i, t := range clientTokens {
		tokens[i] = TokenInfo{
			Address:      t.Address,
			Symbol:       t.Symbol,
			Decimals:     t.Decimals,
			ExchangeRate: t.ExchangeRate,
			LogoURL:      t.LogoURL,
		}
	}

	// Update cache
	p.mu.Lock()
	p.tokenCache = tokens
	p.cacheExpiry = time.Now().Add(5 * time.Minute)
	p.mu.Unlock()

	return tokens, nil
}

// EstimateTokenPayment estimates token amount for gas payment.
func (p *DefaultPlugin) EstimateTokenPayment(ctx context.Context, userOp *types.PartialUserOperation, token types.Address) (*TokenEstimate, error) {
	partialOp := toClientPartialUserOp(userOp)

	estimate, err := p.client.EstimateERC20Payment(ctx, partialOp, token)
	if err != nil {
		return nil, err
	}

	return &TokenEstimate{
		Token: TokenInfo{
			Address:      estimate.TokenAddress,
			Symbol:       estimate.Symbol,
			Decimals:     estimate.Decimals,
			ExchangeRate: estimate.ExchangeRate,
		},
		Amount:      estimate.EstimatedAmount,
		MaxSlippage: estimate.MaxSlippage,
	}, nil
}

// IsSponsorshipAvailable checks if sponsorship is available.
func (p *DefaultPlugin) IsSponsorshipAvailable(ctx context.Context, sender types.Address) (bool, error) {
	policy, err := p.GetSponsorshipPolicy(ctx, sender)
	if err != nil {
		return false, err
	}
	return policy.IsAvailable, nil
}

// GetSponsorshipPolicy returns the sponsorship policy for a sender.
func (p *DefaultPlugin) GetSponsorshipPolicy(ctx context.Context, sender types.Address) (*SponsorshipPolicy, error) {
	policy, err := p.client.GetSponsorPolicy(ctx, sender, "")
	if err != nil {
		return nil, err
	}

	return &SponsorshipPolicy{
		IsAvailable:    policy.IsAvailable,
		Reason:         policy.Reason,
		RemainingQuota: policy.RemainingQuota,
	}, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// toClientPartialUserOp converts types.PartialUserOperation to paymaster.PartialUserOperation.
func toClientPartialUserOp(op *types.PartialUserOperation) *paymaster.PartialUserOperation {
	return &paymaster.PartialUserOperation{
		Sender:               op.Sender,
		Nonce:                op.Nonce,
		CallData:             op.CallData,
		CallGasLimit:         op.CallGasLimit,
		VerificationGasLimit: op.VerificationGasLimit,
		PreVerificationGas:   op.PreVerificationGas,
		MaxFeePerGas:         op.MaxFeePerGas,
		MaxPriorityFeePerGas: op.MaxPriorityFeePerGas,
	}
}

// IsSponsoredPayment checks if the payment config is sponsored.
func IsSponsoredPayment(cfg PaymentConfig) bool {
	return cfg.Type == PaymentTypeSponsored
}

// IsERC20Payment checks if the payment config is ERC20.
func IsERC20Payment(cfg PaymentConfig) bool {
	return cfg.Type == PaymentTypeERC20
}

// IsNativePayment checks if the payment config is native.
func IsNativePayment(cfg PaymentConfig) bool {
	return cfg.Type == PaymentTypeNative
}

// NativePaymentConfig returns a native payment config.
func NativePaymentConfig() PaymentConfig {
	return PaymentConfig{Type: PaymentTypeNative}
}

// SponsoredPaymentConfig returns a sponsored payment config.
func SponsoredPaymentConfig() PaymentConfig {
	return PaymentConfig{Type: PaymentTypeSponsored}
}

// ERC20PaymentConfig returns an ERC20 payment config.
func ERC20PaymentConfig(tokenAddress types.Address) PaymentConfig {
	return PaymentConfig{
		Type:         PaymentTypeERC20,
		TokenAddress: &tokenAddress,
	}
}

// ============================================================================
// Multi-Paymaster Support
// ============================================================================

// MultiPaymasterPlugin supports multiple paymaster providers.
type MultiPaymasterPlugin struct {
	plugins   []Plugin
	selectors []PaymasterSelector
}

// PaymasterSelector is a function that selects a paymaster based on context.
type PaymasterSelector func(ctx context.Context, userOp *types.PartialUserOperation, config PaymentConfig) (Plugin, error)

// NewMultiPaymasterPlugin creates a new multi-paymaster plugin.
func NewMultiPaymasterPlugin(plugins []Plugin) *MultiPaymasterPlugin {
	return &MultiPaymasterPlugin{
		plugins: plugins,
	}
}

// AddSelector adds a paymaster selector.
func (m *MultiPaymasterPlugin) AddSelector(selector PaymasterSelector) {
	m.selectors = append(m.selectors, selector)
}

// SelectPaymaster selects the best paymaster for the given context.
func (m *MultiPaymasterPlugin) SelectPaymaster(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (Plugin, error) {
	// Try selectors first
	for _, selector := range m.selectors {
		plugin, err := selector(ctx, userOp, cfg)
		if err == nil && plugin != nil {
			return plugin, nil
		}
	}

	// Fall back to first available paymaster
	for _, plugin := range m.plugins {
		available, err := plugin.IsSponsorshipAvailable(ctx, userOp.Sender)
		if err == nil && available {
			return plugin, nil
		}
	}

	if len(m.plugins) > 0 {
		return m.plugins[0], nil
	}

	return nil, fmt.Errorf("no paymaster available")
}

// GetPaymasterStubData returns stub data using the best available paymaster.
func (m *MultiPaymasterPlugin) GetPaymasterStubData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*StubData, error) {
	plugin, err := m.SelectPaymaster(ctx, userOp, cfg)
	if err != nil {
		return nil, err
	}
	return plugin.GetPaymasterStubData(ctx, userOp, cfg)
}

// GetPaymasterData returns paymaster data using the best available paymaster.
func (m *MultiPaymasterPlugin) GetPaymasterData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*PaymasterData, error) {
	plugin, err := m.SelectPaymaster(ctx, userOp, cfg)
	if err != nil {
		return nil, err
	}
	return plugin.GetPaymasterData(ctx, userOp, cfg)
}

// GetSupportedTokens returns tokens from all paymasters.
func (m *MultiPaymasterPlugin) GetSupportedTokens(ctx context.Context) ([]TokenInfo, error) {
	tokenMap := make(map[types.Address]TokenInfo)

	for _, plugin := range m.plugins {
		tokens, err := plugin.GetSupportedTokens(ctx)
		if err != nil {
			continue
		}
		for _, t := range tokens {
			tokenMap[t.Address] = t
		}
	}

	tokens := make([]TokenInfo, 0, len(tokenMap))
	for _, t := range tokenMap {
		tokens = append(tokens, t)
	}

	return tokens, nil
}

// EstimateTokenPayment estimates using the first available paymaster.
func (m *MultiPaymasterPlugin) EstimateTokenPayment(ctx context.Context, userOp *types.PartialUserOperation, token types.Address) (*TokenEstimate, error) {
	for _, plugin := range m.plugins {
		estimate, err := plugin.EstimateTokenPayment(ctx, userOp, token)
		if err == nil {
			return estimate, nil
		}
	}
	return nil, fmt.Errorf("no paymaster could estimate token payment")
}

// IsSponsorshipAvailable checks all paymasters for availability.
func (m *MultiPaymasterPlugin) IsSponsorshipAvailable(ctx context.Context, sender types.Address) (bool, error) {
	for _, plugin := range m.plugins {
		available, err := plugin.IsSponsorshipAvailable(ctx, sender)
		if err == nil && available {
			return true, nil
		}
	}
	return false, nil
}

// GetSponsorshipPolicy returns policy from the first available paymaster.
func (m *MultiPaymasterPlugin) GetSponsorshipPolicy(ctx context.Context, sender types.Address) (*SponsorshipPolicy, error) {
	for _, plugin := range m.plugins {
		policy, err := plugin.GetSponsorshipPolicy(ctx, sender)
		if err == nil {
			return policy, nil
		}
	}
	return nil, fmt.Errorf("no paymaster could provide sponsorship policy")
}
