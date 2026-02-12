// Package clients provides high-level client implementations for smart account operations.
package clients

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/core/bundler"
	"github.com/stablenet/sdk-go/core/paymaster"
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Smart Account Interface
// ============================================================================

// SmartAccount represents a smart account that can sign and send UserOperations.
type SmartAccount interface {
	// Address returns the account address.
	Address() types.Address

	// EntryPoint returns the entry point address.
	EntryPoint() types.Address

	// GetNonce returns the current nonce.
	GetNonce(ctx context.Context) (*big.Int, error)

	// IsDeployed checks if the account is deployed.
	IsDeployed(ctx context.Context) (bool, error)

	// GetFactory returns the factory address (for undeployed accounts).
	GetFactory() *types.Address

	// GetFactoryData returns the factory init data (for undeployed accounts).
	GetFactoryData() types.Hex

	// EncodeCallData encodes calls into calldata.
	EncodeCallData(calls []Call) (types.Hex, error)

	// SignUserOperation signs a user operation hash.
	SignUserOperation(ctx context.Context, userOpHash types.Hash) (types.Hex, error)
}

// Call represents a single call in a UserOperation.
type Call struct {
	// To is the target address.
	To types.Address `json:"to"`

	// Value is the ETH value to send.
	Value *big.Int `json:"value,omitempty"`

	// Data is the calldata.
	Data types.Hex `json:"data,omitempty"`
}

// ============================================================================
// Smart Account Client
// ============================================================================

// SmartAccountClient provides methods for sending UserOperations.
type SmartAccountClient struct {
	// Account is the smart account.
	Account SmartAccount

	// ChainId is the chain ID.
	ChainId uint64

	// BundlerClient is the bundler client.
	BundlerClient *bundler.Client

	// PaymasterClient is the optional default paymaster.
	PaymasterClient *paymaster.Client

	// RpcUrl is the RPC URL for gas price queries.
	RpcUrl string

	// rpcClient is the ethclient for RPC queries (nil if connection failed).
	rpcClient *ethclient.Client
}

// SmartAccountClientConfig configures a SmartAccountClient.
type SmartAccountClientConfig struct {
	// Account is the smart account.
	Account SmartAccount

	// ChainId is the chain ID.
	ChainId uint64

	// BundlerUrl is the bundler URL.
	BundlerUrl string

	// PaymasterUrl is the optional paymaster URL.
	PaymasterUrl string

	// RpcUrl is the RPC URL.
	RpcUrl string

	// EntryPoint is the entry point address (optional, uses account's entry point if not set).
	EntryPoint *types.Address
}

// NewSmartAccountClient creates a new SmartAccountClient.
func NewSmartAccountClient(config SmartAccountClientConfig) (*SmartAccountClient, error) {
	if config.Account == nil {
		return nil, fmt.Errorf("account is required")
	}

	if config.BundlerUrl == "" {
		return nil, fmt.Errorf("bundler URL is required")
	}

	entryPoint := config.Account.EntryPoint()
	if config.EntryPoint != nil {
		entryPoint = *config.EntryPoint
	}

	// Create bundler client
	bundlerClient := bundler.NewClient(bundler.ClientConfig{
		URL:        config.BundlerUrl,
		EntryPoint: entryPoint,
	})

	// Create paymaster client if URL provided
	var paymasterClient *paymaster.Client
	if config.PaymasterUrl != "" {
		paymasterClient = paymaster.NewClient(paymaster.ClientConfig{
			URL:     config.PaymasterUrl,
			ChainID: types.ChainID(config.ChainId),
		})
	}

	// Try to connect to RPC for live gas prices (fallback to defaults if unavailable)
	var rpcClient *ethclient.Client
	if config.RpcUrl != "" {
		client, err := ethclient.Dial(config.RpcUrl)
		if err == nil {
			rpcClient = client
		}
	}

	return &SmartAccountClient{
		Account:         config.Account,
		ChainId:         config.ChainId,
		BundlerClient:   bundlerClient,
		PaymasterClient: paymasterClient,
		RpcUrl:          config.RpcUrl,
		rpcClient:       rpcClient,
	}, nil
}

// ============================================================================
// Client Methods
// ============================================================================

// GetAddress returns the account address.
func (c *SmartAccountClient) GetAddress() types.Address {
	return c.Account.Address()
}

// GetNonce returns the current nonce.
func (c *SmartAccountClient) GetNonce(ctx context.Context) (*big.Int, error) {
	return c.Account.GetNonce(ctx)
}

// IsDeployed checks if the account is deployed.
func (c *SmartAccountClient) IsDeployed(ctx context.Context) (bool, error) {
	return c.Account.IsDeployed(ctx)
}

