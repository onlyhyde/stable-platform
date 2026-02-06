// Package bundler provides an ERC-4337 bundler client.
package bundler

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/core/rpc"
	"github.com/stablenet/sdk-go/core/userop"
	"github.com/stablenet/sdk-go/types"
)

// DefaultPollingInterval is the default interval for polling user operation receipt.
const DefaultPollingInterval = 2 * time.Second

// DefaultTimeout is the default timeout for waiting for user operation receipt.
const DefaultTimeout = 60 * time.Second

// Client is an ERC-4337 bundler client.
type Client struct {
	rpc        *rpc.Client
	entryPoint types.Address
}

// ClientConfig configures the bundler client.
type ClientConfig struct {
	// URL is the bundler RPC endpoint URL.
	URL string

	// EntryPoint is the EntryPoint contract address.
	// Default: ERC-4337 v0.7 EntryPoint
	EntryPoint types.Address

	// Timeout is the request timeout.
	Timeout time.Duration
}

// GasEstimation contains gas estimates for a UserOperation.
type GasEstimation struct {
	PreVerificationGas            *big.Int
	VerificationGasLimit          *big.Int
	CallGasLimit                  *big.Int
	PaymasterVerificationGasLimit *big.Int
	PaymasterPostOpGasLimit       *big.Int
}

// UserOperationReceipt contains the receipt after a UserOp is executed.
type UserOperationReceipt struct {
	UserOpHash    types.Hash
	EntryPoint    types.Address
	Sender        types.Address
	Nonce         *big.Int
	Paymaster     *types.Address
	ActualGasCost *big.Int
	ActualGasUsed *big.Int
	Success       bool
	Reason        string
	Logs          []types.Log
	Receipt       *types.TransactionReceipt
}

// UserOperationWithTransaction contains a UserOperation with its transaction info.
type UserOperationWithTransaction struct {
	UserOperation   *types.UserOperation
	EntryPoint      types.Address
	TransactionHash types.Hash
	BlockHash       types.Hash
	BlockNumber     uint64
}

// NewClient creates a new bundler client.
func NewClient(config ClientConfig) *Client {
	rpcClient := rpc.NewClient(rpc.ClientConfig{
		URL:     config.URL,
		Timeout: config.Timeout,
	})

	return &Client{
		rpc:        rpcClient,
		entryPoint: config.EntryPoint,
	}
}

// SendUserOperation sends a UserOperation to the bundler.
// Returns the UserOperation hash.
func (c *Client) SendUserOperation(ctx context.Context, userOp *types.UserOperation) (types.Hash, error) {
	packed := userop.Pack(userOp)

	var result string
	err := c.rpc.Call(ctx, "eth_sendUserOperation", []interface{}{packed, c.entryPoint.Hex()}, &result)
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to send user operation: %w", err)
	}

	return common.HexToHash(result), nil
}

