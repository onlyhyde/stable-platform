// Package strategies provides transaction execution strategies for different modes.
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

// EOAStrategyConfig contains configuration for the EOA strategy.
type EOAStrategyConfig struct {
	// RpcUrl is the RPC URL.
	RpcUrl string
	// ChainId is the chain ID.
	ChainId uint64
}

// EOAStrategy implements transaction.Strategy for EOA transactions.
type EOAStrategy struct {
	config EOAStrategyConfig
	client *ethclient.Client
}

// NewEOAStrategy creates a new EOA strategy.
func NewEOAStrategy(cfg EOAStrategyConfig) (*EOAStrategy, error) {
	client, err := ethclient.Dial(cfg.RpcUrl)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	return &EOAStrategy{
		config: cfg,
		client: client,
	}, nil
}

// Mode returns the transaction mode.
func (s *EOAStrategy) Mode() sdktypes.TransactionMode {
	return sdktypes.TransactionModeEOA
}

// Supports checks if this strategy supports the given account.
func (s *EOAStrategy) Supports(account transaction.Account) bool {
	// EOA strategy supports non-smart accounts and non-delegated accounts
	return !account.IsSmartAccount() && !account.IsDelegated()
}

// Validate validates the request for this mode.
func (s *EOAStrategy) Validate(request *sdktypes.MultiModeTransactionRequest, account transaction.Account) error {
	if request.Mode != sdktypes.TransactionModeEOA {
		return fmt.Errorf("EOA strategy only handles EOA mode")
	}

	if request.From != account.Address() {
		return fmt.Errorf("request from address does not match account address")
	}

	// EOA does not support authorization lists
	if len(request.AuthorizationList) > 0 {
		return fmt.Errorf("EOA mode does not support authorization list")
	}

	return nil
}

// Prepare prepares a transaction for execution.
func (s *EOAStrategy) Prepare(ctx context.Context, request *sdktypes.MultiModeTransactionRequest, account transaction.Account) (*transaction.PreparedTransaction, error) {
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
	strategyData := &EOATransactionData{
		Nonce:   *nonce,
		ChainId: s.config.ChainId,
	}

	return &transaction.PreparedTransaction{
		Mode:         sdktypes.TransactionModeEOA,
		Request:      request,
		GasEstimate:  gasEstimate,
		StrategyData: strategyData,
	}, nil
}

// Execute executes a prepared transaction.
func (s *EOAStrategy) Execute(ctx context.Context, prepared *transaction.PreparedTransaction, signer transaction.Signer, options *transaction.ExecuteOptions) (*sdktypes.TransactionResult, error) {
	strategyData, ok := prepared.StrategyData.(*EOATransactionData)
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

	// Sign the transaction
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
		Mode:      sdktypes.TransactionModeEOA,
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
func (s *EOAStrategy) WaitForConfirmation(ctx context.Context, hash sdktypes.Hash, confirmations uint64, timeout time.Duration) error {
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
func (s *EOAStrategy) getGasPrices(ctx context.Context) (*gas.GasPriceInfo, error) {
	// Get the latest block for base fee
	header, err := s.client.HeaderByNumber(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest block: %w", err)
	}

	baseFee := header.BaseFee
	if baseFee == nil {
		baseFee = sdkconfig.GasPriceConfig.DefaultMaxFeePerGas
	}

	// Get suggested gas price for legacy compatibility
	gasPrice, err := s.client.SuggestGasPrice(ctx)
	if err != nil {
		gasPrice = sdkconfig.GasPriceConfig.DefaultMaxFeePerGas
	}

	// Get suggested priority fee
	priorityFee, err := s.client.SuggestGasTipCap(ctx)
	if err != nil {
		priorityFee = sdkconfig.GasPriceConfig.DefaultMaxPriorityFeePerGas
	}

	// Calculate max fee per gas (2 * baseFee + priorityFee)
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
func (s *EOAStrategy) estimateGas(ctx context.Context, request *sdktypes.MultiModeTransactionRequest, gasPrices *gas.GasPriceInfo) (*sdktypes.GasEstimate, error) {
	// Estimate gas using eth_estimateGas
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

// EOATransactionData contains EOA-specific transaction data.
type EOATransactionData struct {
	Nonce   uint64
	ChainId uint64
}

// decodeRawTransaction decodes signed transaction bytes using RLP decoding.
func decodeRawTransaction(raw sdktypes.Hex) (*types.Transaction, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("empty transaction bytes")
	}
	tx := new(types.Transaction)
	if err := tx.UnmarshalBinary(raw.Bytes()); err != nil {
		return nil, fmt.Errorf("failed to decode transaction: %w", err)
	}
	return tx, nil
}
