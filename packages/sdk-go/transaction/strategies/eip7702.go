package strategies

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"

	sdkconfig "github.com/stablenet/sdk-go/config"
	"github.com/stablenet/sdk-go/gas"
	"github.com/stablenet/sdk-go/transaction"
	sdktypes "github.com/stablenet/sdk-go/types"
)

// EIP7702StrategyConfig contains configuration for the EIP-7702 strategy.
type EIP7702StrategyConfig struct {
	// RpcUrl is the RPC URL.
	RpcUrl string
	// ChainId is the chain ID.
	ChainId uint64
	// DefaultDelegateAddress is the default delegate contract address.
	DefaultDelegateAddress *sdktypes.Address
}

// EIP7702Strategy implements transaction.Strategy for EIP-7702 transactions.
type EIP7702Strategy struct {
	config EIP7702StrategyConfig
	client *ethclient.Client
}

// NewEIP7702Strategy creates a new EIP-7702 strategy.
func NewEIP7702Strategy(cfg EIP7702StrategyConfig) (*EIP7702Strategy, error) {
	client, err := ethclient.Dial(cfg.RpcUrl)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	return &EIP7702Strategy{
		config: cfg,
		client: client,
	}, nil
}

// Mode returns the transaction mode.
func (s *EIP7702Strategy) Mode() sdktypes.TransactionMode {
	return sdktypes.TransactionModeEIP7702
}

// Supports checks if this strategy supports the given account.
func (s *EIP7702Strategy) Supports(account transaction.Account) bool {
	// EIP-7702 strategy supports non-smart accounts (EOAs) including delegated ones
	return !account.IsSmartAccount()
}

// Validate validates the request for this mode.
func (s *EIP7702Strategy) Validate(request *sdktypes.MultiModeTransactionRequest, account transaction.Account) error {
	if request.Mode != sdktypes.TransactionModeEIP7702 {
		return fmt.Errorf("EIP7702 strategy only handles EIP7702 mode")
	}

	if request.From != account.Address() {
		return fmt.Errorf("request from address does not match account address")
	}

	// EIP-7702 requires authorization list
	if len(request.AuthorizationList) == 0 {
		return fmt.Errorf("EIP-7702 mode requires at least one authorization")
	}

	// Validate each authorization
	for i, auth := range request.AuthorizationList {
		if auth.Address == (sdktypes.Address{}) {
			return fmt.Errorf("authorization %d has empty address", i)
		}
		if auth.ChainId != s.config.ChainId {
			return fmt.Errorf("authorization %d has invalid chain ID", i)
		}
	}

	return nil
}

// Prepare prepares a transaction for execution.
func (s *EIP7702Strategy) Prepare(ctx context.Context, request *sdktypes.MultiModeTransactionRequest, account transaction.Account) (*transaction.PreparedTransaction, error) {
	// Get nonce if not provided
	nonce := request.Nonce
	if nonce == nil {
		n, err := s.client.PendingNonceAt(ctx, common.Address(request.From))
		if err != nil {
			return nil, fmt.Errorf("failed to get nonce: %w", err)
		}
		nonce = &n
	}

	// Get gas prices
	gasPrices, err := s.getGasPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas prices: %w", err)
	}

	// Estimate gas
	gasEstimate, err := s.estimateGas(ctx, request, gasPrices)
	if err != nil {
		return nil, fmt.Errorf("failed to estimate gas: %w", err)
	}

	// Store strategy-specific data
	strategyData := &EIP7702TransactionData{
		Nonce:             *nonce,
		ChainId:           s.config.ChainId,
		AuthorizationList: request.AuthorizationList,
	}

	return &transaction.PreparedTransaction{
		Mode:         sdktypes.TransactionModeEIP7702,
		Request:      request,
		GasEstimate:  gasEstimate,
		StrategyData: strategyData,
	}, nil
}