// SendUserOperationArgs contains arguments for sending a UserOperation.
type SendUserOperationArgs struct {
	// Calls is the list of calls to execute.
	Calls []Call

	// Paymaster is the optional paymaster client (overrides default).
	Paymaster *paymaster.Client

	// GasPayment is the gas payment configuration.
	GasPayment *paymaster.GasPaymentConfig

	// MaxFeePerGas is the max fee per gas (optional).
	MaxFeePerGas *big.Int

	// MaxPriorityFeePerGas is the max priority fee per gas (optional).
	MaxPriorityFeePerGas *big.Int
}

// SendUserOperation sends a UserOperation to the bundler.
func (c *SmartAccountClient) SendUserOperation(ctx context.Context, args SendUserOperationArgs) (types.Hash, error) {
	// Encode call data
	callData, err := c.Account.EncodeCallData(args.Calls)
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to encode call data: %w", err)
	}

	// Get nonce
	nonce, err := c.Account.GetNonce(ctx)
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to get nonce: %w", err)
	}

	// Check if account is deployed
	deployed, err := c.Account.IsDeployed(ctx)
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to check deployment: %w", err)
	}

	// Get factory data if not deployed
	var factory *types.Address
	var factoryData types.Hex
	if !deployed {
		factory = c.Account.GetFactory()
		factoryData = c.Account.GetFactoryData()
	}

	// Get gas prices
	maxFeePerGas := args.MaxFeePerGas
	maxPriorityFeePerGas := args.MaxPriorityFeePerGas
	if maxFeePerGas == nil || maxPriorityFeePerGas == nil {
		gasPrices, err := c.getGasPrices(ctx)
		if err != nil {
			return types.Hash{}, fmt.Errorf("failed to get gas prices: %w", err)
		}
		if maxFeePerGas == nil {
			maxFeePerGas = gasPrices.MaxFeePerGas
		}
		if maxPriorityFeePerGas == nil {
			maxPriorityFeePerGas = gasPrices.MaxPriorityFeePerGas
		}
	}

	// Build partial user operation for estimation
	partialUserOp := &paymaster.PartialUserOperation{
		Sender:               c.Account.Address(),
		Nonce:                nonce,
		CallData:             callData,
		CallGasLimit:         big.NewInt(0),
		VerificationGasLimit: big.NewInt(0),
		PreVerificationGas:   big.NewInt(0),
		MaxFeePerGas:         maxFeePerGas,
		MaxPriorityFeePerGas: maxPriorityFeePerGas,
	}

	// Build full user operation
	userOp := &types.UserOperation{
		Sender:               c.Account.Address(),
		Nonce:                nonce,
		CallData:             callData,
		CallGasLimit:         big.NewInt(0),
		VerificationGasLimit: big.NewInt(0),
		PreVerificationGas:   big.NewInt(0),
		MaxFeePerGas:         maxFeePerGas,
		MaxPriorityFeePerGas: maxPriorityFeePerGas,
		Signature:            types.Hex{},
	}

	if factory != nil {
		userOp.Factory = factory
		userOp.FactoryData = factoryData
	}

	// Get paymaster to use
	pm := args.Paymaster
	if pm == nil {
		pm = c.PaymasterClient
	}

	// Get gas payment config
	gasPayment := args.GasPayment
	if gasPayment == nil {
		gasPayment = &paymaster.GasPaymentConfig{Type: paymaster.GasPaymentNative}
	}

	// Get paymaster data if paymaster is provided and not native payment
	if pm != nil && gasPayment.Type != paymaster.GasPaymentNative {
		pmData, err := pm.GetPaymasterData(ctx, partialUserOp, *gasPayment)
		if err != nil {
			return types.Hash{}, fmt.Errorf("failed to get paymaster data: %w", err)
		}
		if pmData != nil {
			userOp.Paymaster = &pmData.Paymaster
			userOp.PaymasterData = pmData.PaymasterData
			userOp.PaymasterVerificationGasLimit = pmData.PaymasterVerificationGasLimit
			userOp.PaymasterPostOpGasLimit = pmData.PaymasterPostOpGasLimit
		}
	}

	// Estimate gas using partial user operation
	bundlerPartialOp := &types.PartialUserOperation{
		Sender:                        userOp.Sender,
		Nonce:                         userOp.Nonce,
		Factory:                       userOp.Factory,
		FactoryData:                   userOp.FactoryData,
		CallData:                      userOp.CallData,
		CallGasLimit:                  userOp.CallGasLimit,
		VerificationGasLimit:          userOp.VerificationGasLimit,
		PreVerificationGas:            userOp.PreVerificationGas,
		MaxFeePerGas:                  userOp.MaxFeePerGas,
		MaxPriorityFeePerGas:          userOp.MaxPriorityFeePerGas,
		Paymaster:                     userOp.Paymaster,
		PaymasterVerificationGasLimit: userOp.PaymasterVerificationGasLimit,
		PaymasterPostOpGasLimit:       userOp.PaymasterPostOpGasLimit,
		PaymasterData:                 userOp.PaymasterData,
		Signature:                     types.Hex{},
	}

	gasEstimation, err := c.BundlerClient.EstimateUserOperationGas(ctx, bundlerPartialOp)
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to estimate gas: %w", err)
	}
	userOp.CallGasLimit = gasEstimation.CallGasLimit
	userOp.VerificationGasLimit = gasEstimation.VerificationGasLimit
	userOp.PreVerificationGas = gasEstimation.PreVerificationGas
	if gasEstimation.PaymasterVerificationGasLimit != nil {
		userOp.PaymasterVerificationGasLimit = gasEstimation.PaymasterVerificationGasLimit
	}
	if gasEstimation.PaymasterPostOpGasLimit != nil {
		userOp.PaymasterPostOpGasLimit = gasEstimation.PaymasterPostOpGasLimit
	}

	// Calculate user operation hash and sign
	userOpHash := GetUserOperationHash(userOp, c.Account.EntryPoint(), c.ChainId)
	signature, err := c.Account.SignUserOperation(ctx, userOpHash)
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to sign user operation: %w", err)
	}
	userOp.Signature = signature

	// Send to bundler
	hash, err := c.BundlerClient.SendUserOperation(ctx, userOp)
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to send user operation: %w", err)
	}

	return hash, nil
}

