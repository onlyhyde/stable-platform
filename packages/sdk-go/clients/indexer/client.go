// Package indexer provides a client for querying blockchain data from an indexer service.
//
// The indexer client supports both GraphQL and JSON-RPC interfaces for querying:
//   - Gas statistics and pricing
//   - Token balances (ERC20, ERC721, ERC1155)
//   - Token transfers
//   - Transaction history
//
// # Basic Usage
//
//	client := indexer.NewClient(indexer.Config{
//	    BaseURL: "https://indexer.stablenet.io",
//	    Timeout: 30 * time.Second,
//	})
//
//	// Get gas stats
//	stats, err := client.GetGasStats(ctx, 1000000, 1001000)
//
//	// Get token balances
//	balances, err := client.GetTokenBalances(ctx, address, "ERC20")
//
//	// Get transaction history
//	txs, err := client.GetTransactionsByAddress(ctx, address, 100, 0)
package indexer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sort"
	"time"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Configuration
// ============================================================================

// Config contains configuration for the indexer client.
type Config struct {
	// BaseURL is the indexer service base URL.
	BaseURL string
	// Timeout is the request timeout.
	Timeout time.Duration
}

// DefaultConfig returns the default configuration.
func DefaultConfig() Config {
	return Config{
		Timeout: 30 * time.Second,
	}
}

// ============================================================================
// Types
// ============================================================================

// GasStats contains aggregate gas statistics.
type GasStats struct {
	// TotalGasUsed is the total gas used in the block range.
	TotalGasUsed *big.Int `json:"totalGasUsed"`
	// TotalGasLimit is the total gas limit in the block range.
	TotalGasLimit *big.Int `json:"totalGasLimit"`
	// AverageGasUsed is the average gas used per transaction.
	AverageGasUsed *big.Int `json:"averageGasUsed"`
	// AverageGasPrice is the average gas price.
	AverageGasPrice *big.Int `json:"averageGasPrice"`
	// BlockCount is the number of blocks analyzed.
	BlockCount uint64 `json:"blockCount"`
	// TransactionCount is the number of transactions analyzed.
	TransactionCount uint64 `json:"transactionCount"`
}

// TokenType represents the type of token.
type TokenType string

// Token type constants.
const (
	TokenTypeERC20   TokenType = "ERC20"
	TokenTypeERC721  TokenType = "ERC721"
	TokenTypeERC1155 TokenType = "ERC1155"
)

// TokenBalance represents a token balance.
type TokenBalance struct {
	// Address is the token contract address.
	Address types.Address `json:"address"`
	// Balance is the raw balance in smallest units.
	Balance *big.Int `json:"balance"`
	// TokenType is the token type.
	TokenType TokenType `json:"tokenType"`
	// Symbol is the token symbol (optional).
	Symbol string `json:"symbol,omitempty"`
	// Decimals is the token decimals (optional).
	Decimals uint8 `json:"decimals,omitempty"`
	// Name is the token name (optional).
	Name string `json:"name,omitempty"`
}

// TokenTransfer represents a token transfer event.
type TokenTransfer struct {
	// ContractAddress is the token contract address.
	ContractAddress types.Address `json:"contractAddress"`
	// From is the sender address.
	From types.Address `json:"from"`
	// To is the recipient address.
	To types.Address `json:"to"`
	// Value is the transfer value.
	Value *big.Int `json:"value"`
	// TransactionHash is the transaction hash.
	TransactionHash types.Hash `json:"transactionHash"`
	// BlockNumber is the block number.
	BlockNumber uint64 `json:"blockNumber"`
	// LogIndex is the log index.
	LogIndex uint64 `json:"logIndex"`
	// Timestamp is the transfer timestamp.
	Timestamp uint64 `json:"timestamp"`
}

// IndexedTransaction represents a transaction from the indexer.
type IndexedTransaction struct {
	// Hash is the transaction hash.
	Hash types.Hash `json:"hash"`
	// From is the sender address.
	From types.Address `json:"from"`
	// To is the recipient address (nil for contract creation).
	To *types.Address `json:"to,omitempty"`
	// Value is the transaction value in wei.
	Value *big.Int `json:"value"`
	// GasPrice is the gas price in wei.
	GasPrice *big.Int `json:"gasPrice"`
	// GasUsed is the gas used.
	GasUsed *big.Int `json:"gasUsed"`
	// BlockNumber is the block number.
	BlockNumber uint64 `json:"blockNumber"`
	// Timestamp is the transaction timestamp.
	Timestamp uint64 `json:"timestamp"`
	// Status is the transaction status (1 = success, 0 = failed).
	Status uint64 `json:"status"`
}

