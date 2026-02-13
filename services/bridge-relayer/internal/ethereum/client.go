package ethereum

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
)

// bridgeABIJSON defines the ABI for bridge contract interactions
const bridgeABIJSON = `[{
	"name":"completeBridge","type":"function",
	"inputs":[
		{"name":"requestID","type":"bytes32"},
		{"name":"sender","type":"address"},
		{"name":"recipient","type":"address"},
		{"name":"sourceToken","type":"address"},
		{"name":"amount","type":"uint256"},
		{"name":"sourceChain","type":"uint256"},
		{"name":"nonce","type":"uint256"},
		{"name":"deadline","type":"uint256"},
		{"name":"signatures","type":"bytes[]"}
	],
	"outputs":[]
},{
	"name":"BridgeInitiated","type":"event",
	"inputs":[
		{"name":"requestID","type":"bytes32","indexed":true},
		{"name":"sender","type":"address","indexed":true},
		{"name":"recipient","type":"address","indexed":false},
		{"name":"token","type":"address","indexed":false},
		{"name":"amount","type":"uint256","indexed":false},
		{"name":"sourceChain","type":"uint256","indexed":false},
		{"name":"targetChain","type":"uint256","indexed":false},
		{"name":"nonce","type":"uint256","indexed":false},
		{"name":"deadline","type":"uint256","indexed":false}
	]
},{
	"name":"BridgeCompleted","type":"event",
	"inputs":[
		{"name":"requestID","type":"bytes32","indexed":true},
		{"name":"recipient","type":"address","indexed":true},
		{"name":"token","type":"address","indexed":false},
		{"name":"amount","type":"uint256","indexed":false}
	]
}]`

// Client represents an Ethereum client wrapper with real RPC connections
type Client struct {
	sourceClient  *ethclient.Client
	targetClient  *ethclient.Client
	sourceChainID *big.Int
	targetChainID *big.Int
	privateKey    *ecdsa.PrivateKey
	address       common.Address
	gasBuffer     uint64
	maxGasPrice   *big.Int
	confirmBlocks uint64
	bridgeABI     abi.ABI

	mu sync.RWMutex
}

// NewClient creates a new Ethereum client with real RPC connections
func NewClient(cfg config.EthereumConfig) (*Client, error) {
	sourceClient, err := ethclient.Dial(cfg.SourceRPCURL)
	if err != nil {
		return nil, fmt.Errorf("connect to source chain: %w", err)
	}

	targetClient, err := ethclient.Dial(cfg.TargetRPCURL)
	if err != nil {
		sourceClient.Close()
		return nil, fmt.Errorf("connect to target chain: %w", err)
	}

	parsedABI, err := abi.JSON(strings.NewReader(bridgeABIJSON))
	if err != nil {
		sourceClient.Close()
		targetClient.Close()
		return nil, fmt.Errorf("parse bridge ABI: %w", err)
	}

	client := &Client{
		sourceClient:  sourceClient,
		targetClient:  targetClient,
		sourceChainID: big.NewInt(int64(cfg.SourceChainID)),
		targetChainID: big.NewInt(int64(cfg.TargetChainID)),
		gasBuffer:     cfg.GasLimitBuffer,
		maxGasPrice:   new(big.Int).Mul(big.NewInt(int64(cfg.MaxGasPrice)), big.NewInt(1e9)),
		confirmBlocks: cfg.ConfirmBlocks,
		bridgeABI:     parsedABI,
	}

	// Parse private key if provided (empty = monitoring-only mode)
	keyHex := strings.TrimPrefix(cfg.PrivateKey, "0x")
	if keyHex != "" {
		privateKey, err := crypto.HexToECDSA(keyHex)
		if err != nil {
			sourceClient.Close()
			targetClient.Close()
			return nil, fmt.Errorf("invalid private key: %w", err)
		}
		client.privateKey = privateKey
		client.address = crypto.PubkeyToAddress(privateKey.PublicKey)
	}

	return client, nil
}

func (c *Client) getClient(isSource bool) *ethclient.Client {
	if isSource {
		return c.sourceClient
	}
	return c.targetClient
}

// GetLatestBlock returns the latest block number for the specified chain
func (c *Client) GetLatestBlock(ctx context.Context, isSource bool) (uint64, error) {
	return c.getClient(isSource).BlockNumber(ctx)
}

// GetBlockTimestamp returns the timestamp of a specific block
func (c *Client) GetBlockTimestamp(ctx context.Context, blockNumber uint64, isSource bool) (time.Time, error) {
	header, err := c.getClient(isSource).HeaderByNumber(ctx, new(big.Int).SetUint64(blockNumber))
	if err != nil {
		return time.Time{}, fmt.Errorf("get block header: %w", err)
	}
	return time.Unix(int64(header.Time), 0), nil
}