// SendTransactionArgs contains arguments for sending a transaction.
type SendTransactionArgs struct {
	// To is the target address.
	To types.Address

	// Value is the ETH value to send.
	Value *big.Int

	// Data is the calldata.
	Data types.Hex

	// Paymaster is the optional paymaster client.
	Paymaster *paymaster.Client

	// GasPayment is the gas payment configuration.
	GasPayment *paymaster.GasPaymentConfig
}

// SendTransaction sends a transaction as a UserOperation.
func (c *SmartAccountClient) SendTransaction(ctx context.Context, args SendTransactionArgs) (types.Hash, error) {
	return c.SendUserOperation(ctx, SendUserOperationArgs{
		Calls: []Call{{
			To:    args.To,
			Value: args.Value,
			Data:  args.Data,
		}},
		Paymaster:  args.Paymaster,
		GasPayment: args.GasPayment,
	})
}

// WaitForUserOperationReceipt waits for a UserOperation receipt.
func (c *SmartAccountClient) WaitForUserOperationReceipt(ctx context.Context, hash types.Hash, timeout time.Duration) (*bundler.UserOperationReceipt, error) {
	return c.BundlerClient.WaitForUserOperationReceipt(ctx, hash, &bundler.WaitOptions{
		Timeout: timeout,
	})
}

// ============================================================================
// Gas Price Helper
// ============================================================================

// GasPrices represents gas price data.
type GasPrices struct {
	MaxFeePerGas         *big.Int
	MaxPriorityFeePerGas *big.Int
}

// getGasPrices gets current gas prices from RPC.
// Falls back to sensible defaults if RPC is unavailable.
func (c *SmartAccountClient) getGasPrices(ctx context.Context) (*GasPrices, error) {
	if c.rpcClient != nil {
		prices, err := c.fetchGasPricesFromRPC(ctx)
		if err == nil {
			return prices, nil
		}
		// RPC call failed, fall through to defaults
	}

	// Default gas prices when RPC is unavailable
	return &GasPrices{
		MaxFeePerGas:         big.NewInt(50_000_000_000), // 50 gwei
		MaxPriorityFeePerGas: big.NewInt(1_500_000_000),  // 1.5 gwei
	}, nil
}

// fetchGasPricesFromRPC queries the Ethereum node for current gas prices.
func (c *SmartAccountClient) fetchGasPricesFromRPC(ctx context.Context) (*GasPrices, error) {
	header, err := c.rpcClient.HeaderByNumber(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest block header: %w", err)
	}

	baseFee := header.BaseFee
	if baseFee == nil {
		// Pre-EIP-1559 chain
		gasPrice, err := c.rpcClient.SuggestGasPrice(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to suggest gas price: %w", err)
		}
		return &GasPrices{
			MaxFeePerGas:         gasPrice,
			MaxPriorityFeePerGas: big.NewInt(0),
		}, nil
	}

	maxPriorityFee, err := c.rpcClient.SuggestGasTipCap(ctx)
	if err != nil {
		maxPriorityFee = new(big.Int).Mul(big.NewInt(2), big.NewInt(1e9))
	}

	// maxFeePerGas = 2 * baseFee + maxPriorityFeePerGas
	maxFee := new(big.Int).Add(
		new(big.Int).Mul(baseFee, big.NewInt(2)),
		maxPriorityFee,
	)

	return &GasPrices{
		MaxFeePerGas:         maxFee,
		MaxPriorityFeePerGas: maxPriorityFee,
	}, nil
}

