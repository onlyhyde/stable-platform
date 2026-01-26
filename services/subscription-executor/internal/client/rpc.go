package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// RPCClient is a simple JSON-RPC client for Ethereum node
type RPCClient struct {
	url        string
	httpClient *http.Client
}

// NewRPCClient creates a new RPC client
func NewRPCClient(url string) *RPCClient {
	return &RPCClient{
		url: url,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetNonce gets the nonce for an account from EntryPoint
// For ERC-4337, we need to get the nonce from the EntryPoint contract
func (c *RPCClient) GetNonce(ctx context.Context, account string, entryPoint string) (string, error) {
	// Call EntryPoint.getNonce(address sender, uint192 key)
	// key = 0 for default nonce key
	// Function selector: 0x35567e1a
	selector := "35567e1a"

	// Pad account address to 32 bytes
	accountPadded := fmt.Sprintf("%064s", account[2:])

	// Key = 0, padded to 32 bytes
	keyPadded := fmt.Sprintf("%064x", 0)

	callData := "0x" + selector + accountPadded + keyPadded

	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params: []interface{}{
			map[string]string{
				"to":   entryPoint,
				"data": callData,
			},
			"latest",
		},
		ID: 1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	var nonce string
	if err := json.Unmarshal(resp.Result, &nonce); err != nil {
		return "", fmt.Errorf("failed to parse nonce: %w", err)
	}

	return nonce, nil
}

// GetGasPrice gets the current gas price
func (c *RPCClient) GetGasPrice(ctx context.Context) (string, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_gasPrice",
		Params:  []interface{}{},
		ID:      1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to get gas price: %w", err)
	}

	var gasPrice string
	if err := json.Unmarshal(resp.Result, &gasPrice); err != nil {
		return "", fmt.Errorf("failed to parse gas price: %w", err)
	}

	return gasPrice, nil
}

// GetMaxPriorityFeePerGas gets the max priority fee per gas (EIP-1559)
func (c *RPCClient) GetMaxPriorityFeePerGas(ctx context.Context) (string, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_maxPriorityFeePerGas",
		Params:  []interface{}{},
		ID:      1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		// Fallback to 1 gwei if not supported
		return "0x3b9aca00", nil
	}

	var fee string
	if err := json.Unmarshal(resp.Result, &fee); err != nil {
		return "0x3b9aca00", nil
	}

	return fee, nil
}

// GetChainID gets the chain ID
func (c *RPCClient) GetChainID(ctx context.Context) (string, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_chainId",
		Params:  []interface{}{},
		ID:      1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to get chain ID: %w", err)
	}

	var chainID string
	if err := json.Unmarshal(resp.Result, &chainID); err != nil {
		return "", fmt.Errorf("failed to parse chain ID: %w", err)
	}

	return chainID, nil
}

// call makes a JSON-RPC call
func (c *RPCClient) call(ctx context.Context, req JSONRPCRequest) (*JSONRPCResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer httpResp.Body.Close()

	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var resp JSONRPCResponse
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("RPC error %d: %s", resp.Error.Code, resp.Error.Message)
	}

	return &resp, nil
}
