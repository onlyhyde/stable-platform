package aggregator

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/stablenet/stable-platform/services/order-router/internal/model"
)

const (
	zeroXAPIBase = "https://api.0x.org"
)

// ZeroXAggregator implements Aggregator for 0x API
type ZeroXAggregator struct {
	apiKey  string
	chainID int
	client  *http.Client
}

// NewZeroXAggregator creates a new 0x aggregator
func NewZeroXAggregator(apiKey string, chainID int) *ZeroXAggregator {
	return &ZeroXAggregator{
		apiKey:  apiKey,
		chainID: chainID,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (a *ZeroXAggregator) Name() string {
	return "0x"
}

func (a *ZeroXAggregator) IsAvailable() bool {
	return a.apiKey != ""
}

func (a *ZeroXAggregator) SupportedChains() []int {
	return []int{1, 10, 56, 137, 42161, 43114, 8453, 324} // + zkSync Era
}

func (a *ZeroXAggregator) getAPIEndpoint() string {
	// Different endpoints for different chains
	switch a.chainID {
	case 1:
		return "https://api.0x.org"
	case 137:
		return "https://polygon.api.0x.org"
	case 10:
		return "https://optimism.api.0x.org"
	case 42161:
		return "https://arbitrum.api.0x.org"
	case 8453:
		return "https://base.api.0x.org"
	default:
		return zeroXAPIBase
	}
}

func (a *ZeroXAggregator) GetQuote(ctx context.Context, req *model.QuoteRequest) (*model.AggregatorQuote, error) {
	if !a.IsAvailable() {
		return nil, fmt.Errorf("0x API key not configured")
	}

	// Build quote URL
	endpoint := fmt.Sprintf("%s/swap/v1/quote", a.getAPIEndpoint())
	params := url.Values{}
	params.Set("sellToken", req.TokenIn)
	params.Set("buyToken", req.TokenOut)
	params.Set("sellAmount", req.AmountIn)

	if req.Slippage > 0 {
		params.Set("slippagePercentage", fmt.Sprintf("%.4f", req.Slippage/10000)) // Convert bps to decimal
	}

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())

	// Create request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("0x-api-key", a.apiKey)
	httpReq.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("0x API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var quoteResp zeroXQuoteResponse
	if err := json.NewDecoder(resp.Body).Decode(&quoteResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &model.AggregatorQuote{
		Source:      a.Name(),
		AmountOut:   quoteResp.BuyAmount,
		GasEstimate: uint64(quoteResp.EstimatedGas),
		Protocols:   quoteResp.Sources,
		To:          quoteResp.To,
		Data:        quoteResp.Data,
		Value:       quoteResp.Value,
	}, nil
}

func (a *ZeroXAggregator) BuildSwap(ctx context.Context, req *model.SwapRequest) (*model.SwapResponse, error) {
	if !a.IsAvailable() {
		return nil, fmt.Errorf("0x API key not configured")
	}

	// Build swap URL (0x quote endpoint returns ready-to-use calldata)
	endpoint := fmt.Sprintf("%s/swap/v1/quote", a.getAPIEndpoint())
	params := url.Values{}
	params.Set("sellToken", req.TokenIn)
	params.Set("buyToken", req.TokenOut)
	params.Set("sellAmount", req.AmountIn)
	params.Set("takerAddress", req.Recipient)

	if req.Slippage > 0 {
		params.Set("slippagePercentage", fmt.Sprintf("%.4f", req.Slippage/10000))
	}

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())

	// Create request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("0x-api-key", a.apiKey)
	httpReq.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("0x API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var quoteResp zeroXQuoteResponse
	if err := json.NewDecoder(resp.Body).Decode(&quoteResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &model.SwapResponse{
		To:       quoteResp.To,
		Data:     quoteResp.Data,
		Value:    quoteResp.Value,
		GasLimit: uint64(quoteResp.EstimatedGas),
		Quote: model.QuoteResponse{
			AmountIn:  req.AmountIn,
			AmountOut: quoteResp.BuyAmount,
			Source:    a.Name(),
		},
	}, nil
}

// Response types

type zeroXQuoteResponse struct {
	Price             string   `json:"price"`
	GuaranteedPrice   string   `json:"guaranteedPrice"`
	EstimatedPriceImpact string `json:"estimatedPriceImpact"`
	To                string   `json:"to"`
	Data              string   `json:"data"`
	Value             string   `json:"value"`
	Gas               string   `json:"gas"`
	EstimatedGas      int      `json:"estimatedGas"`
	GasPrice          string   `json:"gasPrice"`
	ProtocolFee       string   `json:"protocolFee"`
	MinimumProtocolFee string  `json:"minimumProtocolFee"`
	BuyTokenAddress   string   `json:"buyTokenAddress"`
	SellTokenAddress  string   `json:"sellTokenAddress"`
	BuyAmount         string   `json:"buyAmount"`
	SellAmount        string   `json:"sellAmount"`
	Sources           []string `json:"sources"`
	AllowanceTarget   string   `json:"allowanceTarget"`
}
