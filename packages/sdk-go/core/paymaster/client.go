// Package paymaster provides a paymaster client for gas sponsorship.
package paymaster

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/core/rpc"
	"github.com/stablenet/sdk-go/types"
)

// GasPaymentType represents the type of gas payment.
type GasPaymentType string

const (
	// GasPaymentNative means pay gas with native currency.
	GasPaymentNative GasPaymentType = "native"

	// GasPaymentSponsor means gas is sponsored.
	GasPaymentSponsor GasPaymentType = "sponsor"

	// GasPaymentERC20 means pay gas with ERC20 token.
	GasPaymentERC20 GasPaymentType = "erc20"
)

// Client is a paymaster client for gas sponsorship and ERC20 payment.
type Client struct {
	rpc     *rpc.Client
	chainID types.ChainID
}

// ClientConfig configures the paymaster client.
type ClientConfig struct {
	// URL is the paymaster service URL.
	URL string

	// ChainID is the chain ID.
	ChainID types.ChainID

	// APIKey is the optional API key for authentication.
	APIKey string

	// Timeout is the request timeout.
	Timeout time.Duration
}

// PartialUserOperation contains the fields needed for paymaster estimation.
type PartialUserOperation struct {
	Sender               types.Address
	Nonce                *big.Int
	CallData             types.Hex
	CallGasLimit         *big.Int
	VerificationGasLimit *big.Int
	PreVerificationGas   *big.Int
	MaxFeePerGas         *big.Int
	MaxPriorityFeePerGas *big.Int
}

// PaymasterResponse contains paymaster data for a UserOperation.
type PaymasterResponse struct {
	Paymaster                     types.Address
	PaymasterData                 types.Hex
	PaymasterVerificationGasLimit *big.Int
	PaymasterPostOpGasLimit       *big.Int
}

// PaymasterWithTokenResponse extends PaymasterResponse with token amount.
type PaymasterWithTokenResponse struct {
	PaymasterResponse
	TokenAmount *big.Int
}

// SponsorPolicy contains information about sponsorship availability.
type SponsorPolicy struct {
	IsAvailable   bool   `json:"isAvailable"`
	Reason        string `json:"reason,omitempty"`
	RemainingQuota *big.Int `json:"remainingQuota,omitempty"`
}

// SupportedToken contains information about a supported ERC20 token.
type SupportedToken struct {
	Address      types.Address
	Symbol       string
	Decimals     uint8
	ExchangeRate *big.Int
	LogoURL      string
}

// ERC20PaymentEstimate contains the estimated token amount for gas payment.
type ERC20PaymentEstimate struct {
	TokenAddress    types.Address
	Symbol          string
	Decimals        uint8
	EstimatedAmount *big.Int
	ExchangeRate    *big.Int
	MaxSlippage     float64
}

// GasPaymentConfig configures how gas should be paid.
type GasPaymentConfig struct {
	Type         GasPaymentType
	TokenAddress *types.Address
}

// NewClient creates a new paymaster client.
func NewClient(config ClientConfig) *Client {
	headers := make(map[string]string)
	if config.APIKey != "" {
		headers["Authorization"] = "Bearer " + config.APIKey
	}

	rpcClient := rpc.NewClient(rpc.ClientConfig{
		URL:     config.URL,
		Timeout: config.Timeout,
		Headers: headers,
	})

	return &Client{
		rpc:     rpcClient,
		chainID: config.ChainID,
	}
}

// GetSponsorPolicy checks if sponsorship is available for the given operation.
func (c *Client) GetSponsorPolicy(ctx context.Context, sender types.Address, operation string) (*SponsorPolicy, error) {
	var result struct {
		IsAvailable    bool   `json:"isAvailable"`
		Reason         string `json:"reason,omitempty"`
		RemainingQuota string `json:"remainingQuota,omitempty"`
	}

	err := c.rpc.Call(ctx, "pm_getSponsorPolicy", []interface{}{sender.Hex(), operation, uint64(c.chainID)}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get sponsor policy: %w", err)
	}

	policy := &SponsorPolicy{
		IsAvailable: result.IsAvailable,
		Reason:      result.Reason,
	}

	if result.RemainingQuota != "" {
		quota, _ := new(big.Int).SetString(result.RemainingQuota, 10)
		policy.RemainingQuota = quota
	}

	return policy, nil
}

