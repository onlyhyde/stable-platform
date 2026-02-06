// Package client provides the StealthClient for interacting with EIP-5564/6538 contracts.
package client

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	gethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/plugins/stealth/constants"
	"github.com/stablenet/sdk-go/types"
)

// Config represents the configuration for a stealth client.
type Config struct {
	// RPCURL is the RPC endpoint URL.
	RPCURL string `json:"rpcUrl"`
	// PrivateKey is the wallet private key for write operations (optional).
	PrivateKey types.Hex `json:"privateKey,omitempty"`
	// AnnouncerAddress is the EIP-5564 announcer contract address (optional, uses default).
	AnnouncerAddress *types.Address `json:"announcerAddress,omitempty"`
	// RegistryAddress is the EIP-6538 registry contract address (optional, uses default).
	RegistryAddress *types.Address `json:"registryAddress,omitempty"`
	// ChainID is the chain ID.
	ChainID uint64 `json:"chainId"`
}

// Client provides methods for interacting with stealth address contracts.
type Client struct {
	// Config is the client configuration.
	Config Config

	// EthClient is the underlying Ethereum client.
	EthClient *ethclient.Client

	// Signer is the private key for signing transactions (optional).
	Signer *ecdsa.PrivateKey

	// SignerAddress is the address derived from the signer.
	SignerAddress types.Address

	// AnnouncerAddress is the EIP-5564 Announcer contract address.
	AnnouncerAddress types.Address

	// RegistryAddress is the EIP-6538 Registry contract address.
	RegistryAddress types.Address

	// ChainID is the chain ID.
	ChainID *big.Int
}

// NewClient creates a new stealth client.
func NewClient(config Config) (*Client, error) {
	// Connect to Ethereum client
	ethClient, err := ethclient.Dial(config.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	client := &Client{
		Config:    config,
		EthClient: ethClient,
		ChainID:   big.NewInt(int64(config.ChainID)),
	}

	// Set up signer if private key provided
	if len(config.PrivateKey) > 0 {
		privKey, err := crypto.ToECDSA(config.PrivateKey)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		client.Signer = privKey
		client.SignerAddress = types.Address(crypto.PubkeyToAddress(privKey.PublicKey))
	}

	// Resolve announcer address
	if config.AnnouncerAddress != nil {
		client.AnnouncerAddress = *config.AnnouncerAddress
	} else {
		client.AnnouncerAddress = constants.GetAnnouncerAddress(config.ChainID)
	}

	// Resolve registry address
	if config.RegistryAddress != nil {
		client.RegistryAddress = *config.RegistryAddress
	} else {
		client.RegistryAddress = constants.GetRegistryAddress(config.ChainID)
	}

	return client, nil
}

// Close closes the client connection.
func (c *Client) Close() {
	if c.EthClient != nil {
		c.EthClient.Close()
	}
}

// GetTransactOpts returns transaction options for sending transactions.
func (c *Client) GetTransactOpts(ctx context.Context) (*bind.TransactOpts, error) {
	if c.Signer == nil {
		return nil, fmt.Errorf("signer not configured")
	}

	// Get nonce
	nonce, err := c.EthClient.PendingNonceAt(ctx, common.Address(c.SignerAddress))
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	// Get gas price
	gasPrice, err := c.EthClient.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	auth, err := bind.NewKeyedTransactorWithChainID(c.Signer, c.ChainID)
	if err != nil {
		return nil, fmt.Errorf("failed to create transactor: %w", err)
	}

	auth.Nonce = big.NewInt(int64(nonce))
	auth.GasPrice = gasPrice
	auth.Context = ctx

	return auth, nil
}

// SendTransaction sends a raw transaction.
func (c *Client) SendTransaction(
	ctx context.Context,
	opts *bind.TransactOpts,
	to *common.Address,
	data []byte,
) (*gethTypes.Transaction, error) {
	if c.Signer == nil {
		return nil, fmt.Errorf("signer not configured")
	}

	// Estimate gas if not set
	gasLimit := opts.GasLimit
	if gasLimit == 0 {
		estimated, err := c.EthClient.EstimateGas(ctx, ethereum.CallMsg{
			From: common.Address(c.SignerAddress),
			To:   to,
			Data: data,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to estimate gas: %w", err)
		}
		gasLimit = estimated * 120 / 100 // Add 20% buffer
	}

	// Build transaction
	var tx *gethTypes.Transaction
	if opts.GasPrice != nil {
		// Legacy transaction
		tx = gethTypes.NewTransaction(
			opts.Nonce.Uint64(),
			*to,
			big.NewInt(0),
			gasLimit,
			opts.GasPrice,
			data,
		)
	} else {
		// EIP-1559 transaction
		gasTipCap, err := c.EthClient.SuggestGasTipCap(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get gas tip cap: %w", err)
		}

		gasFeeCap, err := c.EthClient.SuggestGasPrice(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get gas fee cap: %w", err)
		}

		tx = gethTypes.NewTx(&gethTypes.DynamicFeeTx{
			ChainID:   c.ChainID,
			Nonce:     opts.Nonce.Uint64(),
			GasTipCap: gasTipCap,
			GasFeeCap: gasFeeCap,
			Gas:       gasLimit,
			To:        to,
			Value:     big.NewInt(0),
			Data:      data,
		})
	}

	// Sign transaction
	signer := gethTypes.LatestSignerForChainID(c.ChainID)
	signedTx, err := gethTypes.SignTx(tx, signer, c.Signer)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	if err := c.EthClient.SendTransaction(ctx, signedTx); err != nil {
		return nil, fmt.Errorf("failed to send transaction: %w", err)
	}

	return signedTx, nil
}

// EstimateGas estimates gas for a contract call.
func (c *Client) EstimateGas(ctx context.Context, to types.Address, data types.Hex) (uint64, error) {
	from := common.Address{}
	if c.SignerAddress != (types.Address{}) {
		from = common.Address(c.SignerAddress)
	}

	toAddr := common.Address(to)
	return c.EthClient.EstimateGas(ctx, ethereum.CallMsg{
		From: from,
		To:   &toAddr,
		Data: data,
	})
}

// Call makes a read-only contract call.
func (c *Client) Call(ctx context.Context, to types.Address, data types.Hex) ([]byte, error) {
	toAddr := common.Address(to)
	return c.EthClient.CallContract(ctx, ethereum.CallMsg{
		To:   &toAddr,
		Data: data,
	}, nil)
}

// GetBlockNumber returns the current block number.
func (c *Client) GetBlockNumber(ctx context.Context) (uint64, error) {
	return c.EthClient.BlockNumber(ctx)
}

// WaitForTransaction waits for a transaction to be mined.
func (c *Client) WaitForTransaction(ctx context.Context, txHash types.Hash) (*gethTypes.Receipt, error) {
	return bind.WaitMined(ctx, c.EthClient, &gethTypes.Transaction{})
}
