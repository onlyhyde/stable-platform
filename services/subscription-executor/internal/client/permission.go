package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
)

// ErrInvalidHex indicates an invalid hexadecimal string format.
var ErrInvalidHex = errors.New("invalid hexadecimal format")

// PermissionClient validates ERC-7715 permissions via RPC calls.
type PermissionClient struct {
	rpcClient            *RPCClient
	permissionManagerAddr string
}

// NewPermissionClient creates a new permission validation client.
func NewPermissionClient(rpcClient *RPCClient, permissionManagerAddr string) *PermissionClient {
	return &PermissionClient{
		rpcClient:            rpcClient,
		permissionManagerAddr: permissionManagerAddr,
	}
}

// IsPermissionValid checks if a permission is still valid by calling
// PermissionManager.isPermissionValid(bytes32 permissionId).
func (c *PermissionClient) IsPermissionValid(ctx context.Context, permissionID string) (bool, error) {
	if c.permissionManagerAddr == "" {
		// No permission manager configured - skip validation
		return true, nil
	}

	// Function selector: isPermissionValid(bytes32)
	// keccak256("isPermissionValid(bytes32)") = first 4 bytes
	selector := "70897b23" // isPermissionValid(bytes32)

	permIDPadded, err := validatePermissionID(permissionID)
	if err != nil {
		return false, fmt.Errorf("invalid permission ID: %w", err)
	}

	callData := "0x" + selector + permIDPadded

	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params: []interface{}{
			map[string]string{
				"to":   c.permissionManagerAddr,
				"data": callData,
			},
			"latest",
		},
		ID: 1,
	}

	resp, err := c.rpcClient.call(ctx, req)
	if err != nil {
		return false, fmt.Errorf("failed to check permission validity: %w", err)
	}

	var result string
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return false, fmt.Errorf("failed to parse permission result: %w", err)
	}

	// Decode boolean result (32 bytes, last byte is 0 or 1)
	resultBytes := strings.TrimPrefix(result, "0x")
	if len(resultBytes) < 64 {
		return false, nil
	}

	n := new(big.Int)
	n.SetString(resultBytes, 16)
	return n.Cmp(big.NewInt(0)) != 0, nil
}

// GetRemainingAllowance returns the remaining spending allowance for a permission.
// Calls PermissionManager.getRemainingAllowance(bytes32 permissionId).
func (c *PermissionClient) GetRemainingAllowance(ctx context.Context, permissionID string) (*big.Int, error) {
	if c.permissionManagerAddr == "" {
		return nil, fmt.Errorf("permission manager address not configured")
	}

	// Function selector: getRemainingAllowance(bytes32)
	selector := "e271b0e4" // getRemainingAllowance(bytes32)

	permIDPadded, err := validatePermissionID(permissionID)
	if err != nil {
		return nil, fmt.Errorf("invalid permission ID: %w", err)
	}

	callData := "0x" + selector + permIDPadded

	req := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params: []interface{}{
			map[string]string{
				"to":   c.permissionManagerAddr,
				"data": callData,
			},
			"latest",
		},
		ID: 1,
	}

	resp, err := c.rpcClient.call(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get remaining allowance: %w", err)
	}

	var result string
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to parse allowance result: %w", err)
	}

	resultHex := strings.TrimPrefix(result, "0x")
	allowance := new(big.Int)
	allowance.SetString(resultHex, 16)
	return allowance, nil
}

// isValidHex checks if a string contains only valid hexadecimal characters.
func isValidHex(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// validatePermissionID validates and normalizes a permission ID.
func validatePermissionID(permissionID string) (string, error) {
	permIDPadded := strings.TrimPrefix(permissionID, "0x")
	if permIDPadded == "" {
		return "", fmt.Errorf("%w: empty permission ID", ErrInvalidHex)
	}
	if !isValidHex(permIDPadded) {
		return "", fmt.Errorf("%w: permission ID contains invalid characters", ErrInvalidHex)
	}
	if len(permIDPadded) < 64 {
		permIDPadded = fmt.Sprintf("%064s", permIDPadded)
	}
	return permIDPadded, nil
}
