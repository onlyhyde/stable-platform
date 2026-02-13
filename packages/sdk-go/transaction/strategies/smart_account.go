package strategies

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/accounts"
	"github.com/stablenet/sdk-go/accounts/kernel"
	"github.com/stablenet/sdk-go/clients"
	"github.com/stablenet/sdk-go/core/bundler"
	sdkconfig "github.com/stablenet/sdk-go/config"
	"github.com/stablenet/sdk-go/core/rpc"
	"github.com/stablenet/sdk-go/transaction"
	sdktypes "github.com/stablenet/sdk-go/types"
)

// Default EntryPoint address (ERC-4337 v0.7)
var DefaultEntryPoint = common.HexToAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032")

// SmartAccountStrategyConfig contains configuration for the Smart Account strategy.
type SmartAccountStrategyConfig struct {
	// RpcUrl is the RPC URL for the Ethereum node.
	RpcUrl string
	// ChainId is the chain ID.
	ChainId uint64
	// BundlerUrl is the ERC-4337 bundler URL.
	BundlerUrl string
	// PaymasterUrl is the optional paymaster URL.
	PaymasterUrl string
	// EntryPointAddress is the entry point address.
	EntryPointAddress *sdktypes.Address
}

// SmartAccountStrategy implements transaction.Strategy for Smart Account (ERC-4337) transactions.
type SmartAccountStrategy struct {
	config          SmartAccountStrategyConfig
	bundlerClient   *bundler.Client
	paymasterClient *rpc.Client // nil if paymaster URL not configured
	entryPoint      sdktypes.Address
}

// NewSmartAccountStrategy creates a new Smart Account strategy.
func NewSmartAccountStrategy(cfg SmartAccountStrategyConfig) (*SmartAccountStrategy, error) {
	entryPoint := sdktypes.Address(DefaultEntryPoint)
	if cfg.EntryPointAddress != nil {
		entryPoint = *cfg.EntryPointAddress
	}

	bundlerClient := bundler.NewClient(bundler.ClientConfig{
		URL:        cfg.BundlerUrl,
		EntryPoint: entryPoint,
		Timeout:    30 * time.Second,
	})

	var paymasterClient *rpc.Client
	if cfg.PaymasterUrl != "" {
		paymasterClient = rpc.NewClient(rpc.ClientConfig{
			URL:     cfg.PaymasterUrl,
			Timeout: 15 * time.Second,
		})
	}

	return &SmartAccountStrategy{
		config:          cfg,
		bundlerClient:   bundlerClient,
		paymasterClient: paymasterClient,
		entryPoint:      entryPoint,
	}, nil
}

// Mode returns the transaction mode.
func (s *SmartAccountStrategy) Mode() sdktypes.TransactionMode {
	return sdktypes.TransactionModeSmartAccount
}

// Supports checks if this strategy supports the given account.
func (s *SmartAccountStrategy) Supports(account transaction.Account) bool {
	// Smart Account strategy supports deployed smart accounts
	return account.IsSmartAccount()
}

// Validate validates the request for this mode.
func (s *SmartAccountStrategy) Validate(request *sdktypes.MultiModeTransactionRequest, account transaction.Account) error {
	if request.Mode != sdktypes.TransactionModeSmartAccount {
		return fmt.Errorf("SmartAccount strategy only handles SmartAccount mode")
	}

	if request.From != account.Address() {
		return fmt.Errorf("request from address does not match account address")
	}

	if request.To == (sdktypes.Address{}) {
		return fmt.Errorf("to address is required")
	}

	// Check for paymaster requirement
	if request.GasPayment != nil {
		if request.GasPayment.Type == sdktypes.GasPaymentTypeSponsor ||
			request.GasPayment.Type == sdktypes.GasPaymentTypeERC20 {
			if s.config.PaymasterUrl == "" {
				return fmt.Errorf("paymaster URL is required for sponsored or ERC20 gas payment")
			}
		}
	}

	return nil
}