// EstimateUserOperationGas estimates gas for a UserOperation.
func (c *Client) EstimateUserOperationGas(ctx context.Context, userOp *types.PartialUserOperation) (*GasEstimation, error) {
	// Fill in defaults for missing fields
	fullUserOp := &types.UserOperation{
		Sender:                        userOp.Sender,
		Nonce:                         orDefault(userOp.Nonce, big.NewInt(0)),
		Factory:                       userOp.Factory,
		FactoryData:                   userOp.FactoryData,
		CallData:                      userOp.CallData,
		CallGasLimit:                  orDefault(userOp.CallGasLimit, big.NewInt(0)),
		VerificationGasLimit:          orDefault(userOp.VerificationGasLimit, big.NewInt(0)),
		PreVerificationGas:            orDefault(userOp.PreVerificationGas, big.NewInt(0)),
		MaxFeePerGas:                  orDefault(userOp.MaxFeePerGas, big.NewInt(0)),
		MaxPriorityFeePerGas:          orDefault(userOp.MaxPriorityFeePerGas, big.NewInt(0)),
		Paymaster:                     userOp.Paymaster,
		PaymasterVerificationGasLimit: userOp.PaymasterVerificationGasLimit,
		PaymasterPostOpGasLimit:       userOp.PaymasterPostOpGasLimit,
		PaymasterData:                 userOp.PaymasterData,
		Signature:                     orDefaultHex(userOp.Signature, types.Hex{}),
	}

	packed := userop.Pack(fullUserOp)

	var result struct {
		PreVerificationGas            string `json:"preVerificationGas"`
		VerificationGasLimit          string `json:"verificationGasLimit"`
		CallGasLimit                  string `json:"callGasLimit"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
	}

	err := c.rpc.Call(ctx, "eth_estimateUserOperationGas", []interface{}{packed, c.entryPoint.Hex()}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to estimate gas: %w", err)
	}

	estimation := &GasEstimation{
		PreVerificationGas:   hexToBigInt(result.PreVerificationGas),
		VerificationGasLimit: hexToBigInt(result.VerificationGasLimit),
		CallGasLimit:         hexToBigInt(result.CallGasLimit),
	}

	if result.PaymasterVerificationGasLimit != "" {
		estimation.PaymasterVerificationGasLimit = hexToBigInt(result.PaymasterVerificationGasLimit)
	}
	if result.PaymasterPostOpGasLimit != "" {
		estimation.PaymasterPostOpGasLimit = hexToBigInt(result.PaymasterPostOpGasLimit)
	}

	return estimation, nil
}

// GetUserOperationByHash gets a UserOperation by its hash.
func (c *Client) GetUserOperationByHash(ctx context.Context, hash types.Hash) (*UserOperationWithTransaction, error) {
	var result *struct {
		UserOperation   map[string]string `json:"userOperation"`
		EntryPoint      string            `json:"entryPoint"`
		TransactionHash string            `json:"transactionHash"`
		BlockHash       string            `json:"blockHash"`
		BlockNumber     string            `json:"blockNumber"`
	}

	err := c.rpc.Call(ctx, "eth_getUserOperationByHash", []interface{}{hash.Hex()}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get user operation: %w", err)
	}

	if result == nil {
		return nil, nil
	}

	userOp, err := userop.Unpack(result.UserOperation)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack user operation: %w", err)
	}

	return &UserOperationWithTransaction{
		UserOperation:   userOp,
		EntryPoint:      common.HexToAddress(result.EntryPoint),
		TransactionHash: common.HexToHash(result.TransactionHash),
		BlockHash:       common.HexToHash(result.BlockHash),
		BlockNumber:     hexToUint64(result.BlockNumber),
	}, nil
}

// GetUserOperationReceipt gets the receipt for a UserOperation.
func (c *Client) GetUserOperationReceipt(ctx context.Context, hash types.Hash) (*UserOperationReceipt, error) {
	var result *rawUserOperationReceipt

	err := c.rpc.Call(ctx, "eth_getUserOperationReceipt", []interface{}{hash.Hex()}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get user operation receipt: %w", err)
	}

	if result == nil {
		return nil, nil
	}

	return parseUserOperationReceipt(result), nil
}

// GetSupportedEntryPoints returns the supported EntryPoint addresses.
func (c *Client) GetSupportedEntryPoints(ctx context.Context) ([]types.Address, error) {
	var result []string

	err := c.rpc.Call(ctx, "eth_supportedEntryPoints", []interface{}{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get supported entry points: %w", err)
	}

	addresses := make([]types.Address, len(result))
	for i, addr := range result {
		addresses[i] = common.HexToAddress(addr)
	}

	return addresses, nil
}

// GetChainID returns the chain ID.
func (c *Client) GetChainID(ctx context.Context) (types.ChainID, error) {
	var result string

	err := c.rpc.Call(ctx, "eth_chainId", []interface{}{}, &result)
	if err != nil {
		return 0, fmt.Errorf("failed to get chain ID: %w", err)
	}

	return types.ChainID(hexToUint64(result)), nil
}

// WaitOptions configures the wait behavior for WaitForUserOperationReceipt.
type WaitOptions struct {
	// PollingInterval is the interval between polls.
	PollingInterval time.Duration

	// Timeout is the maximum time to wait.
	Timeout time.Duration
}

// WaitForUserOperationReceipt waits for a UserOperation receipt.
func (c *Client) WaitForUserOperationReceipt(ctx context.Context, hash types.Hash, opts *WaitOptions) (*UserOperationReceipt, error) {
	pollingInterval := DefaultPollingInterval
	timeout := DefaultTimeout

	if opts != nil {
		if opts.PollingInterval > 0 {
			pollingInterval = opts.PollingInterval
		}
		if opts.Timeout > 0 {
			timeout = opts.Timeout
		}
	}

	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(pollingInterval)
	defer ticker.Stop()

	for {
		receipt, err := c.GetUserOperationReceipt(ctx, hash)
		if err != nil {
			return nil, err
		}
		if receipt != nil {
			return receipt, nil
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
			if time.Now().After(deadline) {
				return nil, fmt.Errorf("timeout waiting for user operation receipt: %s", hash.Hex())
			}
		}
	}
}

// rawUserOperationReceipt is the raw receipt from the bundler.
type rawUserOperationReceipt struct {
	UserOpHash    string     `json:"userOpHash"`
	EntryPoint    string     `json:"entryPoint"`
	Sender        string     `json:"sender"`
	Nonce         string     `json:"nonce"`
	Paymaster     string     `json:"paymaster,omitempty"`
	ActualGasCost string     `json:"actualGasCost"`
	ActualGasUsed string     `json:"actualGasUsed"`
	Success       bool       `json:"success"`
	Reason        string     `json:"reason,omitempty"`
	Logs          []rawLog   `json:"logs"`
	Receipt       rawReceipt `json:"receipt"`
}

type rawLog struct {
	LogIndex         string   `json:"logIndex"`
	TransactionIndex string   `json:"transactionIndex"`
	TransactionHash  string   `json:"transactionHash"`
	BlockHash        string   `json:"blockHash"`
	BlockNumber      string   `json:"blockNumber"`
	Address          string   `json:"address"`
	Data             string   `json:"data"`
	Topics           []string `json:"topics"`
}

type rawReceipt struct {
	TransactionHash   string   `json:"transactionHash"`
	TransactionIndex  string   `json:"transactionIndex"`
	BlockHash         string   `json:"blockHash"`
	BlockNumber       string   `json:"blockNumber"`
	From              string   `json:"from"`
	To                string   `json:"to,omitempty"`
	CumulativeGasUsed string   `json:"cumulativeGasUsed"`
	GasUsed           string   `json:"gasUsed"`
	Logs              []rawLog `json:"logs"`
	Status            string   `json:"status"`
	EffectiveGasPrice string   `json:"effectiveGasPrice"`
}

func parseUserOperationReceipt(raw *rawUserOperationReceipt) *UserOperationReceipt {
	receipt := &UserOperationReceipt{
		UserOpHash:    common.HexToHash(raw.UserOpHash),
		EntryPoint:    common.HexToAddress(raw.EntryPoint),
		Sender:        common.HexToAddress(raw.Sender),
		Nonce:         hexToBigInt(raw.Nonce),
		ActualGasCost: hexToBigInt(raw.ActualGasCost),
		ActualGasUsed: hexToBigInt(raw.ActualGasUsed),
		Success:       raw.Success,
		Reason:        raw.Reason,
	}

	if raw.Paymaster != "" && raw.Paymaster != "0x" {
		paymaster := common.HexToAddress(raw.Paymaster)
		receipt.Paymaster = &paymaster
	}

	receipt.Logs = parseLogs(raw.Logs)
	receipt.Receipt = parseTransactionReceipt(&raw.Receipt)

	return receipt
}

func parseLogs(rawLogs []rawLog) []types.Log {
	logs := make([]types.Log, len(rawLogs))
	for i, raw := range rawLogs {
		topics := make([]types.Hash, len(raw.Topics))
		for j, t := range raw.Topics {
			topics[j] = common.HexToHash(t)
		}

		data, _ := types.HexFromString(raw.Data)

		logs[i] = types.Log{
			Address:          common.HexToAddress(raw.Address),
			Topics:           topics,
			Data:             data,
			BlockNumber:      hexToUint64(raw.BlockNumber),
			TransactionHash:  common.HexToHash(raw.TransactionHash),
			TransactionIndex: uint(hexToUint64(raw.TransactionIndex)),
			BlockHash:        common.HexToHash(raw.BlockHash),
			LogIndex:         uint(hexToUint64(raw.LogIndex)),
			Removed:          false,
		}
	}
	return logs
}

func parseTransactionReceipt(raw *rawReceipt) *types.TransactionReceipt {
	receipt := &types.TransactionReceipt{
		TransactionHash:   common.HexToHash(raw.TransactionHash),
		TransactionIndex:  hexToUint64(raw.TransactionIndex),
		BlockHash:         common.HexToHash(raw.BlockHash),
		BlockNumber:       hexToUint64(raw.BlockNumber),
		From:              common.HexToAddress(raw.From),
		CumulativeGasUsed: hexToBigInt(raw.CumulativeGasUsed),
		GasUsed:           hexToBigInt(raw.GasUsed),
		EffectiveGasPrice: hexToBigInt(raw.EffectiveGasPrice),
		Logs:              parseLogs(raw.Logs),
	}

	if raw.To != "" && raw.To != "0x" {
		to := common.HexToAddress(raw.To)
		receipt.To = &to
	}

	if raw.Status == "0x1" {
		receipt.Status = 1
	} else {
		receipt.Status = 0
	}

	return receipt
}

func orDefault(v *big.Int, def *big.Int) *big.Int {
	if v != nil {
		return v
	}
	return def
}

func orDefaultHex(v types.Hex, def types.Hex) types.Hex {
	if len(v) > 0 {
		return v
	}
	return def
}

func hexToBigInt(s string) *big.Int {
	if s == "" || s == "0x" {
		return big.NewInt(0)
	}
	n, _ := new(big.Int).SetString(s[2:], 16)
	if n == nil {
		return big.NewInt(0)
	}
	return n
}

func hexToUint64(s string) uint64 {
	return hexToBigInt(s).Uint64()
}
