package paymaster

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/core"
	corepaymaster "github.com/stablenet/sdk-go/core/paymaster"
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Sponsor Paymaster Configuration
// ============================================================================

// SponsorPaymasterConfig configures the API-based sponsor paymaster.
type SponsorPaymasterConfig struct {
	// PaymasterURL is the paymaster service URL.
	PaymasterURL string
	// APIKey is the optional API key for authentication.
	APIKey string
	// ChainID is the chain ID.
	ChainID types.ChainID
	// Timeout is the request timeout (default: 30s).
	Timeout time.Duration
	// PolicyID is the optional sponsorship policy ID.
	PolicyID string
	// Metadata contains optional metadata for requests.
	Metadata map[string]string
}

// Default gas limits for sponsor paymaster operations.
const (
	DefaultSponsorVerificationGas = 100_000
	DefaultSponsorPostOpGas       = 50_000
)

// ============================================================================
// Sponsor Paymaster
// ============================================================================

// SponsorPaymaster uses a backend API for gas sponsorship.
// The API handles signature generation and policy enforcement.
type SponsorPaymaster struct {
	config     SponsorPaymasterConfig
	httpClient *http.Client
}

// NewSponsorPaymaster creates a new API-based sponsor paymaster.
func NewSponsorPaymaster(cfg SponsorPaymasterConfig) *SponsorPaymaster {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &SponsorPaymaster{
		config: cfg,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// GetPaymasterStubData returns stub data for gas estimation.
func (s *SponsorPaymaster) GetPaymasterStubData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*StubData, error) {
	req := s.buildJSONRPCRequest("pm_getPaymasterStubData", userOp)

	resp, err := s.doRequest(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get paymaster stub data: %w", err)
	}

	var result struct {
		Paymaster                     string `json:"paymaster"`
		PaymasterData                 string `json:"paymasterData"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit"`
	}

	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to parse paymaster stub data: %w", err)
	}

	verificationGas, _ := new(big.Int).SetString(result.PaymasterVerificationGasLimit, 0)
	if verificationGas == nil {
		verificationGas = big.NewInt(DefaultSponsorVerificationGas)
	}

	postOpGas, _ := new(big.Int).SetString(result.PaymasterPostOpGasLimit, 0)
	if postOpGas == nil {
		postOpGas = big.NewInt(DefaultSponsorPostOpGas)
	}

	paymasterData, _ := types.HexFromString(result.PaymasterData)

	return &StubData{
		Paymaster:                     common.HexToAddress(result.Paymaster),
		PaymasterData:                 paymasterData,
		PaymasterVerificationGasLimit: verificationGas,
		PaymasterPostOpGasLimit:       postOpGas,
	}, nil
}