// EstimateGas estimates gas for a transaction
func (c *Client) EstimateGas(ctx context.Context, to string, data []byte, isSource bool) (uint64, error) {
	toAddr := common.HexToAddress(to)
	gas, err := c.getClient(isSource).EstimateGas(ctx, ethereum.CallMsg{
		From: c.address,
		To:   &toAddr,
		Data: data,
	})
	if err != nil {
		return 0, fmt.Errorf("estimate gas: %w", err)
	}
	return gas + c.gasBuffer, nil
}

// GetGasPrice returns the current gas price, capped at maxGasPrice
func (c *Client) GetGasPrice(ctx context.Context, isSource bool) (*big.Int, error) {
	gasPrice, err := c.getClient(isSource).SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("get gas price: %w", err)
	}
	if gasPrice.Cmp(c.maxGasPrice) > 0 {
		return new(big.Int).Set(c.maxGasPrice), nil
	}
	return gasPrice, nil
}

// SendTransaction sends a signed transaction to the blockchain
func (c *Client) SendTransaction(ctx context.Context, to string, data []byte, value *big.Int, isSource bool) (string, error) {
	if c.privateKey == nil {
		return "", fmt.Errorf("private key not configured")
	}

	client := c.getClient(isSource)
	chainID := c.GetChainID(isSource)
	toAddr := common.HexToAddress(to)

	nonce, err := client.PendingNonceAt(ctx, c.address)
	if err != nil {
		return "", fmt.Errorf("get nonce: %w", err)
	}

	gasPrice, err := c.GetGasPrice(ctx, isSource)
	if err != nil {
		return "", fmt.Errorf("get gas price: %w", err)
	}

	gasLimit, err := c.EstimateGas(ctx, to, data, isSource)
	if err != nil {
		return "", fmt.Errorf("estimate gas: %w", err)
	}

	tx := types.NewTx(&types.LegacyTx{
		Nonce:    nonce,
		GasPrice: gasPrice,
		Gas:      gasLimit,
		To:       &toAddr,
		Value:    value,
		Data:     data,
	})

	signer := types.LatestSignerForChainID(chainID)
	signedTx, err := types.SignTx(tx, signer, c.privateKey)
	if err != nil {
		return "", fmt.Errorf("sign transaction: %w", err)
	}

	if err := client.SendTransaction(ctx, signedTx); err != nil {
		return "", fmt.Errorf("send transaction: %w", err)
	}

	return signedTx.Hash().Hex(), nil
}

// WaitForTransaction waits for a transaction to be confirmed with required block confirmations
func (c *Client) WaitForTransaction(ctx context.Context, txHash string, isSource bool) (bool, error) {
	client := c.getClient(isSource)
	hash := common.HexToHash(txHash)

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		case <-ticker.C:
			receipt, err := client.TransactionReceipt(ctx, hash)
			if err != nil {
				continue // Not yet mined
			}

			// Wait for required block confirmations
			if c.confirmBlocks > 0 {
				latestBlock, err := client.BlockNumber(ctx)
				if err != nil {
					continue
				}
				if latestBlock-receipt.BlockNumber.Uint64() < c.confirmBlocks {
					continue
				}
			}

			return receipt.Status == types.ReceiptStatusSuccessful, nil
		}
	}
}