// Prepare prepares a transaction for execution.
func (s *SmartAccountStrategy) Prepare(ctx context.Context, request *sdktypes.MultiModeTransactionRequest, account transaction.Account) (*transaction.PreparedTransaction, error) {
	// Encode calldata for Smart Account
	callData := encodeSmartAccountCall(request.To, request.Value, request.Data)

	// Build partial UserOp for estimation
	partialUserOp := &sdktypes.PartialUserOperation{
		Sender:   request.From,
		Nonce:    big.NewInt(0), // Will be fetched properly in production
		CallData: callData,
	}

	// Estimate gas via bundler
	gasEstimation, err := s.bundlerClient.EstimateUserOperationGas(ctx, partialUserOp)
	if err != nil {
		// Fall back to defaults
		gasEstimation = &bundler.GasEstimation{
			PreVerificationGas:   sdkconfig.GasConfig.DefaultPreVerificationGas,
			VerificationGasLimit: sdkconfig.GasConfig.DefaultVerificationGasLimit,
			CallGasLimit:         sdkconfig.GasConfig.DefaultCallGasLimit,
		}
	}

	// Get max fee per gas
	maxFeePerGas := request.MaxFeePerGas
	if maxFeePerGas == nil {
		maxFeePerGas = sdkconfig.GasPriceConfig.DefaultMaxFeePerGas
	}

	maxPriorityFeePerGas := request.MaxPriorityFeePerGas
	if maxPriorityFeePerGas == nil {
		maxPriorityFeePerGas = sdkconfig.GasPriceConfig.DefaultMaxPriorityFeePerGas
	}

	// Store strategy-specific data
	strategyData := &SmartAccountTransactionData{
		ChainId:  s.config.ChainId,
		CallData: callData,
		GasEstimation: &SmartAccountGasEstimation{
			PreVerificationGas:   gasEstimation.PreVerificationGas,
			VerificationGasLimit: gasEstimation.VerificationGasLimit,
			CallGasLimit:         gasEstimation.CallGasLimit,
		},
	}

	// Add paymaster data if needed
	if request.GasPayment != nil && s.config.PaymasterUrl != "" {
		paymasterData, err := s.getPaymasterData(ctx, partialUserOp, request.GasPayment)
		if err == nil && paymasterData != nil {
			strategyData.PaymasterData = paymasterData
		}
	}

	// Calculate total gas limit
	totalGasLimit := new(big.Int).Add(gasEstimation.CallGasLimit, gasEstimation.VerificationGasLimit)
	totalGasLimit.Add(totalGasLimit, gasEstimation.PreVerificationGas)

	// Add paymaster gas if applicable
	if strategyData.PaymasterData != nil {
		if strategyData.PaymasterData.PaymasterVerificationGasLimit != nil {
			totalGasLimit.Add(totalGasLimit, strategyData.PaymasterData.PaymasterVerificationGasLimit)
		}
		if strategyData.PaymasterData.PaymasterPostOpGasLimit != nil {
			totalGasLimit.Add(totalGasLimit, strategyData.PaymasterData.PaymasterPostOpGasLimit)
		}
	}

	// Calculate estimated cost
	estimatedCost := new(big.Int).Mul(totalGasLimit, maxFeePerGas)

	gasEstimate := &sdktypes.GasEstimate{
		GasLimit:             totalGasLimit,
		MaxFeePerGas:         maxFeePerGas,
		MaxPriorityFeePerGas: maxPriorityFeePerGas,
		EstimatedCost:        estimatedCost,
		PreVerificationGas:   gasEstimation.PreVerificationGas,
		VerificationGasLimit: gasEstimation.VerificationGasLimit,
		CallGasLimit:         gasEstimation.CallGasLimit,
	}

	return &transaction.PreparedTransaction{
		Mode:         sdktypes.TransactionModeSmartAccount,
		Request:      request,
		GasEstimate:  gasEstimate,
		StrategyData: strategyData,
	}, nil
}

// Execute executes a prepared transaction.
func (s *SmartAccountStrategy) Execute(ctx context.Context, prepared *transaction.PreparedTransaction, signer transaction.Signer, options *transaction.ExecuteOptions) (*sdktypes.TransactionResult, error) {
	strategyData, ok := prepared.StrategyData.(*SmartAccountTransactionData)
	if !ok {
		return nil, fmt.Errorf("invalid strategy data")
	}

	// Build full UserOperation
	userOp := &sdktypes.UserOperation{
		Sender:               prepared.Request.From,
		Nonce:                big.NewInt(0), // Should be fetched from entry point
		CallData:             strategyData.CallData,
		CallGasLimit:         strategyData.GasEstimation.CallGasLimit,
		VerificationGasLimit: strategyData.GasEstimation.VerificationGasLimit,
		PreVerificationGas:   strategyData.GasEstimation.PreVerificationGas,
		MaxFeePerGas:         prepared.GasEstimate.MaxFeePerGas,
		MaxPriorityFeePerGas: prepared.GasEstimate.MaxPriorityFeePerGas,
		Signature:            sdktypes.Hex{}, // Placeholder
	}

	// Add paymaster data if available
	if strategyData.PaymasterData != nil {
		userOp.Paymaster = strategyData.PaymasterData.Paymaster
		userOp.PaymasterData = strategyData.PaymasterData.PaymasterData
		userOp.PaymasterVerificationGasLimit = strategyData.PaymasterData.PaymasterVerificationGasLimit
		userOp.PaymasterPostOpGasLimit = strategyData.PaymasterData.PaymasterPostOpGasLimit
	}

	// Calculate UserOp hash and sign
	userOpHash := calculateUserOpHash(userOp, s.entryPoint, s.config.ChainId)
	signature, err := signer.SignUserOperation(ctx, userOpHash)
	if err != nil {
		return nil, fmt.Errorf("failed to sign user operation: %w", err)
	}
	userOp.Signature = signature

	// Send via bundler
	hash, err := s.bundlerClient.SendUserOperation(ctx, userOp)
	if err != nil {
		return nil, fmt.Errorf("failed to send user operation: %w", err)
	}

	result := &sdktypes.TransactionResult{
		Hash:      hash,
		Mode:      sdktypes.TransactionModeSmartAccount,
		ChainId:   s.config.ChainId,
		Timestamp: time.Now().Unix(),
	}

	// Wait for confirmation if requested
	if options != nil && options.WaitForConfirmation {
		if err := s.WaitForConfirmation(ctx, result.Hash, options.Confirmations, options.Timeout); err != nil {
			return nil, fmt.Errorf("failed to wait for confirmation: %w", err)
		}
	}

	return result, nil
}

