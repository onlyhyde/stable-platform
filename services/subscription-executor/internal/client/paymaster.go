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

// PaymasterClient is a client for the ERC-7677 paymaster proxy
type PaymasterClient struct {
	url        string
	httpClient *http.Client
}

// NewPaymasterClient creates a new paymaster client
func NewPaymasterClient(url string) *PaymasterClient {
	return &PaymasterClient{
		url: url,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// PaymasterStubDataRequest represents the request for pm_getPaymasterStubData
type PaymasterStubDataRequest struct {
	Sender             string `json:"sender"`
	Nonce              string `json:"nonce"`
	InitCode           string `json:"initCode"`
	CallData           string `json:"callData"`
	AccountGasLimits   string `json:"accountGasLimits,omitempty"`
	PreVerificationGas string `json:"preVerificationGas,omitempty"`
	GasFees            string `json:"gasFees,omitempty"`
}

// PaymasterStubDataResponse represents the response from pm_getPaymasterStubData
type PaymasterStubDataResponse struct {
	Paymaster                     string `json:"paymaster"`
	PaymasterData                 string `json:"paymasterData"`
	PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit"`
	PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit"`
	IsFinal                       bool   `json:"isFinal,omitempty"`
}

// PaymasterDataRequest represents the request for pm_getPaymasterData
type PaymasterDataRequest struct {
	Sender             string `json:"sender"`
	Nonce              string `json:"nonce"`
	InitCode           string `json:"initCode"`
	CallData           string `json:"callData"`
	AccountGasLimits   string `json:"accountGasLimits"`
	PreVerificationGas string `json:"preVerificationGas"`
	GasFees            string `json:"gasFees"`
}

// PaymasterDataResponse represents the response from pm_getPaymasterData
type PaymasterDataResponse struct {
	Paymaster                     string `json:"paymaster"`
	PaymasterData                 string `json:"paymasterData"`
	PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
	PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
}

// GetPaymasterStubData gets stub data for gas estimation
func (c *PaymasterClient) GetPaymasterStubData(ctx context.Context, op *PaymasterStubDataRequest, chainID string, entryPoint string) (*PaymasterStubDataResponse, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "pm_getPaymasterStubData",
		Params: []interface{}{
			op,
			entryPoint,
			chainID,
			map[string]interface{}{}, // context (empty for now)
		},
		ID: 1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get paymaster stub data: %w", err)
	}

	var stubData PaymasterStubDataResponse
	if err := json.Unmarshal(resp.Result, &stubData); err != nil {
		return nil, fmt.Errorf("failed to parse paymaster stub data: %w", err)
	}

	return &stubData, nil
}

// GetPaymasterData gets the final paymaster data with signature
func (c *PaymasterClient) GetPaymasterData(ctx context.Context, op *PaymasterDataRequest, chainID string, entryPoint string) (*PaymasterDataResponse, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "pm_getPaymasterData",
		Params: []interface{}{
			op,
			entryPoint,
			chainID,
			map[string]interface{}{}, // context (empty for now)
		},
		ID: 1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get paymaster data: %w", err)
	}

	var data PaymasterDataResponse
	if err := json.Unmarshal(resp.Result, &data); err != nil {
		return nil, fmt.Errorf("failed to parse paymaster data: %w", err)
	}

	return &data, nil
}

// call makes a JSON-RPC call to the paymaster
func (c *PaymasterClient) call(ctx context.Context, req JSONRPCRequest) (*JSONRPCResponse, error) {
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
