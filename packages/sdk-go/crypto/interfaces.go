// Package crypto provides cryptographic abstraction interfaces for the StableNet SDK.
// These interfaces allow different implementations (go-ethereum, custom, HSM, etc.)
// while maintaining a consistent API.
package crypto

import (
	"context"
	"math/big"

	"github.com/stablenet/sdk-go/types"
)

// AbiEncoder defines the interface for ABI encoding/decoding operations.
// This abstracts the ABI encoding logic to allow different implementations.
type AbiEncoder interface {
	// EncodeParameters encodes values according to their ABI types.
	// types: array of Solidity type strings (e.g., "address", "uint256", "bytes")
	// values: corresponding values to encode
	EncodeParameters(types []string, values []interface{}) (types.Hex, error)

	// DecodeParameters decodes ABI-encoded data back to values.
	DecodeParameters(abiTypes []string, data types.Hex) ([]interface{}, error)

	// EncodeFunctionCall encodes a function call with the given ABI, function name, and arguments.
	EncodeFunctionCall(abi []byte, functionName string, args ...interface{}) (types.Hex, error)

	// DecodeFunctionResult decodes the return value of a function call.
	DecodeFunctionResult(abi []byte, functionName string, data types.Hex) ([]interface{}, error)

	// EncodePacked performs packed encoding (no padding).
	EncodePacked(types []string, values []interface{}) (types.Hex, error)
}

// HashAlgorithm defines the interface for cryptographic hash operations.
type HashAlgorithm interface {
	// Keccak256 computes the Keccak-256 hash of the input data.
	Keccak256(data []byte) types.Hash

	// Sha256 computes the SHA-256 hash of the input data.
	Sha256(data []byte) types.Hash
}

// Signer defines the interface for signing operations.
type Signer interface {
	// GetAddress returns the address associated with this signer.
	GetAddress(ctx context.Context) (types.Address, error)

	// SignMessage signs an arbitrary message with EIP-191 personal_sign format.
	// The message will be prefixed with "\x19Ethereum Signed Message:\n" + len(message).
	SignMessage(ctx context.Context, message []byte) (types.Hex, error)

	// SignTypedData signs typed data according to EIP-712.
	SignTypedData(ctx context.Context, typedData types.TypedData) (types.Hex, error)

	// SignHash signs a raw 32-byte hash without any prefixing.
	// Use this for signing user operation hashes and other pre-hashed data.
	SignHash(ctx context.Context, hash types.Hash) (*types.Signature, error)
}

// RpcClient defines the interface for Ethereum JSON-RPC operations.
type RpcClient interface {
	// Request makes a raw JSON-RPC request.
	Request(ctx context.Context, method string, params ...interface{}) (interface{}, error)

	// GetChainID returns the chain ID of the connected network.
	GetChainID(ctx context.Context) (types.ChainID, error)

	// GetBlockNumber returns the current block number.
	GetBlockNumber(ctx context.Context) (uint64, error)

	// GetBalance returns the ETH balance of an address.
	GetBalance(ctx context.Context, address types.Address) (*big.Int, error)

	// GetNonce returns the transaction count (nonce) of an address.
	GetNonce(ctx context.Context, address types.Address) (uint64, error)

	// GetCode returns the code at a given address.
	GetCode(ctx context.Context, address types.Address) (types.Hex, error)

	// ReadContract calls a view/pure function on a contract.
	ReadContract(ctx context.Context, params ContractCallParams) (types.Hex, error)

	// EstimateGas estimates the gas required for a transaction.
	EstimateGas(ctx context.Context, params EstimateGasParams) (*big.Int, error)

	// GetGasPrice returns the current gas price.
	GetGasPrice(ctx context.Context) (*big.Int, error)

	// GetMaxPriorityFeePerGas returns the current max priority fee per gas (EIP-1559).
	GetMaxPriorityFeePerGas(ctx context.Context) (*big.Int, error)

	// SendRawTransaction sends a signed transaction and returns the transaction hash.
	SendRawTransaction(ctx context.Context, signedTx types.Hex) (types.Hash, error)
}

// ContractCallParams contains parameters for a contract call.
type ContractCallParams struct {
	To       types.Address `json:"to"`
	From     *types.Address `json:"from,omitempty"`
	Data     types.Hex     `json:"data"`
	Value    *big.Int      `json:"value,omitempty"`
	Gas      *big.Int      `json:"gas,omitempty"`
	GasPrice *big.Int      `json:"gasPrice,omitempty"`
}

// EstimateGasParams contains parameters for gas estimation.
type EstimateGasParams struct {
	From     *types.Address `json:"from,omitempty"`
	To       *types.Address `json:"to,omitempty"`
	Data     types.Hex      `json:"data,omitempty"`
	Value    *big.Int       `json:"value,omitempty"`
	Gas      *big.Int       `json:"gas,omitempty"`
	GasPrice *big.Int       `json:"gasPrice,omitempty"`
}

// CryptoProvider combines all cryptographic functionality into a single interface.
type CryptoProvider interface {
	// AbiEncoder returns the ABI encoding implementation.
	AbiEncoder() AbiEncoder

	// HashAlgorithm returns the hash algorithm implementation.
	HashAlgorithm() HashAlgorithm

	// Signer returns the signer implementation (may be nil if no signer configured).
	Signer() Signer

	// RpcClient returns the RPC client implementation.
	RpcClient() RpcClient
}