// GetSponsoredPaymasterData gets paymaster data for a sponsored transaction.
func (c *Client) GetSponsoredPaymasterData(ctx context.Context, userOp *PartialUserOperation) (*PaymasterResponse, error) {
	// Check sponsor policy first
	policy, err := c.GetSponsorPolicy(ctx, userOp.Sender, "transfer")
	if err != nil {
		return nil, err
	}

	if !policy.IsAvailable {
		return nil, fmt.Errorf("sponsorship not available: %s", policy.Reason)
	}

	packedUserOp := formatUserOpForRpc(userOp)

	var result struct {
		Paymaster                     string `json:"paymaster"`
		PaymasterData                 string `json:"paymasterData"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit"`
	}

	err = c.rpc.Call(ctx, "pm_sponsorUserOperation", []interface{}{packedUserOp, uint64(c.chainID)}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get sponsored paymaster data: %w", err)
	}

	paymasterData, _ := types.HexFromString(result.PaymasterData)

	return &PaymasterResponse{
		Paymaster:                     common.HexToAddress(result.Paymaster),
		PaymasterData:                 paymasterData,
		PaymasterVerificationGasLimit: hexToBigInt(result.PaymasterVerificationGasLimit),
		PaymasterPostOpGasLimit:       hexToBigInt(result.PaymasterPostOpGasLimit),
	}, nil
}

// GetSupportedTokens returns the supported ERC20 tokens for gas payment.
func (c *Client) GetSupportedTokens(ctx context.Context) ([]SupportedToken, error) {
	var result []struct {
		Address      string `json:"address"`
		Symbol       string `json:"symbol"`
		Decimals     uint8  `json:"decimals"`
		ExchangeRate string `json:"exchangeRate"`
		LogoURL      string `json:"logoUrl,omitempty"`
	}

	err := c.rpc.Call(ctx, "pm_supportedTokens", []interface{}{uint64(c.chainID)}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get supported tokens: %w", err)
	}

	tokens := make([]SupportedToken, len(result))
	for i, t := range result {
		tokens[i] = SupportedToken{
			Address:      common.HexToAddress(t.Address),
			Symbol:       t.Symbol,
			Decimals:     t.Decimals,
			ExchangeRate: hexToBigInt(t.ExchangeRate),
			LogoURL:      t.LogoURL,
		}
	}

	return tokens, nil
}

// EstimateERC20Payment estimates the token amount required for gas payment.
func (c *Client) EstimateERC20Payment(ctx context.Context, userOp *PartialUserOperation, tokenAddress types.Address) (*ERC20PaymentEstimate, error) {
	packedUserOp := formatUserOpForRpc(userOp)

	var result struct {
		TokenAddress    string  `json:"tokenAddress"`
		Symbol          string  `json:"symbol"`
		Decimals        uint8   `json:"decimals"`
		EstimatedAmount string  `json:"estimatedAmount"`
		ExchangeRate    string  `json:"exchangeRate"`
		MaxSlippage     float64 `json:"maxSlippage"`
	}

	err := c.rpc.Call(ctx, "pm_estimateERC20Payment", []interface{}{packedUserOp, tokenAddress.Hex(), uint64(c.chainID)}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to estimate ERC20 payment: %w", err)
	}

	return &ERC20PaymentEstimate{
		TokenAddress:    common.HexToAddress(result.TokenAddress),
		Symbol:          result.Symbol,
		Decimals:        result.Decimals,
		EstimatedAmount: hexToBigInt(result.EstimatedAmount),
		ExchangeRate:    hexToBigInt(result.ExchangeRate),
		MaxSlippage:     result.MaxSlippage,
	}, nil
}