// PaginatedResult represents a paginated result.
type PaginatedResult[T any] struct {
	// Nodes contains the result items.
	Nodes []T `json:"nodes"`
	// PageInfo contains pagination information.
	PageInfo PageInfo `json:"pageInfo"`
}

// PageInfo contains pagination information.
type PageInfo struct {
	// HasNextPage indicates if there are more pages.
	HasNextPage bool `json:"hasNextPage"`
	// EndCursor is the cursor for the next page.
	EndCursor string `json:"endCursor,omitempty"`
}

// ============================================================================
// Client
// ============================================================================

// Client is an indexer client.
type Client struct {
	config     Config
	httpClient *http.Client
}

// NewClient creates a new indexer client.
func NewClient(config Config) *Client {
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

// SetBaseURL updates the indexer endpoint.
func (c *Client) SetBaseURL(baseURL string) {
	c.config.BaseURL = baseURL
}

// GetBaseURL returns the current indexer endpoint.
func (c *Client) GetBaseURL() string {
	return c.config.BaseURL
}

// ============================================================================
// Gas APIs
// ============================================================================

// GetGasStats returns gas statistics for a block range.
func (c *Client) GetGasStats(ctx context.Context, fromBlock, toBlock uint64) (*GasStats, error) {
	query := `
		query GetGasStats($fromBlock: Int!, $toBlock: Int!) {
			gasStats(fromBlock: $fromBlock, toBlock: $toBlock) {
				totalGasUsed
				totalGasLimit
				averageGasUsed
				averageGasPrice
				blockCount
				transactionCount
			}
		}
	`

	variables := map[string]interface{}{
		"fromBlock": fromBlock,
		"toBlock":   toBlock,
	}

	var result struct {
		GasStats struct {
			TotalGasUsed     string `json:"totalGasUsed"`
			TotalGasLimit    string `json:"totalGasLimit"`
			AverageGasUsed   string `json:"averageGasUsed"`
			AverageGasPrice  string `json:"averageGasPrice"`
			BlockCount       uint64 `json:"blockCount"`
			TransactionCount uint64 `json:"transactionCount"`
		} `json:"gasStats"`
	}

	if err := c.graphql(ctx, query, variables, &result); err != nil {
		return nil, err
	}

	return &GasStats{
		TotalGasUsed:     parseBigInt(result.GasStats.TotalGasUsed),
		TotalGasLimit:    parseBigInt(result.GasStats.TotalGasLimit),
		AverageGasUsed:   parseBigInt(result.GasStats.AverageGasUsed),
		AverageGasPrice:  parseBigInt(result.GasStats.AverageGasPrice),
		BlockCount:       result.GasStats.BlockCount,
		TransactionCount: result.GasStats.TransactionCount,
	}, nil
}

// GetLatestHeight returns the latest block number.
func (c *Client) GetLatestHeight(ctx context.Context) (uint64, error) {
	var result string
	if err := c.rpc(ctx, "eth_blockNumber", []interface{}{}, &result); err != nil {
		return 0, err
	}

	height := parseBigInt(result)
	return height.Uint64(), nil
}

// GetAverageGasPrice returns the average gas price over recent blocks.
func (c *Client) GetAverageGasPrice(ctx context.Context, blockCount uint64) (*big.Int, error) {
	latestBlock, err := c.GetLatestHeight(ctx)
	if err != nil {
		return nil, err
	}

	fromBlock := latestBlock - blockCount
	if fromBlock > latestBlock {
		fromBlock = 0
	}

	stats, err := c.GetGasStats(ctx, fromBlock, latestBlock)
	if err != nil {
		return nil, err
	}

	return stats.AverageGasPrice, nil
}

// ============================================================================
// Token APIs
// ============================================================================

// GetTokenBalances returns all token balances for an address.
func (c *Client) GetTokenBalances(ctx context.Context, address types.Address, tokenType *TokenType) ([]TokenBalance, error) {
	query := `
		query GetTokenBalances($address: String!, $tokenType: String) {
			tokenBalances(address: $address, tokenType: $tokenType) {
				address
				balance
				tokenType
				symbol
				decimals
				name
			}
		}
	`

	variables := map[string]interface{}{
		"address": address.Hex(),
	}
	if tokenType != nil {
		variables["tokenType"] = string(*tokenType)
	}

	var result struct {
		TokenBalances []struct {
			Address   string `json:"address"`
			Balance   string `json:"balance"`
			TokenType string `json:"tokenType"`
			Symbol    string `json:"symbol"`
			Decimals  uint8  `json:"decimals"`
			Name      string `json:"name"`
		} `json:"tokenBalances"`
	}

	if err := c.graphql(ctx, query, variables, &result); err != nil {
		return nil, err
	}

	balances := make([]TokenBalance, len(result.TokenBalances))
	for i, b := range result.TokenBalances {
		balances[i] = TokenBalance{
			Address:   types.MustAddressFromHex(b.Address),
			Balance:   parseBigInt(b.Balance),
			TokenType: TokenType(b.TokenType),
			Symbol:    b.Symbol,
			Decimals:  b.Decimals,
			Name:      b.Name,
		}
	}

	return balances, nil
}

// GetERC20Transfers returns ERC20 transfers for an address.
func (c *Client) GetERC20Transfers(ctx context.Context, address types.Address, isFrom bool, limit, offset uint64) ([]TokenTransfer, error) {
	query := `
		query GetERC20Transfers($address: String!, $isFrom: Boolean!, $limit: Int!, $offset: Int!) {
			erc20Transfers(address: $address, isFrom: $isFrom, limit: $limit, offset: $offset) {
				contractAddress
				from
				to
				value
				transactionHash
				blockNumber
				logIndex
				timestamp
			}
		}
	`

	variables := map[string]interface{}{
		"address": address.Hex(),
		"isFrom":  isFrom,
		"limit":   limit,
		"offset":  offset,
	}

	var result struct {
		ERC20Transfers []struct {
			ContractAddress string `json:"contractAddress"`
			From            string `json:"from"`
			To              string `json:"to"`
			Value           string `json:"value"`
			TransactionHash string `json:"transactionHash"`
			BlockNumber     uint64 `json:"blockNumber"`
			LogIndex        uint64 `json:"logIndex"`
			Timestamp       uint64 `json:"timestamp"`
		} `json:"erc20Transfers"`
	}

	if err := c.graphql(ctx, query, variables, &result); err != nil {
		return nil, err
	}

	transfers := make([]TokenTransfer, len(result.ERC20Transfers))
	for i, t := range result.ERC20Transfers {
		transfers[i] = TokenTransfer{
			ContractAddress: types.MustAddressFromHex(t.ContractAddress),
			From:            types.MustAddressFromHex(t.From),
			To:              types.MustAddressFromHex(t.To),
			Value:           parseBigInt(t.Value),
			TransactionHash: types.HashFromHex(t.TransactionHash),
			BlockNumber:     t.BlockNumber,
			LogIndex:        t.LogIndex,
			Timestamp:       t.Timestamp,
		}
	}

	return transfers, nil
}

// GetAllERC20Transfers returns both sent and received ERC20 transfers, sorted by timestamp.
func (c *Client) GetAllERC20Transfers(ctx context.Context, address types.Address, limit uint64) ([]TokenTransfer, error) {
	halfLimit := limit / 2
	if halfLimit == 0 {
		halfLimit = 1
	}

	// Get sent and received transfers
	sent, err := c.GetERC20Transfers(ctx, address, true, halfLimit, 0)
	if err != nil {
		return nil, err
	}

	received, err := c.GetERC20Transfers(ctx, address, false, halfLimit, 0)
	if err != nil {
		return nil, err
	}

	// Combine and sort by timestamp (descending)
	all := append(sent, received...)
	sort.Slice(all, func(i, j int) bool {
		return all[i].Timestamp > all[j].Timestamp
	})

	// Limit results
	if uint64(len(all)) > limit {
		all = all[:limit]
	}

	return all, nil
}

// GetTokenTransfers returns transfers for a specific token.
func (c *Client) GetTokenTransfers(ctx context.Context, tokenAddress types.Address, limit, offset uint64) ([]TokenTransfer, error) {
	query := `
		query GetTokenTransfers($tokenAddress: String!, $limit: Int!, $offset: Int!) {
			tokenTransfers(tokenAddress: $tokenAddress, limit: $limit, offset: $offset) {
				contractAddress
				from
				to
				value
				transactionHash
				blockNumber
				logIndex
				timestamp
			}
		}
	`

	variables := map[string]interface{}{
		"tokenAddress": tokenAddress.Hex(),
		"limit":        limit,
		"offset":       offset,
	}

	var result struct {
		TokenTransfers []struct {
			ContractAddress string `json:"contractAddress"`
			From            string `json:"from"`
			To              string `json:"to"`
			Value           string `json:"value"`
			TransactionHash string `json:"transactionHash"`
			BlockNumber     uint64 `json:"blockNumber"`
			LogIndex        uint64 `json:"logIndex"`
			Timestamp       uint64 `json:"timestamp"`
		} `json:"tokenTransfers"`
	}

	if err := c.graphql(ctx, query, variables, &result); err != nil {
		return nil, err
	}

	transfers := make([]TokenTransfer, len(result.TokenTransfers))
	for i, t := range result.TokenTransfers {
		transfers[i] = TokenTransfer{
			ContractAddress: types.MustAddressFromHex(t.ContractAddress),
			From:            types.MustAddressFromHex(t.From),
			To:              types.MustAddressFromHex(t.To),
			Value:           parseBigInt(t.Value),
			TransactionHash: types.HashFromHex(t.TransactionHash),
			BlockNumber:     t.BlockNumber,
			LogIndex:        t.LogIndex,
			Timestamp:       t.Timestamp,
		}
	}

	return transfers, nil
}

// ============================================================================
// Transaction APIs
// ============================================================================

// GetTransactionsByAddress returns transactions for an address.
func (c *Client) GetTransactionsByAddress(ctx context.Context, address types.Address, limit, offset uint64) ([]IndexedTransaction, error) {
	query := `
		query GetTransactions($address: String!, $limit: Int!, $offset: Int!) {
			transactions(address: $address, limit: $limit, offset: $offset) {
				hash
				from
				to
				value
				gasPrice
				gasUsed
				blockNumber
				timestamp
				status
			}
		}
	`

	variables := map[string]interface{}{
		"address": address.Hex(),
		"limit":   limit,
		"offset":  offset,
	}

	var result struct {
		Transactions []struct {
			Hash        string  `json:"hash"`
			From        string  `json:"from"`
			To          *string `json:"to"`
			Value       string  `json:"value"`
			GasPrice    string  `json:"gasPrice"`
			GasUsed     string  `json:"gasUsed"`
			BlockNumber uint64  `json:"blockNumber"`
			Timestamp   uint64  `json:"timestamp"`
			Status      uint64  `json:"status"`
		} `json:"transactions"`
	}

	if err := c.graphql(ctx, query, variables, &result); err != nil {
		return nil, err
	}

	txs := make([]IndexedTransaction, len(result.Transactions))
	for i, t := range result.Transactions {
		tx := IndexedTransaction{
			Hash:        types.HashFromHex(t.Hash),
			From:        types.MustAddressFromHex(t.From),
			Value:       parseBigInt(t.Value),
			GasPrice:    parseBigInt(t.GasPrice),
			GasUsed:     parseBigInt(t.GasUsed),
			BlockNumber: t.BlockNumber,
			Timestamp:   t.Timestamp,
			Status:      t.Status,
		}
		if t.To != nil {
			to := types.MustAddressFromHex(*t.To)
			tx.To = &to
		}
		txs[i] = tx
	}

	return txs, nil
}

// GetBalanceAtBlock returns the native balance at a specific block.
func (c *Client) GetBalanceAtBlock(ctx context.Context, address types.Address, blockNumber *uint64) (*big.Int, error) {
	block := "latest"
	if blockNumber != nil {
		block = fmt.Sprintf("0x%x", *blockNumber)
	}

	var result string
	if err := c.rpc(ctx, "eth_getBalance", []interface{}{address.Hex(), block}, &result); err != nil {
		return nil, err
	}

	return parseBigInt(result), nil
}

// ============================================================================
// Health Check
// ============================================================================

// IsAvailable checks if the indexer service is available.
func (c *Client) IsAvailable(ctx context.Context) bool {
	_, err := c.GetLatestHeight(ctx)
	return err == nil
}

// ============================================================================
// Transport Layer
// ============================================================================

// graphql executes a GraphQL query.
func (c *Client) graphql(ctx context.Context, query string, variables map[string]interface{}, result interface{}) error {
	requestBody := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.config.BaseURL+"/graphql", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	var graphqlResponse struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.Unmarshal(body, &graphqlResponse); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(graphqlResponse.Errors) > 0 {
		return fmt.Errorf("graphql error: %s", graphqlResponse.Errors[0].Message)
	}

	if err := json.Unmarshal(graphqlResponse.Data, result); err != nil {
		return fmt.Errorf("failed to parse data: %w", err)
	}

	return nil
}

// rpc executes a JSON-RPC call.
func (c *Client) rpc(ctx context.Context, method string, params []interface{}, result interface{}) error {
	requestBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.config.BaseURL+"/rpc", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	var rpcResponse struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &rpcResponse); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if rpcResponse.Error != nil {
		return fmt.Errorf("rpc error %d: %s", rpcResponse.Error.Code, rpcResponse.Error.Message)
	}

	if err := json.Unmarshal(rpcResponse.Result, result); err != nil {
		return fmt.Errorf("failed to parse result: %w", err)
	}

	return nil
}

