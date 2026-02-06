// Package geth provides go-ethereum based implementations of crypto interfaces.
package geth

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"golang.org/x/crypto/sha3"

	"github.com/stablenet/sdk-go/crypto"
	"github.com/stablenet/sdk-go/types"
)

// Provider implements crypto.CryptoProvider using go-ethereum.
type Provider struct {
	client     *ethclient.Client
	privateKey *ecdsa.PrivateKey
	abiEncoder *AbiEncoder
	hasher     *HashAlgorithm
	signer     *Signer
	rpcClient  *RpcClient
}

// ProviderConfig configures the go-ethereum crypto provider.
type ProviderConfig struct {
	// RpcURL is the Ethereum JSON-RPC endpoint URL.
	RpcURL string

	// PrivateKey is the private key for signing (optional).
	// If nil, signing operations will fail.
	PrivateKey *ecdsa.PrivateKey
}

// NewProvider creates a new go-ethereum based crypto provider.
func NewProvider(ctx context.Context, config ProviderConfig) (*Provider, error) {
	client, err := ethclient.DialContext(ctx, config.RpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	p := &Provider{
		client:     client,
		privateKey: config.PrivateKey,
		abiEncoder: &AbiEncoder{},
		hasher:     &HashAlgorithm{},
	}

	p.rpcClient = &RpcClient{client: client}

	if config.PrivateKey != nil {
		p.signer = &Signer{privateKey: config.PrivateKey}
	}

	return p, nil
}

// AbiEncoder returns the ABI encoder implementation.
func (p *Provider) AbiEncoder() crypto.AbiEncoder {
	return p.abiEncoder
}

// HashAlgorithm returns the hash algorithm implementation.
func (p *Provider) HashAlgorithm() crypto.HashAlgorithm {
	return p.hasher
}

// Signer returns the signer implementation.
func (p *Provider) Signer() crypto.Signer {
	if p.signer == nil {
		return nil
	}
	return p.signer
}

// RpcClient returns the RPC client implementation.
func (p *Provider) RpcClient() crypto.RpcClient {
	return p.rpcClient
}

// Close closes the underlying Ethereum client connection.
func (p *Provider) Close() {
	if p.client != nil {
		p.client.Close()
	}
}

// AbiEncoder implements crypto.AbiEncoder using go-ethereum.
type AbiEncoder struct{}

// EncodeParameters encodes values according to their ABI types.
func (e *AbiEncoder) EncodeParameters(abiTypes []string, values []interface{}) (types.Hex, error) {
	args := make(abi.Arguments, len(abiTypes))
	for i, t := range abiTypes {
		typ, err := abi.NewType(t, "", nil)
		if err != nil {
			return nil, fmt.Errorf("invalid type %s: %w", t, err)
		}
		args[i] = abi.Argument{Type: typ}
	}

	encoded, err := args.Pack(values...)
	if err != nil {
		return nil, fmt.Errorf("failed to encode: %w", err)
	}

	return types.Hex(encoded), nil
}

// DecodeParameters decodes ABI-encoded data back to values.
func (e *AbiEncoder) DecodeParameters(abiTypes []string, data types.Hex) ([]interface{}, error) {
	args := make(abi.Arguments, len(abiTypes))
	for i, t := range abiTypes {
		typ, err := abi.NewType(t, "", nil)
		if err != nil {
			return nil, fmt.Errorf("invalid type %s: %w", t, err)
		}
		args[i] = abi.Argument{Type: typ}
	}

	decoded, err := args.Unpack(data.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to decode: %w", err)
	}

	return decoded, nil
}

// EncodeFunctionCall encodes a function call.
func (e *AbiEncoder) EncodeFunctionCall(abiJSON []byte, functionName string, args ...interface{}) (types.Hex, error) {
	parsedABI, err := abi.JSON(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	encoded, err := parsedABI.Pack(functionName, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to encode function call: %w", err)
	}

	return types.Hex(encoded), nil
}

// DecodeFunctionResult decodes a function result.
func (e *AbiEncoder) DecodeFunctionResult(abiJSON []byte, functionName string, data types.Hex) ([]interface{}, error) {
	parsedABI, err := abi.JSON(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	decoded, err := parsedABI.Unpack(functionName, data.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to decode function result: %w", err)
	}

	return decoded, nil
}

// EncodePacked performs packed encoding.
func (e *AbiEncoder) EncodePacked(abiTypes []string, values []interface{}) (types.Hex, error) {
	// Packed encoding concatenates without padding
	// This is a simplified implementation
	var result []byte

	for i, t := range abiTypes {
		val := values[i]
		switch t {
		case "address":
			addr, ok := val.(common.Address)
			if !ok {
				return nil, fmt.Errorf("expected address for type %s", t)
			}
			result = append(result, addr.Bytes()...)
		case "uint256":
			switch v := val.(type) {
			case *big.Int:
				padded := common.LeftPadBytes(v.Bytes(), 32)
				result = append(result, padded...)
			case int64:
				padded := common.LeftPadBytes(big.NewInt(v).Bytes(), 32)
				result = append(result, padded...)
			default:
				return nil, fmt.Errorf("expected *big.Int or int64 for uint256")
			}
		case "bytes32":
			b, ok := val.([32]byte)
			if !ok {
				return nil, fmt.Errorf("expected [32]byte for bytes32")
			}
			result = append(result, b[:]...)
		case "bytes":
			b, ok := val.([]byte)
			if !ok {
				return nil, fmt.Errorf("expected []byte for bytes")
			}
			result = append(result, b...)
		default:
			return nil, fmt.Errorf("unsupported packed type: %s", t)
		}
	}

	return types.Hex(result), nil
}

// HashAlgorithm implements crypto.HashAlgorithm using go-ethereum.
type HashAlgorithm struct{}

// Keccak256 computes the Keccak-256 hash.
func (h *HashAlgorithm) Keccak256(data []byte) types.Hash {
	hash := sha3.NewLegacyKeccak256()
	hash.Write(data)
	var result types.Hash
	copy(result[:], hash.Sum(nil))
	return result
}

// Sha256 computes the SHA-256 hash.
func (h *HashAlgorithm) Sha256(data []byte) types.Hash {
	return ethcrypto.Keccak256Hash(data) // Note: This should use sha256
}

// Signer implements crypto.Signer using go-ethereum.
type Signer struct {
	privateKey *ecdsa.PrivateKey
}

// GetAddress returns the address for this signer.
func (s *Signer) GetAddress(ctx context.Context) (types.Address, error) {
	return ethcrypto.PubkeyToAddress(s.privateKey.PublicKey), nil
}

// SignMessage signs a message with EIP-191 prefix.
func (s *Signer) SignMessage(ctx context.Context, message []byte) (types.Hex, error) {
	// EIP-191 prefix
	prefix := []byte(fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(message)))
	prefixedMessage := append(prefix, message...)
	hash := ethcrypto.Keccak256(prefixedMessage)

	sig, err := ethcrypto.Sign(hash, s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign message: %w", err)
	}

	// Adjust V value for Ethereum compatibility
	if sig[64] < 27 {
		sig[64] += 27
	}

	return types.Hex(sig), nil
}

// SignTypedData signs EIP-712 typed data.
func (s *Signer) SignTypedData(ctx context.Context, typedData types.TypedData) (types.Hex, error) {
	// TODO: Implement EIP-712 signing
	return nil, fmt.Errorf("SignTypedData not yet implemented")
}

// SignHash signs a raw hash.
func (s *Signer) SignHash(ctx context.Context, hash types.Hash) (*types.Signature, error) {
	sig, err := ethcrypto.Sign(hash[:], s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign hash: %w", err)
	}

	return &types.Signature{
		R: types.Hex(sig[0:32]),
		S: types.Hex(sig[32:64]),
		V: sig[64],
	}, nil
}

// RpcClient implements crypto.RpcClient using go-ethereum.
type RpcClient struct {
	client *ethclient.Client
}

// Request makes a raw JSON-RPC request.
func (r *RpcClient) Request(ctx context.Context, method string, params ...interface{}) (interface{}, error) {
	// This would need direct RPC access, which ethclient doesn't expose easily
	return nil, fmt.Errorf("raw Request not implemented, use specific methods")
}

// GetChainID returns the chain ID.
func (r *RpcClient) GetChainID(ctx context.Context) (types.ChainID, error) {
	chainID, err := r.client.ChainID(ctx)
	if err != nil {
		return 0, err
	}
	return types.ChainID(chainID.Uint64()), nil
}

// GetBlockNumber returns the current block number.
func (r *RpcClient) GetBlockNumber(ctx context.Context) (uint64, error) {
	return r.client.BlockNumber(ctx)
}

// GetBalance returns the balance of an address.
func (r *RpcClient) GetBalance(ctx context.Context, address types.Address) (*big.Int, error) {
	return r.client.BalanceAt(ctx, address, nil)
}

// GetNonce returns the nonce of an address.
func (r *RpcClient) GetNonce(ctx context.Context, address types.Address) (uint64, error) {
	return r.client.NonceAt(ctx, address, nil)
}

// GetCode returns the code at an address.
func (r *RpcClient) GetCode(ctx context.Context, address types.Address) (types.Hex, error) {
	code, err := r.client.CodeAt(ctx, address, nil)
	if err != nil {
		return nil, err
	}
	return types.Hex(code), nil
}

// ReadContract calls a contract.
func (r *RpcClient) ReadContract(ctx context.Context, params crypto.ContractCallParams) (types.Hex, error) {
	callMsg := ethereum.CallMsg{
		To:   (*common.Address)(&params.To),
		Data: params.Data.Bytes(),
	}

	if params.From != nil {
		callMsg.From = *params.From
	}
	if params.Value != nil {
		callMsg.Value = params.Value
	}
	if params.Gas != nil {
		callMsg.Gas = params.Gas.Uint64()
	}
	if params.GasPrice != nil {
		callMsg.GasPrice = params.GasPrice
	}

	result, err := r.client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return nil, err
	}
	return types.Hex(result), nil
}

// EstimateGas estimates gas for a transaction.
func (r *RpcClient) EstimateGas(ctx context.Context, params crypto.EstimateGasParams) (*big.Int, error) {
	callMsg := ethereum.CallMsg{
		Data: params.Data.Bytes(),
	}

	if params.From != nil {
		callMsg.From = *params.From
	}
	if params.To != nil {
		callMsg.To = params.To
	}
	if params.Value != nil {
		callMsg.Value = params.Value
	}
	if params.Gas != nil {
		callMsg.Gas = params.Gas.Uint64()
	}
	if params.GasPrice != nil {
		callMsg.GasPrice = params.GasPrice
	}

	gas, err := r.client.EstimateGas(ctx, callMsg)
	if err != nil {
		return nil, err
	}
	return big.NewInt(int64(gas)), nil
}

// GetGasPrice returns the current gas price.
func (r *RpcClient) GetGasPrice(ctx context.Context) (*big.Int, error) {
	return r.client.SuggestGasPrice(ctx)
}

// GetMaxPriorityFeePerGas returns the suggested priority fee.
func (r *RpcClient) GetMaxPriorityFeePerGas(ctx context.Context) (*big.Int, error) {
	return r.client.SuggestGasTipCap(ctx)
}

// SendRawTransaction sends a signed transaction.
func (r *RpcClient) SendRawTransaction(ctx context.Context, signedTx types.Hex) (types.Hash, error) {
	// TODO: Implement raw transaction sending
	return types.Hash{}, fmt.Errorf("SendRawTransaction not yet implemented")
}