// GetERC20PaymasterData gets paymaster data for ERC20 token payment.
func (c *Client) GetERC20PaymasterData(ctx context.Context, userOp *PartialUserOperation, tokenAddress types.Address) (*PaymasterWithTokenResponse, error) {
	packedUserOp := formatUserOpForRpc(userOp)

	var result struct {
		Paymaster                     string `json:"paymaster"`
		PaymasterData                 string `json:"paymasterData"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit"`
		TokenAmount                   string `json:"tokenAmount"`
	}

	params := map[string]interface{}{
		"type":         "erc20",
		"tokenAddress": tokenAddress.Hex(),
		"chainId":      uint64(c.chainID),
	}

	err := c.rpc.Call(ctx, "pm_getPaymasterData", []interface{}{packedUserOp, params}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get ERC20 paymaster data: %w", err)
	}

	paymasterData, _ := types.HexFromString(result.PaymasterData)

	return &PaymasterWithTokenResponse{
		PaymasterResponse: PaymasterResponse{
			Paymaster:                     common.HexToAddress(result.Paymaster),
			PaymasterData:                 paymasterData,
			PaymasterVerificationGasLimit: hexToBigInt(result.PaymasterVerificationGasLimit),
			PaymasterPostOpGasLimit:       hexToBigInt(result.PaymasterPostOpGasLimit),
		},
		TokenAmount: hexToBigInt(result.TokenAmount),
	}, nil
}

// GetPaymasterData gets paymaster data based on the gas payment configuration.
func (c *Client) GetPaymasterData(ctx context.Context, userOp *PartialUserOperation, config GasPaymentConfig) (*PaymasterResponse, error) {
	switch config.Type {
	case GasPaymentNative:
		return nil, nil
	case GasPaymentSponsor:
		return c.GetSponsoredPaymasterData(ctx, userOp)
	case GasPaymentERC20:
		if config.TokenAddress == nil {
			return nil, fmt.Errorf("token address required for ERC20 gas payment")
		}
		resp, err := c.GetERC20PaymasterData(ctx, userOp, *config.TokenAddress)
		if err != nil {
			return nil, err
		}
		return &resp.PaymasterResponse, nil
	default:
		return nil, fmt.Errorf("unknown gas payment type: %s", config.Type)
	}
}

// IsAvailable checks if the paymaster service is available.
func (c *Client) IsAvailable(ctx context.Context) bool {
	_, err := c.GetSupportedTokens(ctx)
	return err == nil
}

// formatUserOpForRpc formats a PartialUserOperation for RPC.
func formatUserOpForRpc(userOp *PartialUserOperation) map[string]string {
	return map[string]string{
		"sender":               userOp.Sender.Hex(),
		"nonce":                toHexString(userOp.Nonce),
		"callData":             userOp.CallData.String(),
		"callGasLimit":         toHexString(userOp.CallGasLimit),
		"verificationGasLimit": toHexString(userOp.VerificationGasLimit),
		"preVerificationGas":   toHexString(userOp.PreVerificationGas),
		"maxFeePerGas":         toHexString(userOp.MaxFeePerGas),
		"maxPriorityFeePerGas": toHexString(userOp.MaxPriorityFeePerGas),
	}
}

func toHexString(n *big.Int) string {
	if n == nil || n.Sign() == 0 {
		return "0x0"
	}
	return "0x" + n.Text(16)
}

func hexToBigInt(s string) *big.Int {
	if s == "" || s == "0x" {
		return big.NewInt(0)
	}
	if len(s) > 2 && s[:2] == "0x" {
		s = s[2:]
	}
	n, _ := new(big.Int).SetString(s, 16)
	if n == nil {
		return big.NewInt(0)
	}
	return n
}