// ============================================================================
// Utility Functions
// ============================================================================

// parseBigInt parses a string (decimal or hex) to big.Int.
func parseBigInt(s string) *big.Int {
	if s == "" {
		return big.NewInt(0)
	}

	// Handle hex format
	if len(s) >= 2 && s[:2] == "0x" {
		n, _ := new(big.Int).SetString(s[2:], 16)
		if n == nil {
			return big.NewInt(0)
		}
		return n
	}

	// Handle decimal format
	n, _ := new(big.Int).SetString(s, 10)
	if n == nil {
		return big.NewInt(0)
	}
	return n
}

// FormatTokenBalance formats a raw balance with decimal places.
func FormatTokenBalance(balance *big.Int, decimals uint8) string {
	if balance == nil {
		return "0"
	}

	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	whole := new(big.Int).Div(balance, divisor)
	remainder := new(big.Int).Mod(balance, divisor)

	if remainder.Sign() == 0 {
		return whole.String()
	}

	// Format with decimal places
	remainderStr := remainder.String()
	for len(remainderStr) < int(decimals) {
		remainderStr = "0" + remainderStr
	}

	// Trim trailing zeros
	remainderStr = trimTrailingZeros(remainderStr)

	if remainderStr == "" {
		return whole.String()
	}

	return whole.String() + "." + remainderStr
}

