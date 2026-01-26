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

// BundlerClient is a client for the ERC-4337 bundler
type BundlerClient struct {
	url        string
	httpClient *http.Client
	entryPoint string
}

// NewBundlerClient creates a new bundler client
func NewBundlerClient(url, entryPoint string) *BundlerClient {
	return &BundlerClient{
		url:        url,
		entryPoint: entryPoint,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// JSONRPCRequest represents a JSON-RPC request
type JSONRPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

// JSONRPCResponse represents a JSON-RPC response
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
	ID      int             `json:"id"`
}

// JSONRPCError represents a JSON-RPC error
type JSONRPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// PackedUserOperation represents a packed UserOperation for RPC
type PackedUserOperation struct {
	Sender             string `json:"sender"`
	Nonce              string `json:"nonce"`
	InitCode           string `json:"initCode"`
	CallData           string `json:"callData"`
	AccountGasLimits   string `json:"accountGasLimits"`
	PreVerificationGas string `json:"preVerificationGas"`
	GasFees            string `json:"gasFees"`
	PaymasterAndData   string `json:"paymasterAndData"`
	Signature          string `json:"signature"`
}

// UserOperationReceipt represents the receipt of a UserOperation
type UserOperationReceipt struct {
	UserOpHash    string `json:"userOpHash"`
	EntryPoint    string `json:"entryPoint"`
	Sender        string `json:"sender"`
	Nonce         string `json:"nonce"`
	Paymaster     string `json:"paymaster,omitempty"`
	ActualGasCost string `json:"actualGasCost"`
	ActualGasUsed string `json:"actualGasUsed"`
	Success       bool   `json:"success"`
	Reason        string `json:"reason,omitempty"`
	Receipt       struct {
		TransactionHash string `json:"transactionHash"`
		BlockNumber     string `json:"blockNumber"`
		Status          string `json:"status"`
	} `json:"receipt"`
}

// GasEstimation represents gas estimation result
type GasEstimation struct {
	PreVerificationGas            string `json:"preVerificationGas"`
	VerificationGasLimit          string `json:"verificationGasLimit"`
	CallGasLimit                  string `json:"callGasLimit"`
	PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
	PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
}

// SendUserOperation sends a UserOperation to the bundler
func (c *BundlerClient) SendUserOperation(ctx context.Context, op *PackedUserOperation) (string, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_sendUserOperation",
		Params:  []interface{}{op, c.entryPoint},
		ID:      1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to send user operation: %w", err)
	}

	var userOpHash string
	if err := json.Unmarshal(resp.Result, &userOpHash); err != nil {
		return "", fmt.Errorf("failed to parse user operation hash: %w", err)
	}

	return userOpHash, nil
}

// EstimateUserOperationGas estimates gas for a UserOperation
func (c *BundlerClient) EstimateUserOperationGas(ctx context.Context, op *PackedUserOperation) (*GasEstimation, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_estimateUserOperationGas",
		Params:  []interface{}{op, c.entryPoint},
		ID:      1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to estimate gas: %w", err)
	}

	var estimation GasEstimation
	if err := json.Unmarshal(resp.Result, &estimation); err != nil {
		return nil, fmt.Errorf("failed to parse gas estimation: %w", err)
	}

	return &estimation, nil
}

// GetUserOperationReceipt gets the receipt of a UserOperation
func (c *BundlerClient) GetUserOperationReceipt(ctx context.Context, userOpHash string) (*UserOperationReceipt, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_getUserOperationReceipt",
		Params:  []interface{}{userOpHash},
		ID:      1,
	}

	resp, err := c.call(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get receipt: %w", err)
	}

	// Check if result is null (not yet included)
	if string(resp.Result) == "null" {
		return nil, nil
	}

	var receipt UserOperationReceipt
	if err := json.Unmarshal(resp.Result, &receipt); err != nil {
		return nil, fmt.Errorf("failed to parse receipt: %w", err)
	}

	return &receipt, nil
}

// WaitForReceipt waits for a UserOperation receipt with timeout
func (c *BundlerClient) WaitForReceipt(ctx context.Context, userOpHash string, timeout time.Duration) (*UserOperationReceipt, error) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	timeoutCh := time.After(timeout)

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timeoutCh:
			return nil, fmt.Errorf("timeout waiting for receipt")
		case <-ticker.C:
			receipt, err := c.GetUserOperationReceipt(ctx, userOpHash)
			if err != nil {
				return nil, err
			}
			if receipt != nil {
				return receipt, nil
			}
		}
	}
}

// call makes a JSON-RPC call to the bundler
func (c *BundlerClient) call(ctx context.Context, req JSONRPCRequest) (*JSONRPCResponse, error) {
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
