package sessionkeys

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Session Key Executor Client
// ============================================================================

// ExecutorClient provides methods to manage session keys and execute transactions
// through the SessionKeyExecutor contract.
type ExecutorClient struct {
	// ExecutorAddress is the executor contract address.
	ExecutorAddress types.Address

	// ChainId is the chain ID.
	ChainId uint64

	// Client is the Ethereum client for read operations.
	Client *ethclient.Client
}

// NewExecutorClient creates a new Session Key Executor client.
func NewExecutorClient(config ExecutorConfig) *ExecutorClient {
	return &ExecutorClient{
		ExecutorAddress: config.ExecutorAddress,
		ChainId:         config.ChainId,
	}
}

// WithClient sets the Ethereum client for read operations.
func (c *ExecutorClient) WithClient(client *ethclient.Client) *ExecutorClient {
	c.Client = client
	return c
}

// ============================================================================
// Management Functions (Encoding)
// ============================================================================

// EncodeAddSessionKey encodes calldata to add a session key.
func (c *ExecutorClient) EncodeAddSessionKey(params CreateSessionKeyParams) (types.Hex, error) {
	// Set defaults
	validAfter := params.ValidAfter
	if validAfter == 0 {
		validAfter = uint64(time.Now().Unix())
	}

	validUntil := params.ValidUntil
	if validUntil == 0 {
		validUntil = uint64(time.Now().Add(time.Hour).Unix()) // 1 hour default
	}

	spendingLimit := params.SpendingLimit
	if spendingLimit == nil {
		spendingLimit = big.NewInt(0)
	}

	data, err := SessionKeyExecutorABI.Pack(
		"addSessionKey",
		ToCommonAddress(params.SessionKey),
		validAfter,
		validUntil,
		spendingLimit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode addSessionKey: %w", err)
	}

	return types.Hex(data), nil
}

// EncodeRevokeSessionKey encodes calldata to revoke a session key.
func (c *ExecutorClient) EncodeRevokeSessionKey(sessionKey types.Address) (types.Hex, error) {
	data, err := SessionKeyExecutorABI.Pack(
		"revokeSessionKey",
		ToCommonAddress(sessionKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode revokeSessionKey: %w", err)
	}

	return types.Hex(data), nil
}

// EncodeGrantPermission encodes calldata to grant a permission.
func (c *ExecutorClient) EncodeGrantPermission(sessionKey types.Address, permission PermissionInput) (types.Hex, error) {
	selector := permission.Selector
	if len(selector) == 0 {
		selector = WildcardSelector
	}

	maxValue := permission.MaxValue
	if maxValue == nil {
		maxValue = big.NewInt(0)
	}

	data, err := SessionKeyExecutorABI.Pack(
		"grantPermission",
		ToCommonAddress(sessionKey),
		ToCommonAddress(permission.Target),
		ToBytes4(selector),
		maxValue,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode grantPermission: %w", err)
	}

	return types.Hex(data), nil
}

// EncodeRevokePermission encodes calldata to revoke a permission.
func (c *ExecutorClient) EncodeRevokePermission(sessionKey, target types.Address, selector types.Hex) (types.Hex, error) {
	data, err := SessionKeyExecutorABI.Pack(
		"revokePermission",
		ToCommonAddress(sessionKey),
		ToCommonAddress(target),
		ToBytes4(selector),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode revokePermission: %w", err)
	}

	return types.Hex(data), nil
}

// ============================================================================
// Read Functions
// ============================================================================

// GetSessionKey gets session key configuration from the contract.
func (c *ExecutorClient) GetSessionKey(ctx context.Context, account, sessionKey types.Address) (*SessionKeyConfig, error) {
	if c.Client == nil {
		return nil, fmt.Errorf("client not set")
	}

	data, err := SessionKeyExecutorABI.Pack(
		"getSessionKey",
		ToCommonAddress(account),
		ToCommonAddress(sessionKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack getSessionKey: %w", err)
	}

	result, err := c.Client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.ExecutorAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getSessionKey: %w", err)
	}

	// Unpack the result
	unpacked, err := SessionKeyExecutorABI.Unpack("getSessionKey", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack getSessionKey: %w", err)
	}

	if len(unpacked) == 0 {
		return nil, fmt.Errorf("empty result from getSessionKey")
	}

	// Parse the struct
	config := parseSessionKeyConfig(unpacked[0])
	return config, nil
}

// GetSessionKeyState gets session key state with computed values.
func (c *ExecutorClient) GetSessionKeyState(ctx context.Context, account, sessionKey types.Address) (*SessionKeyState, error) {
	config, err := c.GetSessionKey(ctx, account, sessionKey)
	if err != nil {
		return nil, err
	}

	now := uint64(time.Now().Unix())

	isValid := config.IsActive &&
		now >= config.ValidAfter &&
		now <= config.ValidUntil

	var timeRemaining uint64
	if config.ValidUntil > now {
		timeRemaining = config.ValidUntil - now
	}

	remainingLimit := new(big.Int)
	if config.SpendingLimit.Cmp(config.SpentAmount) > 0 {
		remainingLimit.Sub(config.SpendingLimit, config.SpentAmount)
	}

	return &SessionKeyState{
		Config:         config,
		RemainingLimit: remainingLimit,
		IsValid:        isValid,
		TimeRemaining:  timeRemaining,
	}, nil
}

// HasPermission checks if session key has permission.
func (c *ExecutorClient) HasPermission(ctx context.Context, account, sessionKey, target types.Address, selector types.Hex) (bool, error) {
	if c.Client == nil {
		return false, fmt.Errorf("client not set")
	}

	data, err := SessionKeyExecutorABI.Pack(
		"hasPermission",
		ToCommonAddress(account),
		ToCommonAddress(sessionKey),
		ToCommonAddress(target),
		ToBytes4(selector),
	)
	if err != nil {
		return false, fmt.Errorf("failed to pack hasPermission: %w", err)
	}

	result, err := c.Client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.ExecutorAddress),
		Data: data,
	}, nil)
	if err != nil {
		return false, fmt.Errorf("failed to call hasPermission: %w", err)
	}

	unpacked, err := SessionKeyExecutorABI.Unpack("hasPermission", result)
	if err != nil {
		return false, fmt.Errorf("failed to unpack hasPermission: %w", err)
	}

	if len(unpacked) == 0 {
		return false, nil
	}

	return unpacked[0].(bool), nil
}

