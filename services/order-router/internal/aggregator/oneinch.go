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
	oneInchAPIBase = "https://api.1inch.dev/swap/v6.0"
)

// OneInchAggregator implements Aggregator for 1inch API
type OneInchAggregator struct {
	apiKey  string
	chainID int
	client  *http.Client
}

// NewOneInchAggregator creates a new 1inch aggregator
func NewOneInchAggregator(apiKey string, chainID int) *OneInchAggregator {
	return &OneInchAggregator{
		apiKey:  apiKey,
		chainID: chainID,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (a *OneInchAggregator) Name() string {
	return "1inch"
}

func (a *OneInchAggregator) IsAvailable() bool {
	return a.apiKey != ""
}

func (a *OneInchAggregator) SupportedChains() []int {
	return []int{1, 10, 56, 137, 42161, 43114, 8453} // Mainnet, Optimism, BSC, Polygon, Arbitrum, Avalanche, Base
}

func (a *OneInchAggregator) GetQuote(ctx context.Context, req *model.QuoteRequest) (*model.AggregatorQuote, error) {
	if !a.IsAvailable() {
		return nil, fmt.Errorf("1inch API key not configured")
	}

	// Build quote URL
	endpoint := fmt.Sprintf("%s/%d/quote", oneInchAPIBase, a.chainID)
	params := url.Values{}
	params.Set("src", req.TokenIn)
	params.Set("dst", req.TokenOut)
	params.Set("amount", req.AmountIn)

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())

	// Create request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+a.apiKey)
	httpReq.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("1inch API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var quoteResp oneInchQuoteResponse
	if err := json.NewDecoder(resp.Body).Decode(&quoteResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &model.AggregatorQuote{
		Source:      a.Name(),
		AmountOut:   quoteResp.DstAmount,
		GasEstimate: uint64(quoteResp.Gas),
		Protocols:   extractProtocols(quoteResp.Protocols),
	}, nil
}

func (a *OneInchAggregator) BuildSwap(ctx context.Context, req *model.SwapRequest) (*model.SwapResponse, error) {
	if !a.IsAvailable() {
		return nil, fmt.Errorf("1inch API key not configured")
	}

	// Build swap URL
	endpoint := fmt.Sprintf("%s/%d/swap", oneInchAPIBase, a.chainID)
	params := url.Values{}
	params.Set("src", req.TokenIn)
	params.Set("dst", req.TokenOut)
	params.Set("amount", req.AmountIn)
	params.Set("from", req.Recipient)
	params.Set("receiver", req.Recipient)
	params.Set("slippage", fmt.Sprintf("%.2f", req.Slippage/100)) // Convert bps to percentage

	if req.Deadline > 0 {
		params.Set("deadline", fmt.Sprintf("%d", req.Deadline))
	}

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())

	// Create request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+a.apiKey)
	httpReq.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("1inch API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var swapResp oneInchSwapResponse
	if err := json.NewDecoder(resp.Body).Decode(&swapResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &model.SwapResponse{
		To:       swapResp.Tx.To,
		Data:     swapResp.Tx.Data,
		Value:    swapResp.Tx.Value,
		GasLimit: uint64(swapResp.Tx.Gas),
		Quote: model.QuoteResponse{
			AmountIn:  req.AmountIn,
			AmountOut: swapResp.DstAmount,
			Source:    a.Name(),
		},
	}, nil
}

// Response types

type oneInchQuoteResponse struct {
	DstAmount string          `json:"dstAmount"`
	Gas       int             `json:"gas"`
	Protocols json.RawMessage `json:"protocols"`
}

type oneInchSwapResponse struct {
	DstAmount string `json:"dstAmount"`
	Tx        struct {
		From     string `json:"from"`
		To       string `json:"to"`
		Data     string `json:"data"`
		Value    string `json:"value"`
		Gas      int    `json:"gas"`
		GasPrice string `json:"gasPrice"`
	} `json:"tx"`
}

// extractProtocols parses the 1inch API protocols response.
// The format is a 3-level nested array: [routes][steps][parts]
// Each part contains a "name" field identifying the DEX protocol used.
func extractProtocols(raw json.RawMessage) []string {
	if len(raw) == 0 {
		return []string{"1inch_aggregation"}
	}

	// 1inch protocols structure: [][][]{ name: string, part: number, ... }
	var routes [][][]struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(raw, &routes); err != nil {
		return []string{"1inch_aggregation"}
	}

	seen := make(map[string]struct{})
	var protocols []string
	for _, route := range routes {
		for _, step := range route {
			for _, part := range step {
				name := part.Name
				if name == "" {
					continue
				}
				if _, exists := seen[name]; !exists {
					seen[name] = struct{}{}
					protocols = append(protocols, name)
				}
			}
		}
	}

	if len(protocols) == 0 {
		return []string{"1inch_aggregation"}
	}
	return protocols
}