// Execute executes a prepared transaction.
func (s *EIP7702Strategy) Execute(ctx context.Context, prepared *transaction.PreparedTransaction, signer transaction.Signer, options *transaction.ExecuteOptions) (*sdktypes.TransactionResult, error) {
	strategyData, ok := prepared.StrategyData.(*EIP7702TransactionData)
	if !ok {
		return nil, fmt.Errorf("invalid strategy data")
	}

	// Update request with gas estimate values
	request := *prepared.Request
	request.Nonce = &strategyData.Nonce
	request.MaxFeePerGas = prepared.GasEstimate.MaxFeePerGas
	request.MaxPriorityFeePerGas = prepared.GasEstimate.MaxPriorityFeePerGas
	request.Gas = prepared.GasEstimate.GasLimit
	chainId := s.config.ChainId
	request.ChainId = &chainId
	request.AuthorizationList = strategyData.AuthorizationList

	// Sign the transaction (includes authorization signing)
	signedTx, err := signer.SignTransaction(ctx, &request)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Decode the signed transaction bytes
	decodedTx, err := decodeRawTransaction(signedTx)
	if err != nil {
		return nil, fmt.Errorf("failed to decode signed transaction: %w", err)
	}

	// Send the raw transaction
	err = s.client.SendTransaction(ctx, decodedTx)
	if err != nil {
		return nil, fmt.Errorf("failed to send transaction: %w", err)
	}

	// Get the transaction hash from the decoded transaction
	txHash := decodedTx.Hash()

	result := &sdktypes.TransactionResult{
		Hash:      sdktypes.Hash(txHash),
		Mode:      sdktypes.TransactionModeEIP7702,
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

// WaitForConfirmation waits for transaction confirmation.
func (s *EIP7702Strategy) WaitForConfirmation(ctx context.Context, hash sdktypes.Hash, confirmations uint64, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	txHash := common.Hash(hash)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if time.Now().After(deadline) {
				return fmt.Errorf("timeout waiting for confirmation")
			}

			receipt, err := s.client.TransactionReceipt(ctx, txHash)
			if err != nil {
				continue // Receipt not yet available
			}

			// Check confirmations
			currentBlock, err := s.client.BlockNumber(ctx)
			if err != nil {
				continue
			}

			if currentBlock >= receipt.BlockNumber.Uint64()+confirmations {
				if receipt.Status == types.ReceiptStatusFailed {
					return fmt.Errorf("transaction reverted")
				}
				return nil
			}
		}
	}
}

// getGasPrices gets current gas prices from the network.
func (s *EIP7702Strategy) getGasPrices(ctx context.Context) (*gas.GasPriceInfo, error) {
	header, err := s.client.HeaderByNumber(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest block: %w", err)
	}

	baseFee := header.BaseFee
	if baseFee == nil {
		baseFee = sdkconfig.GasPriceConfig.DefaultMaxFeePerGas
	}

	gasPrice, err := s.client.SuggestGasPrice(ctx)
	if err != nil {
		gasPrice = sdkconfig.GasPriceConfig.DefaultMaxFeePerGas
	}

	priorityFee, err := s.client.SuggestGasTipCap(ctx)
	if err != nil {
		priorityFee = sdkconfig.GasPriceConfig.DefaultMaxPriorityFeePerGas
	}

	maxFee := new(big.Int).Mul(baseFee, big.NewInt(2))
	maxFee.Add(maxFee, priorityFee)

	return &gas.GasPriceInfo{
		BaseFee:              baseFee,
		MaxPriorityFeePerGas: priorityFee,
		MaxFeePerGas:         maxFee,
		GasPrice:             gasPrice,
	}, nil
}

// estimateGas estimates gas for the transaction.
func (s *EIP7702Strategy) estimateGas(ctx context.Context, request *sdktypes.MultiModeTransactionRequest, gasPrices *gas.GasPriceInfo) (*sdktypes.GasEstimate, error) {
	// Base estimate from eth_estimateGas
	to := common.Address(request.To)
	msg := ethereum.CallMsg{
		From:  common.Address(request.From),
		To:    &to,
		Value: request.Value,
		Data:  request.Data.Bytes(),
	}

	gasLimit, err := s.client.EstimateGas(ctx, msg)
	if err != nil {
		// Fall back to calculated estimate
		gasLimit = sdkconfig.GasConfig.BaseTransferGas.Uint64()
		if len(request.Data) > 0 {
			calldataGas := sdkconfig.CalculateCalldataGas(request.Data.Bytes())
			gasLimit += calldataGas.Uint64()
		}
	}

	// Add EIP-7702 specific gas
	// Add delegation setup gas
	delegationGas := sdkconfig.GasConfig.EIP7702DelegationGas.Uint64()
	gasLimit += delegationGas

	// Add gas per authorization
	numAuthorizations := len(request.AuthorizationList)
	if numAuthorizations > 0 {
		authGas := sdkconfig.CalculateEIP7702Gas(numAuthorizations)
		gasLimit += authGas.Uint64()
	}

	// Apply buffer
	gasLimitBig := big.NewInt(int64(gasLimit))
	gasLimitBig = sdkconfig.ApplyGasBuffer(gasLimitBig)

	// Calculate estimated cost
	estimatedCost := new(big.Int).Mul(gasLimitBig, gasPrices.MaxFeePerGas)

	return &sdktypes.GasEstimate{
		GasLimit:             gasLimitBig,
		MaxFeePerGas:         gasPrices.MaxFeePerGas,
		MaxPriorityFeePerGas: gasPrices.MaxPriorityFeePerGas,
		EstimatedCost:        estimatedCost,
	}, nil
}

// EIP7702TransactionData contains EIP-7702-specific transaction data.
type EIP7702TransactionData struct {
	Nonce             uint64
	ChainId           uint64
	AuthorizationList []sdktypes.EIP7702SignedAuthorization
}

// CreateAuthorization creates an unsigned authorization for signing.
func CreateAuthorization(chainId uint64, delegateAddress sdktypes.Address, nonce uint64) *sdktypes.EIP7702SignedAuthorization {
	return &sdktypes.EIP7702SignedAuthorization{
		ChainId: chainId,
		Address: delegateAddress,
		Nonce:   nonce,
	}
}