// CallContract calls a contract method (read-only via eth_call)
func (c *Client) CallContract(ctx context.Context, to string, data []byte, isSource bool) ([]byte, error) {
	toAddr := common.HexToAddress(to)
	result, err := c.getClient(isSource).CallContract(ctx, ethereum.CallMsg{
		To:   &toAddr,
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("call contract: %w", err)
	}
	return result, nil
}

// GetNonce returns the current pending nonce for the relayer address
func (c *Client) GetNonce(ctx context.Context, isSource bool) (uint64, error) {
	return c.getClient(isSource).PendingNonceAt(ctx, c.address)
}

// IsConnected checks if the client is connected to the node
func (c *Client) IsConnected(ctx context.Context, isSource bool) bool {
	_, err := c.getClient(isSource).ChainID(ctx)
	return err == nil
}

// GetChainID returns the chain ID
func (c *Client) GetChainID(isSource bool) *big.Int {
	if isSource {
		return c.sourceChainID
	}
	return c.targetChainID
}

// EncodeCompleteBridge encodes the completeBridge function call using ABI encoding
func (c *Client) EncodeCompleteBridge(
	requestID [32]byte,
	sender string,
	recipient string,
	sourceToken string,
	amount *big.Int,
	sourceChain uint64,
	nonce uint64,
	deadline uint64,
	signatures [][]byte,
) ([]byte, error) {
	return c.bridgeABI.Pack(
		"completeBridge",
		requestID,
		common.HexToAddress(sender),
		common.HexToAddress(recipient),
		common.HexToAddress(sourceToken),
		amount,
		new(big.Int).SetUint64(sourceChain),
		new(big.Int).SetUint64(nonce),
		new(big.Int).SetUint64(deadline),
		signatures,
	)
}

// DecodeEventLog decodes an event log using the bridge ABI
func (c *Client) DecodeEventLog(eventName string, data []byte, topics []string) (map[string]interface{}, error) {
	event, ok := c.bridgeABI.Events[eventName]
	if !ok {
		return nil, fmt.Errorf("event %s not found in ABI", eventName)
	}

	result := make(map[string]interface{})

	// Unpack non-indexed args from data
	if len(data) > 0 {
		if err := event.Inputs.UnpackIntoMap(result, data); err != nil {
			return nil, fmt.Errorf("unpack event data: %w", err)
		}
	}

	// Parse indexed topics (topics[0] = event signature hash)
	topicIdx := 1
	for _, input := range event.Inputs {
		if input.Indexed && topicIdx < len(topics) {
			hash := common.HexToHash(topics[topicIdx])
			switch input.Type.T {
			case abi.AddressTy:
				result[input.Name] = common.BytesToAddress(hash.Bytes())
			case abi.FixedBytesTy:
				result[input.Name] = hash
			default:
				result[input.Name] = hash.Big()
			}
			topicIdx++
		}
	}

	return result, nil
}

// SubscribeToEvents subscribes to contract events using log polling
func (c *Client) SubscribeToEvents(
	ctx context.Context,
	contractAddress string,
	eventSignatures []string,
	fromBlock uint64,
	isSource bool,
) (<-chan EventLog, error) {
	events := make(chan EventLog, 100)
	client := c.getClient(isSource)
	addr := common.HexToAddress(contractAddress)

	// Convert event signatures to topic hashes
	topicHashes := make([]common.Hash, len(eventSignatures))
	for i, sig := range eventSignatures {
		topicHashes[i] = crypto.Keccak256Hash([]byte(sig))
	}

	go func() {
		defer close(events)
		currentBlock := fromBlock
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				latestBlock, err := client.BlockNumber(ctx)
				if err != nil || currentBlock > latestBlock {
					continue
				}

				toBlock := latestBlock
				if toBlock-currentBlock > 1000 {
					toBlock = currentBlock + 1000
				}

				query := ethereum.FilterQuery{
					FromBlock: new(big.Int).SetUint64(currentBlock),
					ToBlock:   new(big.Int).SetUint64(toBlock),
					Addresses: []common.Address{addr},
					Topics:    [][]common.Hash{topicHashes},
				}

				logs, err := client.FilterLogs(ctx, query)
				if err != nil {
					continue
				}

				for _, l := range logs {
					topicStrs := make([]string, len(l.Topics))
					for j, t := range l.Topics {
						topicStrs[j] = t.Hex()
					}
					events <- EventLog{
						Address:     l.Address.Hex(),
						Topics:      topicStrs,
						Data:        l.Data,
						BlockNumber: l.BlockNumber,
						TxHash:      l.TxHash.Hex(),
						TxIndex:     l.TxIndex,
						BlockHash:   l.BlockHash.Hex(),
						LogIndex:    l.Index,
						Removed:     l.Removed,
					}
				}

				currentBlock = toBlock + 1
			}
		}
	}()

	return events, nil
}

// EventLog represents a contract event log
type EventLog struct {
	Address     string   `json:"address"`
	Topics      []string `json:"topics"`
	Data        []byte   `json:"data"`
	BlockNumber uint64   `json:"blockNumber"`
	TxHash      string   `json:"txHash"`
	TxIndex     uint     `json:"txIndex"`
	BlockHash   string   `json:"blockHash"`
	LogIndex    uint     `json:"logIndex"`
	Removed     bool     `json:"removed"`
}

// HashBridgeMessage computes the keccak256 hash of a bridge message,
// matching Solidity's keccak256(abi.encode(requestID, sender, recipient, token, amount, sourceChain, targetChain, nonce, deadline))
func HashBridgeMessage(
	requestID [32]byte,
	sender string,
	recipient string,
	token string,
	amount *big.Int,
	sourceChain uint64,
	targetChain uint64,
	nonce uint64,
	deadline uint64,
) [32]byte {
	bytes32Ty, _ := abi.NewType("bytes32", "", nil)
	addressTy, _ := abi.NewType("address", "", nil)
	uint256Ty, _ := abi.NewType("uint256", "", nil)

	arguments := abi.Arguments{
		{Type: bytes32Ty},
		{Type: addressTy},
		{Type: addressTy},
		{Type: addressTy},
		{Type: uint256Ty},
		{Type: uint256Ty},
		{Type: uint256Ty},
		{Type: uint256Ty},
		{Type: uint256Ty},
	}

	encoded, err := arguments.Pack(
		requestID,
		common.HexToAddress(sender),
		common.HexToAddress(recipient),
		common.HexToAddress(token),
		amount,
		new(big.Int).SetUint64(sourceChain),
		new(big.Int).SetUint64(targetChain),
		new(big.Int).SetUint64(nonce),
		new(big.Int).SetUint64(deadline),
	)
	if err != nil {
		var hash [32]byte
		copy(hash[:], requestID[:])
		return hash
	}

	return crypto.Keccak256Hash(encoded)
}