// GetActiveSessionKeys gets all active session keys for an account.
func (c *ExecutorClient) GetActiveSessionKeys(ctx context.Context, account types.Address) ([]types.Address, error) {
	if c.Client == nil {
		return nil, fmt.Errorf("client not set")
	}

	data, err := SessionKeyExecutorABI.Pack(
		"getActiveSessionKeys",
		ToCommonAddress(account),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack getActiveSessionKeys: %w", err)
	}

	result, err := c.Client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.ExecutorAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getActiveSessionKeys: %w", err)
	}

	unpacked, err := SessionKeyExecutorABI.Unpack("getActiveSessionKeys", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack getActiveSessionKeys: %w", err)
	}

	if len(unpacked) == 0 {
		return nil, nil
	}

	addresses := unpacked[0].([]common.Address)
	result_addresses := make([]types.Address, len(addresses))
	for i, addr := range addresses {
		result_addresses[i] = types.Address(addr)
	}

	return result_addresses, nil
}

// GetRemainingSpendingLimit gets remaining spending limit for a session key.
func (c *ExecutorClient) GetRemainingSpendingLimit(ctx context.Context, account, sessionKey types.Address) (*big.Int, error) {
	if c.Client == nil {
		return nil, fmt.Errorf("client not set")
	}

	data, err := SessionKeyExecutorABI.Pack(
		"getRemainingSpendingLimit",
		ToCommonAddress(account),
		ToCommonAddress(sessionKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack getRemainingSpendingLimit: %w", err)
	}

	result, err := c.Client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.ExecutorAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getRemainingSpendingLimit: %w", err)
	}

	unpacked, err := SessionKeyExecutorABI.Unpack("getRemainingSpendingLimit", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack getRemainingSpendingLimit: %w", err)
	}

	if len(unpacked) == 0 {
		return big.NewInt(0), nil
	}

	return unpacked[0].(*big.Int), nil
}

// ============================================================================
// Execution Functions
// ============================================================================

// SignExecution signs an execution request with session key.
func (c *ExecutorClient) SignExecution(
	sessionKey *ecdsa.PrivateKey,
	account types.Address,
	request ExecutionRequest,
	nonce *big.Int,
) (types.Hex, error) {
	// Compute the execution hash
	hash := ComputeExecutionHash(
		c.ChainId,
		c.ExecutorAddress,
		account,
		request.Target,
		request.Value,
		request.Data,
		nonce,
	)

	// Sign as Ethereum signed message (EIP-191)
	msgHash := accounts.TextHash(hash[:])
	sig, err := crypto.Sign(msgHash, sessionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign execution: %w", err)
	}

	// Adjust V value for Ethereum compatibility (27 or 28)
	if sig[64] < 27 {
		sig[64] += 27
	}

	return types.Hex(sig), nil
}

// EncodeExecuteOnBehalf encodes execute on behalf calldata.
func (c *ExecutorClient) EncodeExecuteOnBehalf(
	account types.Address,
	request ExecutionRequest,
	signature types.Hex,
) (types.Hex, error) {
	value := request.Value
	if value == nil {
		value = big.NewInt(0)
	}

	data, err := SessionKeyExecutorABI.Pack(
		"executeOnBehalf",
		ToCommonAddress(account),
		ToCommonAddress(request.Target),
		value,
		[]byte(request.Data),
		[]byte(signature),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode executeOnBehalf: %w", err)
	}

	return types.Hex(data), nil
}