// ParseTokenAmount parses a user-input amount string to raw balance.
func ParseTokenAmount(amount string, decimals uint8) (*big.Int, error) {
	// Split by decimal point
	parts := splitDecimal(amount)

	whole, ok := new(big.Int).SetString(parts[0], 10)
	if !ok {
		return nil, fmt.Errorf("invalid whole part: %s", parts[0])
	}

	// Scale by decimals
	multiplier := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	result := new(big.Int).Mul(whole, multiplier)

	// Handle fractional part
	if len(parts) > 1 && parts[1] != "" {
		fracStr := parts[1]
		// Pad or truncate to decimals length
		for len(fracStr) < int(decimals) {
			fracStr += "0"
		}
		if len(fracStr) > int(decimals) {
			fracStr = fracStr[:decimals]
		}

		frac, ok := new(big.Int).SetString(fracStr, 10)
		if !ok {
			return nil, fmt.Errorf("invalid fractional part: %s", parts[1])
		}

		result.Add(result, frac)
	}

	return result, nil
}

func trimTrailingZeros(s string) string {
	for len(s) > 0 && s[len(s)-1] == '0' {
		s = s[:len(s)-1]
	}
	return s
}

func splitDecimal(s string) []string {
	for i, c := range s {
		if c == '.' {
			return []string{s[:i], s[i+1:]}
		}
	}
	return []string{s}
}