// ============================================================================
// UserOperation Hash
// ============================================================================

// GetUserOperationHash computes the hash of a UserOperation.
func GetUserOperationHash(userOp *types.UserOperation, entryPoint types.Address, chainId uint64) types.Hash {
	// Pack the user operation
	packed := packUserOperation(userOp)

	// Hash the packed data
	userOpHash := crypto.Keccak256Hash(packed)

	// Pack with entry point and chain ID
	chainIdBytes := make([]byte, 32)
	new(big.Int).SetUint64(chainId).FillBytes(chainIdBytes)

	entryPointBytes := make([]byte, 32)
	copy(entryPointBytes[12:], entryPoint[:])

	finalPacked := append(userOpHash.Bytes(), entryPointBytes...)
	finalPacked = append(finalPacked, chainIdBytes...)

	return types.Hash(crypto.Keccak256Hash(finalPacked))
}

// packUserOperation packs a UserOperation for hashing.
func packUserOperation(userOp *types.UserOperation) []byte {
	var packed []byte

	// sender (address)
	senderBytes := make([]byte, 32)
	copy(senderBytes[12:], userOp.Sender[:])
	packed = append(packed, senderBytes...)

	// nonce (uint256)
	nonceBytes := make([]byte, 32)
	if userOp.Nonce != nil {
		userOp.Nonce.FillBytes(nonceBytes)
	}
	packed = append(packed, nonceBytes...)

	// initCode hash
	var initCode []byte
	if userOp.Factory != nil {
		initCode = append(userOp.Factory[:], userOp.FactoryData...)
	}
	initCodeHash := crypto.Keccak256(initCode)
	packed = append(packed, initCodeHash...)

	// callData hash
	callDataHash := crypto.Keccak256(userOp.CallData)
	packed = append(packed, callDataHash...)

	// accountGasLimits (packed verificationGasLimit and callGasLimit)
	verificationGasBytes := make([]byte, 16)
	callGasBytes := make([]byte, 16)
	if userOp.VerificationGasLimit != nil {
		userOp.VerificationGasLimit.FillBytes(verificationGasBytes)
	}
	if userOp.CallGasLimit != nil {
		userOp.CallGasLimit.FillBytes(callGasBytes)
	}
	packed = append(packed, verificationGasBytes...)
	packed = append(packed, callGasBytes...)

	// preVerificationGas (uint256)
	preVerificationGasBytes := make([]byte, 32)
	if userOp.PreVerificationGas != nil {
		userOp.PreVerificationGas.FillBytes(preVerificationGasBytes)
	}
	packed = append(packed, preVerificationGasBytes...)

	// gasFees (packed maxPriorityFeePerGas and maxFeePerGas)
	maxPriorityBytes := make([]byte, 16)
	maxFeeBytes := make([]byte, 16)
	if userOp.MaxPriorityFeePerGas != nil {
		userOp.MaxPriorityFeePerGas.FillBytes(maxPriorityBytes)
	}
	if userOp.MaxFeePerGas != nil {
		userOp.MaxFeePerGas.FillBytes(maxFeeBytes)
	}
	packed = append(packed, maxPriorityBytes...)
	packed = append(packed, maxFeeBytes...)

	// paymasterAndData hash
	var paymasterAndData []byte
	if userOp.Paymaster != nil {
		paymasterAndData = append(userOp.Paymaster[:], userOp.PaymasterData...)
		// Add paymaster gas limits
		pmVerificationBytes := make([]byte, 16)
		pmPostOpBytes := make([]byte, 16)
		if userOp.PaymasterVerificationGasLimit != nil {
			userOp.PaymasterVerificationGasLimit.FillBytes(pmVerificationBytes)
		}
		if userOp.PaymasterPostOpGasLimit != nil {
			userOp.PaymasterPostOpGasLimit.FillBytes(pmPostOpBytes)
		}
		paymasterAndData = append(paymasterAndData, pmVerificationBytes...)
		paymasterAndData = append(paymasterAndData, pmPostOpBytes...)
	}
	paymasterAndDataHash := crypto.Keccak256(paymasterAndData)
	packed = append(packed, paymasterAndDataHash...)

	return packed
}