// EncodeExecuteAsSessionKey encodes execute as session key calldata.
func (c *ExecutorClient) EncodeExecuteAsSessionKey(
	account types.Address,
	request ExecutionRequest,
) (types.Hex, error) {
	value := request.Value
	if value == nil {
		value = big.NewInt(0)
	}

	data, err := SessionKeyExecutorABI.Pack(
		"executeAsSessionKey",
		ToCommonAddress(account),
		ToCommonAddress(request.Target),
		value,
		[]byte(request.Data),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode executeAsSessionKey: %w", err)
	}

	return types.Hex(data), nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// ComputeExecutionHash computes the execution hash that needs to be signed.
// This matches the _getExecutionHash function in SessionKeyExecutor.sol.
func ComputeExecutionHash(
	chainId uint64,
	executorAddress types.Address,
	account types.Address,
	target types.Address,
	value *big.Int,
	data types.Hex,
	nonce *big.Int,
) types.Hash {
	if value == nil {
		value = big.NewInt(0)
	}
	if nonce == nil {
		nonce = big.NewInt(0)
	}

	// Encode packed: uint256, address, address, address, uint256, bytes, uint256
	var packed []byte

	// chainId (uint256)
	chainIdBytes := make([]byte, 32)
	new(big.Int).SetUint64(chainId).FillBytes(chainIdBytes)
	packed = append(packed, chainIdBytes...)

	// executorAddress (address - 20 bytes, left-padded to 32)
	executorBytes := make([]byte, 32)
	copy(executorBytes[12:], executorAddress[:])
	packed = append(packed, executorBytes...)

	// account (address)
	accountBytes := make([]byte, 32)
	copy(accountBytes[12:], account[:])
	packed = append(packed, accountBytes...)

	// target (address)
	targetBytes := make([]byte, 32)
	copy(targetBytes[12:], target[:])
	packed = append(packed, targetBytes...)

	// value (uint256)
	valueBytes := make([]byte, 32)
	value.FillBytes(valueBytes)
	packed = append(packed, valueBytes...)

	// data (bytes) - dynamic, just append as-is for packed encoding
	packed = append(packed, data...)

	// nonce (uint256)
	nonceBytes := make([]byte, 32)
	nonce.FillBytes(nonceBytes)
	packed = append(packed, nonceBytes...)

	hash := crypto.Keccak256Hash(packed)
	return types.Hash(hash)
}

// parseSessionKeyConfig parses the unpacked session key config tuple.
func parseSessionKeyConfig(data any) *SessionKeyConfig {
	// The data is a struct with named fields
	// We need to handle the reflection carefully
	type sessionKeyStruct struct {
		SessionKey    common.Address
		ValidAfter    uint64
		ValidUntil    uint64
		SpendingLimit *big.Int
		SpentAmount   *big.Int
		Nonce         *big.Int
		IsActive      bool
	}

	// Try to cast to the expected struct type
	if s, ok := data.(struct {
		SessionKey    common.Address
		ValidAfter    uint64
		ValidUntil    uint64
		SpendingLimit *big.Int
		SpentAmount   *big.Int
		Nonce         *big.Int
		IsActive      bool
	}); ok {
		return &SessionKeyConfig{
			SessionKey:    types.Address(s.SessionKey),
			ValidAfter:    s.ValidAfter,
			ValidUntil:    s.ValidUntil,
			SpendingLimit: s.SpendingLimit,
			SpentAmount:   s.SpentAmount,
			Nonce:         s.Nonce,
			IsActive:      s.IsActive,
		}
	}

	// Return nil if parsing fails
	return nil
}

// ============================================================================
// Session Key Generation
// ============================================================================

// GenerateSessionKey generates a new random session key.
func GenerateSessionKey() (*ecdsa.PrivateKey, types.Address, error) {
	privateKey, err := crypto.GenerateKey()
	if err != nil {
		return nil, types.Address{}, fmt.Errorf("failed to generate key: %w", err)
	}

	address := crypto.PubkeyToAddress(privateKey.PublicKey)
	return privateKey, types.Address(address), nil
}

// SessionKeyFromPrivateKey creates a session key from a private key.
func SessionKeyFromPrivateKey(privateKeyHex types.Hex) (*ecdsa.PrivateKey, types.Address, error) {
	privateKey, err := crypto.ToECDSA(privateKeyHex.Bytes())
	if err != nil {
		return nil, types.Address{}, fmt.Errorf("failed to parse private key: %w", err)
	}

	address := crypto.PubkeyToAddress(privateKey.PublicKey)
	return privateKey, types.Address(address), nil
}