// GetPaymasterData returns the final paymaster data with signature.
func (s *SponsorPaymaster) GetPaymasterData(ctx context.Context, userOp *types.PartialUserOperation, cfg PaymentConfig) (*PaymasterData, error) {
	req := s.buildJSONRPCRequest("pm_getPaymasterData", userOp)

	resp, err := s.doRequest(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get paymaster data: %w", err)
	}

	var result struct {
		Paymaster                     string `json:"paymaster"`
		PaymasterData                 string `json:"paymasterData"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
	}

	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to parse paymaster data: %w", err)
	}

	verificationGas, _ := new(big.Int).SetString(result.PaymasterVerificationGasLimit, 0)
	if verificationGas == nil {
		verificationGas = big.NewInt(DefaultSponsorVerificationGas)
	}

	postOpGas, _ := new(big.Int).SetString(result.PaymasterPostOpGasLimit, 0)
	if postOpGas == nil {
		postOpGas = big.NewInt(DefaultSponsorPostOpGas)
	}

	paymasterData, _ := types.HexFromString(result.PaymasterData)

	return &PaymasterData{
		Paymaster:                     common.HexToAddress(result.Paymaster),
		PaymasterData:                 paymasterData,
		PaymasterVerificationGasLimit: verificationGas,
		PaymasterPostOpGasLimit:       postOpGas,
	}, nil
}

// GetSupportedTokens returns empty list (sponsor paymaster doesn't support token payments).
func (s *SponsorPaymaster) GetSupportedTokens(ctx context.Context) ([]TokenInfo, error) {
	return nil, nil
}

// EstimateTokenPayment returns error (sponsor paymaster doesn't support token payments).
func (s *SponsorPaymaster) EstimateTokenPayment(ctx context.Context, userOp *types.PartialUserOperation, token types.Address) (*TokenEstimate, error) {
	return nil, fmt.Errorf("sponsor paymaster does not support token payments")
}

// IsSponsorshipAvailable checks if sponsorship is available for the sender.
func (s *SponsorPaymaster) IsSponsorshipAvailable(ctx context.Context, sender types.Address) (bool, error) {
	policy, err := s.GetSponsorshipPolicy(ctx, sender)
	if err != nil {
		return false, err
	}
	return policy.IsAvailable, nil
}

// GetSponsorshipPolicy returns the sponsorship policy for a sender.
func (s *SponsorPaymaster) GetSponsorshipPolicy(ctx context.Context, sender types.Address) (*SponsorshipPolicy, error) {
	req := &jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "pm_getSponsorshipPolicy",
		Params: []any{
			sender.Hex(),
			toHexString(uint64(s.config.ChainID)),
		},
	}

	resp, err := s.doRequest(ctx, req)
	if err != nil {
		// If policy endpoint fails, assume sponsorship is available
		return &SponsorshipPolicy{
			IsAvailable: true,
		}, nil
	}

	var result struct {
		IsAvailable    bool   `json:"isAvailable"`
		Reason         string `json:"reason,omitempty"`
		RemainingQuota string `json:"remainingQuota,omitempty"`
		DailyLimit     string `json:"dailyLimit,omitempty"`
		UsedToday      string `json:"usedToday,omitempty"`
	}

	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return &SponsorshipPolicy{IsAvailable: true}, nil
	}

	remainingQuota, _ := new(big.Int).SetString(result.RemainingQuota, 0)
	dailyLimit, _ := new(big.Int).SetString(result.DailyLimit, 0)
	usedToday, _ := new(big.Int).SetString(result.UsedToday, 0)

	return &SponsorshipPolicy{
		IsAvailable:    result.IsAvailable,
		Reason:         result.Reason,
		RemainingQuota: remainingQuota,
		DailyLimit:     dailyLimit,
		UsedToday:      usedToday,
	}, nil
}

// ============================================================================
// JSON-RPC Types
// ============================================================================

type jsonRPCRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  []any  `json:"params"`
}

type jsonRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// ============================================================================
// Helper Functions
// ============================================================================

// buildJSONRPCRequest builds a JSON-RPC request for the paymaster API.
func (s *SponsorPaymaster) buildJSONRPCRequest(method string, userOp *types.PartialUserOperation) *jsonRPCRequest {
	serialized := serializeUserOperation(userOp)

	params := []any{
		serialized,
		core.EntryPointV07Address.Hex(),
		toHexString(uint64(s.config.ChainID)),
	}

	// Add policy context if available
	if s.config.PolicyID != "" || len(s.config.Metadata) > 0 {
		context := make(map[string]any)
		if s.config.PolicyID != "" {
			context["policyId"] = s.config.PolicyID
		}
		if len(s.config.Metadata) > 0 {
			context["metadata"] = s.config.Metadata
		}
		params = append(params, context)
	}

	return &jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  method,
		Params:  params,
	}
}

// doRequest executes a JSON-RPC request.
func (s *SponsorPaymaster) doRequest(ctx context.Context, req *jsonRPCRequest) (*jsonRPCResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.config.PaymasterURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if s.config.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+s.config.APIKey)
	}

	httpResp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("paymaster API error: %s", httpResp.Status)
	}

	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var resp jsonRPCResponse
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("paymaster error: %s (code: %d)", resp.Error.Message, resp.Error.Code)
	}

	return &resp, nil
}

// serializeUserOperation serializes a UserOperation for JSON-RPC (ERC-4337 v0.7 format).
func serializeUserOperation(userOp *types.PartialUserOperation) map[string]string {
	result := map[string]string{
		"sender":   userOp.Sender.Hex(),
		"callData": userOp.CallData.String(),
	}

	if userOp.Nonce != nil {
		result["nonce"] = toHexString(userOp.Nonce.Uint64())
	}
	if userOp.CallGasLimit != nil {
		result["callGasLimit"] = toHexStringBig(userOp.CallGasLimit)
	}
	if userOp.VerificationGasLimit != nil {
		result["verificationGasLimit"] = toHexStringBig(userOp.VerificationGasLimit)
	}
	if userOp.PreVerificationGas != nil {
		result["preVerificationGas"] = toHexStringBig(userOp.PreVerificationGas)
	}
	if userOp.MaxFeePerGas != nil {
		result["maxFeePerGas"] = toHexStringBig(userOp.MaxFeePerGas)
	}
	if userOp.MaxPriorityFeePerGas != nil {
		result["maxPriorityFeePerGas"] = toHexStringBig(userOp.MaxPriorityFeePerGas)
	}

	// Default values for optional fields
	if _, ok := result["factory"]; !ok {
		result["factory"] = ""
	}
	if _, ok := result["factoryData"]; !ok {
		result["factoryData"] = "0x"
	}
	if _, ok := result["paymaster"]; !ok {
		result["paymaster"] = ""
	}
	if _, ok := result["paymasterData"]; !ok {
		result["paymasterData"] = "0x"
	}
	if _, ok := result["paymasterVerificationGasLimit"]; !ok {
		result["paymasterVerificationGasLimit"] = "0x0"
	}
	if _, ok := result["paymasterPostOpGasLimit"]; !ok {
		result["paymasterPostOpGasLimit"] = "0x0"
	}
	if _, ok := result["signature"]; !ok {
		result["signature"] = "0x"
	}

	return result
}

// toHexString converts a uint64 to a hex string.
func toHexString(value uint64) string {
	return fmt.Sprintf("0x%x", value)
}

// toHexStringBig converts a big.Int to a hex string.
func toHexStringBig(value *big.Int) string {
	if value == nil {
		return "0x0"
	}
	return fmt.Sprintf("0x%x", value)
}

// ============================================================================
// Sponsor Paymaster with Policy
// ============================================================================

// SponsorPolicy represents a sponsorship policy.
type SponsorPolicy struct {
	// PolicyID is the policy ID from the paymaster service.
	PolicyID string
	// Metadata contains optional metadata for requests.
	Metadata map[string]string
}

// NewSponsorPaymasterWithPolicy creates a sponsor paymaster with a specific policy.
func NewSponsorPaymasterWithPolicy(cfg SponsorPaymasterConfig, policy SponsorPolicy) *SponsorPaymaster {
	cfg.PolicyID = policy.PolicyID
	if cfg.Metadata == nil {
		cfg.Metadata = make(map[string]string)
	}
	for k, v := range policy.Metadata {
		cfg.Metadata[k] = v
	}
	return NewSponsorPaymaster(cfg)
}

// ValidateSponsorPaymasterData validates that paymaster data from the API uses the v2 envelope format.
// Returns the decoded envelope and signature, or an error if the format is invalid.
func ValidateSponsorPaymasterData(data types.Hex) (*corepaymaster.Envelope, types.Hex, error) {
	if !corepaymaster.IsSupported(data.Bytes()) {
		return nil, nil, fmt.Errorf("paymaster data does not use supported envelope format")
	}

	envelopeBytes, sig, err := corepaymaster.SplitEnvelopeAndSignature(data.Bytes(), 65)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to split envelope and signature: %w", err)
	}

	env, err := corepaymaster.DecodePaymasterData(envelopeBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decode envelope: %w", err)
	}

	if env.PaymasterType != corepaymaster.PaymasterTypeSponsor {
		return nil, nil, fmt.Errorf("expected Sponsor type (1), got %d", env.PaymasterType)
	}

	return env, types.Hex(sig), nil
}