// WaitForConfirmation waits for UserOperation confirmation.
func (s *SmartAccountStrategy) WaitForConfirmation(ctx context.Context, hash sdktypes.Hash, confirmations uint64, timeout time.Duration) error {
	receipt, err := s.bundlerClient.WaitForUserOperationReceipt(ctx, hash, &bundler.WaitOptions{
		PollingInterval: 2 * time.Second,
		Timeout:         timeout,
	})
	if err != nil {
		return err
	}

	if !receipt.Success {
		if receipt.Reason != "" {
			return fmt.Errorf("user operation failed: %s", receipt.Reason)
		}
		return fmt.Errorf("user operation failed")
	}

	return nil
}

// getPaymasterData gets paymaster data for the UserOperation by calling the paymaster proxy service.
func (s *SmartAccountStrategy) getPaymasterData(ctx context.Context, userOp *sdktypes.PartialUserOperation, gasPayment *sdktypes.GasPaymentConfig) (*PaymasterData, error) {
	if s.paymasterClient == nil {
		return nil, nil
	}

	// Build the UserOp map for the JSON-RPC request
	userOpMap := map[string]interface{}{
		"sender":   userOp.Sender.Hex(),
		"nonce":    fmt.Sprintf("0x%x", userOp.Nonce),
		"callData": fmt.Sprintf("0x%x", userOp.CallData),
	}

	// Call pm_getPaymasterStubData: params = [userOp, entryPoint, chainId]
	chainIdHex := fmt.Sprintf("0x%x", s.config.ChainId)
	params := []interface{}{userOpMap, s.entryPoint.Hex(), chainIdHex}

	var result struct {
		Paymaster                     string `json:"paymaster"`
		PaymasterData                 string `json:"paymasterData"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
	}

	err := s.paymasterClient.Call(ctx, "pm_getPaymasterStubData", params, &result)
	if err != nil {
		return nil, fmt.Errorf("paymaster request failed: %w", err)
	}

	if result.Paymaster == "" {
		return nil, nil
	}

	paymasterAddr := sdktypes.Address(common.HexToAddress(result.Paymaster))
	paymasterData, _ := sdktypes.HexFromString(result.PaymasterData)

	pd := &PaymasterData{
		Paymaster:     &paymasterAddr,
		PaymasterData: paymasterData,
	}

	if result.PaymasterVerificationGasLimit != "" {
		v, ok := new(big.Int).SetString(result.PaymasterVerificationGasLimit[2:], 16)
		if ok {
			pd.PaymasterVerificationGasLimit = v
		}
	}
	if result.PaymasterPostOpGasLimit != "" {
		v, ok := new(big.Int).SetString(result.PaymasterPostOpGasLimit[2:], 16)
		if ok {
			pd.PaymasterPostOpGasLimit = v
		}
	}

	return pd, nil
}

// SmartAccountTransactionData contains Smart Account-specific transaction data.
type SmartAccountTransactionData struct {
	ChainId       uint64
	CallData      sdktypes.Hex
	GasEstimation *SmartAccountGasEstimation
	PaymasterData *PaymasterData
}

// SmartAccountGasEstimation contains Smart Account gas estimation data.
type SmartAccountGasEstimation struct {
	PreVerificationGas   *big.Int
	VerificationGasLimit *big.Int
	CallGasLimit         *big.Int
}

// PaymasterData contains paymaster response data.
type PaymasterData struct {
	Paymaster                     *sdktypes.Address
	PaymasterData                 sdktypes.Hex
	PaymasterVerificationGasLimit *big.Int
	PaymasterPostOpGasLimit       *big.Int
}

// ============================================================================
// Helper Functions
// ============================================================================

// encodeSmartAccountCall encodes a call for Smart Account execute function
// using the Kernel account's execute(bytes32 mode, bytes executionCalldata) format.
func encodeSmartAccountCall(to sdktypes.Address, value *big.Int, data sdktypes.Hex) sdktypes.Hex {
	if value == nil {
		value = big.NewInt(0)
	}

	call := accounts.Call{
		To:    to,
		Value: sdktypes.BigInt{Int: value},
		Data:  data,
	}

	encoded, err := kernel.EncodeKernelExecuteCallData([]accounts.Call{call})
	if err != nil {
		// Fallback to raw data on encoding failure
		return data
	}
	return encoded
}

// calculateUserOpHash calculates the hash of a UserOperation using the
// fully implemented GetUserOperationHash from the clients package.
func calculateUserOpHash(userOp *sdktypes.UserOperation, entryPoint sdktypes.Address, chainId uint64) sdktypes.Hash {
	return clients.GetUserOperationHash(userOp, entryPoint, chainId)
}
