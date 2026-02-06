// Package subscription provides ERC-7715 Permission Manager client for subscription workflows.
package subscription

import (
	"context"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Permission Manager ABI
// ============================================================================

const permissionManagerABIJSON = `[
	{
		"name": "grantPermission",
		"type": "function",
		"inputs": [
			{"name": "grantee", "type": "address"},
			{"name": "target", "type": "address"},
			{
				"name": "permission",
				"type": "tuple",
				"components": [
					{"name": "permissionType", "type": "string"},
					{"name": "isAdjustmentAllowed", "type": "bool"},
					{"name": "data", "type": "bytes"}
				]
			},
			{
				"name": "rules",
				"type": "tuple[]",
				"components": [
					{"name": "ruleType", "type": "string"},
					{"name": "data", "type": "bytes"}
				]
			}
		],
		"outputs": [{"name": "permissionId", "type": "bytes32"}]
	},
	{
		"name": "grantPermissionWithSignature",
		"type": "function",
		"inputs": [
			{"name": "granter", "type": "address"},
			{"name": "grantee", "type": "address"},
			{"name": "target", "type": "address"},
			{
				"name": "permission",
				"type": "tuple",
				"components": [
					{"name": "permissionType", "type": "string"},
					{"name": "isAdjustmentAllowed", "type": "bool"},
					{"name": "data", "type": "bytes"}
				]
			},
			{
				"name": "rules",
				"type": "tuple[]",
				"components": [
					{"name": "ruleType", "type": "string"},
					{"name": "data", "type": "bytes"}
				]
			},
			{"name": "signature", "type": "bytes"}
		],
		"outputs": [{"name": "permissionId", "type": "bytes32"}]
	},
	{
		"name": "revokePermission",
		"type": "function",
		"inputs": [{"name": "permissionId", "type": "bytes32"}],
		"outputs": []
	},
	{
		"name": "adjustPermission",
		"type": "function",
		"inputs": [
			{"name": "permissionId", "type": "bytes32"},
			{"name": "newData", "type": "bytes"}
		],
		"outputs": []
	},
	{
		"name": "usePermission",
		"type": "function",
		"inputs": [
			{"name": "permissionId", "type": "bytes32"},
			{"name": "amount", "type": "uint256"}
		],
		"outputs": [{"name": "success", "type": "bool"}]
	},
	{
		"name": "getPermission",
		"type": "function",
		"stateMutability": "view",
		"inputs": [{"name": "permissionId", "type": "bytes32"}],
		"outputs": [
			{
				"name": "record",
				"type": "tuple",
				"components": [
					{"name": "granter", "type": "address"},
					{"name": "grantee", "type": "address"},
					{"name": "chainId", "type": "uint256"},
					{"name": "target", "type": "address"},
					{
						"name": "permission",
						"type": "tuple",
						"components": [
							{"name": "permissionType", "type": "string"},
							{"name": "isAdjustmentAllowed", "type": "bool"},
							{"name": "data", "type": "bytes"}
						]
					},
					{
						"name": "rules",
						"type": "tuple[]",
						"components": [
							{"name": "ruleType", "type": "string"},
							{"name": "data", "type": "bytes"}
						]
					},
					{"name": "createdAt", "type": "uint256"},
					{"name": "active", "type": "bool"}
				]
			}
		]
	},
	{
		"name": "isPermissionValid",
		"type": "function",
		"stateMutability": "view",
		"inputs": [{"name": "permissionId", "type": "bytes32"}],
		"outputs": [{"name": "valid", "type": "bool"}]
	},
	{
		"name": "getPermissionId",
		"type": "function",
		"stateMutability": "pure",
		"inputs": [
			{"name": "granter", "type": "address"},
			{"name": "grantee", "type": "address"},
			{"name": "target", "type": "address"},
			{"name": "permissionType", "type": "string"},
			{"name": "nonce", "type": "uint256"}
		],
		"outputs": [{"name": "", "type": "bytes32"}]
	},
	{
		"name": "getRemainingAllowance",
		"type": "function",
		"stateMutability": "view",
		"inputs": [{"name": "permissionId", "type": "bytes32"}],
		"outputs": [{"name": "remaining", "type": "uint256"}]
	},
	{
		"name": "getTotalUsage",
		"type": "function",
		"stateMutability": "view",
		"inputs": [{"name": "permissionId", "type": "bytes32"}],
		"outputs": [{"name": "", "type": "uint256"}]
	},
	{
		"name": "isPermissionTypeSupported",
		"type": "function",
		"stateMutability": "view",
		"inputs": [{"name": "permissionType", "type": "string"}],
		"outputs": [{"name": "", "type": "bool"}]
	},
	{
		"name": "nonces",
		"type": "function",
		"stateMutability": "view",
		"inputs": [{"name": "", "type": "address"}],
		"outputs": [{"name": "", "type": "uint256"}]
	}
]`

// ============================================================================
// Permission Manager Client
// ============================================================================

// PermissionManagerClient provides methods to manage ERC-7715 permissions
// for subscription workflows.
type PermissionManagerClient struct {
	client         *ethclient.Client
	managerAddress types.Address
	chainID        uint64
	abi            abi.ABI
}

// NewPermissionManagerClient creates a new PermissionManagerClient.
func NewPermissionManagerClient(
	client *ethclient.Client,
	managerAddress types.Address,
	chainID uint64,
) (*PermissionManagerClient, error) {
	parsedABI, err := abi.JSON(strings.NewReader(permissionManagerABIJSON))
	if err != nil {
		return nil, err
	}

	return &PermissionManagerClient{
		client:         client,
		managerAddress: managerAddress,
		chainID:        chainID,
		abi:            parsedABI,
	}, nil
}

// ManagerAddress returns the permission manager contract address.
func (c *PermissionManagerClient) ManagerAddress() types.Address {
	return c.managerAddress
}

// ============================================================================
// Write Encoders
// ============================================================================

// EncodeGrantPermission encodes calldata to grant a permission directly.
func (c *PermissionManagerClient) EncodeGrantPermission(params GrantPermissionParams) (types.Hex, error) {
	// Convert to contract types
	permission := struct {
		PermissionType      string
		IsAdjustmentAllowed bool
		Data                []byte
	}{
		PermissionType:      string(params.Permission.PermissionType),
		IsAdjustmentAllowed: params.Permission.IsAdjustmentAllowed,
		Data:                params.Permission.Data.Bytes(),
	}

	rules := make([]struct {
		RuleType string
		Data     []byte
	}, len(params.Rules))
	for i, r := range params.Rules {
		rules[i] = struct {
			RuleType string
			Data     []byte
		}{
			RuleType: r.RuleType,
			Data:     r.Data.Bytes(),
		}
	}

	data, err := c.abi.Pack("grantPermission",
		params.Grantee,
		params.Target,
		permission,
		rules,
	)
	if err != nil {
		return nil, err
	}

	return types.HexFromBytes(data), nil
}

// EncodeGrantPermissionWithSignature encodes calldata to grant a permission with signature (meta-tx).
func (c *PermissionManagerClient) EncodeGrantPermissionWithSignature(params GrantPermissionWithSignatureParams) (types.Hex, error) {
	// Convert to contract types
	permission := struct {
		PermissionType      string
		IsAdjustmentAllowed bool
		Data                []byte
	}{
		PermissionType:      string(params.Permission.PermissionType),
		IsAdjustmentAllowed: params.Permission.IsAdjustmentAllowed,
		Data:                params.Permission.Data.Bytes(),
	}

	rules := make([]struct {
		RuleType string
		Data     []byte
	}, len(params.Rules))
	for i, r := range params.Rules {
		rules[i] = struct {
			RuleType string
			Data     []byte
		}{
			RuleType: r.RuleType,
			Data:     r.Data.Bytes(),
		}
	}

	data, err := c.abi.Pack("grantPermissionWithSignature",
		params.Granter,
		params.Grantee,
		params.Target,
		permission,
		rules,
		params.Signature.Bytes(),
	)
	if err != nil {
		return nil, err
	}

	return types.HexFromBytes(data), nil
}

// EncodeRevokePermission encodes calldata to revoke a permission.
func (c *PermissionManagerClient) EncodeRevokePermission(permissionID types.Hash) (types.Hex, error) {
	data, err := c.abi.Pack("revokePermission", permissionID)
	if err != nil {
		return nil, err
	}
	return types.HexFromBytes(data), nil
}

// EncodeAdjustPermission encodes calldata to adjust permission data.
func (c *PermissionManagerClient) EncodeAdjustPermission(permissionID types.Hash, newData types.Hex) (types.Hex, error) {
	data, err := c.abi.Pack("adjustPermission", permissionID, newData.Bytes())
	if err != nil {
		return nil, err
	}
	return types.HexFromBytes(data), nil
}

// EncodeGrantSubscriptionPermission encodes calldata to grant a subscription-specific
// recurring allowance. This is a convenience method that builds the correct
// permission type and rules for subscription payment flows.
func (c *PermissionManagerClient) EncodeGrantSubscriptionPermission(params GrantSubscriptionPermissionParams) (types.Hex, error) {
	// Encode spending limit data
	uint256Type, _ := abi.NewType("uint256", "", nil)
	spendingLimitData, err := abi.Arguments{{Type: uint256Type}}.Pack(params.SpendingLimit)
	if err != nil {
		return nil, err
	}

	// Build rules
	rules := []struct {
		RuleType string
		Data     []byte
	}{}

	// Add expiry rule if specified
	if params.Expiry != nil && params.Expiry.Sign() > 0 {
		expiryData, err := abi.Arguments{{Type: uint256Type}}.Pack(params.Expiry)
		if err != nil {
			return nil, err
		}
		rules = append(rules, struct {
			RuleType string
			Data     []byte
		}{
			RuleType: string(RuleTypeExpiry),
			Data:     expiryData,
		})
	}

	// Add spending limit rule
	rules = append(rules, struct {
		RuleType string
		Data     []byte
	}{
		RuleType: string(RuleTypeSpendingLimit),
		Data:     spendingLimitData,
	})

	// Build permission
	permission := struct {
		PermissionType      string
		IsAdjustmentAllowed bool
		Data                []byte
	}{
		PermissionType:      string(PermissionTypeSubscription),
		IsAdjustmentAllowed: params.IsAdjustmentAllowed,
		Data:                spendingLimitData,
	}

	data, err := c.abi.Pack("grantPermission",
		params.Grantee,
		params.Target,
		permission,
		rules,
	)
	if err != nil {
		return nil, err
	}

	return types.HexFromBytes(data), nil
}

// ============================================================================
// Read Functions
// ============================================================================

// toPermissionCallMsg creates an ethereum.CallMsg for contract calls.
func (c *PermissionManagerClient) toPermissionCallMsg(data []byte) ethereum.CallMsg {
	return ethereum.CallMsg{
		To:   &c.managerAddress,
		Data: data,
	}
}

// GetPermission retrieves the full permission record.
func (c *PermissionManagerClient) GetPermission(ctx context.Context, permissionID types.Hash) (*PermissionRecord, error) {
	caller := bind.CallOpts{Context: ctx}

	data, err := c.abi.Pack("getPermission", permissionID)
	if err != nil {
		return nil, err
	}

	result, err := c.client.CallContract(ctx, c.toPermissionCallMsg(data), nil)
	if err != nil {
		return nil, err
	}

	// Unpack result
	unpacked, err := c.abi.Unpack("getPermission", result)
	if err != nil {
		return nil, err
	}

	_ = caller // Keep for future use with bind.ContractCaller
	if len(unpacked) == 0 {
		return nil, nil
	}

	// Parse the result struct
	record := unpacked[0].(struct {
		Granter    common.Address `json:"granter"`
		Grantee    common.Address `json:"grantee"`
		ChainId    *big.Int       `json:"chainId"`
		Target     common.Address `json:"target"`
		Permission struct {
			PermissionType      string `json:"permissionType"`
			IsAdjustmentAllowed bool   `json:"isAdjustmentAllowed"`
			Data                []byte `json:"data"`
		} `json:"permission"`
		Rules []struct {
			RuleType string `json:"ruleType"`
			Data     []byte `json:"data"`
		} `json:"rules"`
		CreatedAt *big.Int `json:"createdAt"`
		Active    bool     `json:"active"`
	})

	// Convert rules
	rules := make([]Rule, len(record.Rules))
	for i, r := range record.Rules {
		rules[i] = Rule{
			RuleType: r.RuleType,
			Data:     types.HexFromBytes(r.Data),
		}
	}

	return &PermissionRecord{
		Granter: record.Granter,
		Grantee: record.Grantee,
		ChainID: record.ChainId,
		Target:  record.Target,
		Permission: Permission{
			PermissionType:      PermissionType(record.Permission.PermissionType),
			IsAdjustmentAllowed: record.Permission.IsAdjustmentAllowed,
			Data:                types.HexFromBytes(record.Permission.Data),
		},
		Rules:     rules,
		CreatedAt: record.CreatedAt,
		Active:    record.Active,
	}, nil
}

// IsPermissionValid checks if a permission is currently valid.
func (c *PermissionManagerClient) IsPermissionValid(ctx context.Context, permissionID types.Hash) (bool, error) {
	data, err := c.abi.Pack("isPermissionValid", permissionID)
	if err != nil {
		return false, err
	}

	result, err := c.client.CallContract(ctx, c.toPermissionCallMsg(data), nil)
	if err != nil {
		return false, err
	}

	unpacked, err := c.abi.Unpack("isPermissionValid", result)
	if err != nil {
		return false, err
	}

	return unpacked[0].(bool), nil
}

// GetPermissionID computes a permission ID.
func (c *PermissionManagerClient) GetPermissionID(
	ctx context.Context,
	granter types.Address,
	grantee types.Address,
	target types.Address,
	permissionType string,
	nonce *big.Int,
) (types.Hash, error) {
	data, err := c.abi.Pack("getPermissionId",
		granter,
		grantee,
		target,
		permissionType,
		nonce,
	)
	if err != nil {
		return types.Hash{}, err
	}

	result, err := c.client.CallContract(ctx, c.toPermissionCallMsg(data), nil)
	if err != nil {
		return types.Hash{}, err
	}

	unpacked, err := c.abi.Unpack("getPermissionId", result)
	if err != nil {
		return types.Hash{}, err
	}

	hash := unpacked[0].([32]byte)
	return types.Hash(hash), nil
}

// GetRemainingAllowance gets the remaining allowance for the current period.
func (c *PermissionManagerClient) GetRemainingAllowance(ctx context.Context, permissionID types.Hash) (*big.Int, error) {
	data, err := c.abi.Pack("getRemainingAllowance", permissionID)
	if err != nil {
		return nil, err
	}

	result, err := c.client.CallContract(ctx, c.toPermissionCallMsg(data), nil)
	if err != nil {
		return nil, err
	}

	unpacked, err := c.abi.Unpack("getRemainingAllowance", result)
	if err != nil {
		return nil, err
	}

	return unpacked[0].(*big.Int), nil
}

// GetTotalUsage gets the total cumulative usage.
func (c *PermissionManagerClient) GetTotalUsage(ctx context.Context, permissionID types.Hash) (*big.Int, error) {
	data, err := c.abi.Pack("getTotalUsage", permissionID)
	if err != nil {
		return nil, err
	}

	result, err := c.client.CallContract(ctx, c.toPermissionCallMsg(data), nil)
	if err != nil {
		return nil, err
	}

	unpacked, err := c.abi.Unpack("getTotalUsage", result)
	if err != nil {
		return nil, err
	}

	return unpacked[0].(*big.Int), nil
}

// IsPermissionTypeSupported checks if a permission type is supported.
func (c *PermissionManagerClient) IsPermissionTypeSupported(ctx context.Context, permissionType string) (bool, error) {
	data, err := c.abi.Pack("isPermissionTypeSupported", permissionType)
	if err != nil {
		return false, err
	}

	result, err := c.client.CallContract(ctx, c.toPermissionCallMsg(data), nil)
	if err != nil {
		return false, err
	}

	unpacked, err := c.abi.Unpack("isPermissionTypeSupported", result)
	if err != nil {
		return false, err
	}

	return unpacked[0].(bool), nil
}

// GetNonce gets the current nonce for an address.
func (c *PermissionManagerClient) GetNonce(ctx context.Context, account types.Address) (*big.Int, error) {
	data, err := c.abi.Pack("nonces", account)
	if err != nil {
		return nil, err
	}

	result, err := c.client.CallContract(ctx, c.toPermissionCallMsg(data), nil)
	if err != nil {
		return nil, err
	}

	unpacked, err := c.abi.Unpack("nonces", result)
	if err != nil {
		return nil, err
	}

	return unpacked[0].(*big.Int), nil
}
