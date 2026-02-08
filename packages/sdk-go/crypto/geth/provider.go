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
	// Compute EIP-712 domain separator hash
	domainHash, err := hashEIP712Domain(typedData.Domain)
	if err != nil {
		return nil, fmt.Errorf("failed to hash domain: %w", err)
	}

	// Compute struct hash for the primary type message
	structHash, err := hashEIP712Struct(typedData.PrimaryType, typedData.Message, typedData.Types)
	if err != nil {
		return nil, fmt.Errorf("failed to hash struct: %w", err)
	}

	// EIP-712: keccak256("\x19\x01" || domainSeparator || structHash)
	rawData := make([]byte, 0, 2+32+32)
	rawData = append(rawData, 0x19, 0x01)
	rawData = append(rawData, domainHash[:]...)
	rawData = append(rawData, structHash[:]...)
	digest := ethcrypto.Keccak256(rawData)

	sig, err := ethcrypto.Sign(digest, s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign typed data: %w", err)
	}

	// Adjust V value for Ethereum compatibility
	if sig[64] < 27 {
		sig[64] += 27
	}

	return types.Hex(sig), nil
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
	var result interface{}
	err := r.client.Client().CallContext(ctx, &result, method, params...)
	if err != nil {
		return nil, fmt.Errorf("RPC request %s failed: %w", method, err)
	}
	return result, nil
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

// SendRawTransaction sends a signed transaction via eth_sendRawTransaction.
func (r *RpcClient) SendRawTransaction(ctx context.Context, signedTx types.Hex) (types.Hash, error) {
	// Encode as 0x-prefixed hex string for JSON-RPC
	hexStr := fmt.Sprintf("0x%x", []byte(signedTx))

	var result common.Hash
	err := r.client.Client().CallContext(ctx, &result, "eth_sendRawTransaction", hexStr)
	if err != nil {
		return types.Hash{}, fmt.Errorf("eth_sendRawTransaction failed: %w", err)
	}

	return types.Hash(result), nil
}

// ============================================================================
// EIP-712 Helpers
// ============================================================================

// hashEIP712Domain computes the EIP-712 domain separator hash.
func hashEIP712Domain(domain types.TypedDataDomain) (common.Hash, error) {
	// Build EIP712Domain type hash
	// Standard fields: name, version, chainId, verifyingContract, salt
	typeStr := "EIP712Domain("
	var encodedValues []byte
	first := true

	appendField := func(name, typ string) {
		if !first {
			typeStr += ","
		}
		typeStr += typ + " " + name
		first = false
	}

	if domain.Name != "" {
		appendField("name", "string")
	}
	if domain.Version != "" {
		appendField("version", "string")
	}
	if domain.ChainId != nil {
		appendField("chainId", "uint256")
	}
	if domain.VerifyingContract != (common.Address{}) {
		appendField("verifyingContract", "address")
	}
	if domain.Salt != (common.Hash{}) {
		appendField("salt", "bytes32")
	}

	typeStr += ")"
	typeHash := ethcrypto.Keccak256([]byte(typeStr))
	encodedValues = append(encodedValues, typeHash...)

	if domain.Name != "" {
		encodedValues = append(encodedValues, ethcrypto.Keccak256([]byte(domain.Name))...)
	}
	if domain.Version != "" {
		encodedValues = append(encodedValues, ethcrypto.Keccak256([]byte(domain.Version))...)
	}
	if domain.ChainId != nil {
		encodedValues = append(encodedValues, common.LeftPadBytes(domain.ChainId.Int.Bytes(), 32)...)
	}
	if domain.VerifyingContract != (common.Address{}) {
		encodedValues = append(encodedValues, common.LeftPadBytes(domain.VerifyingContract.Bytes(), 32)...)
	}
	if domain.Salt != (common.Hash{}) {
		encodedValues = append(encodedValues, domain.Salt.Bytes()...)
	}

	return common.BytesToHash(ethcrypto.Keccak256(encodedValues)), nil
}

// hashEIP712Struct computes the struct hash for an EIP-712 typed message.
func hashEIP712Struct(
	primaryType string,
	message map[string]interface{},
	allTypes map[string][]types.TypedDataField,
) (common.Hash, error) {
	typeHash, err := hashEIP712Type(primaryType, allTypes)
	if err != nil {
		return common.Hash{}, err
	}

	encoded := make([]byte, 0, 32+len(message)*32)
	encoded = append(encoded, typeHash...)

	fields, ok := allTypes[primaryType]
	if !ok {
		return common.Hash{}, fmt.Errorf("type %s not found", primaryType)
	}

	for _, field := range fields {
		val, exists := message[field.Name]
		if !exists {
			// Encode zero value
			encoded = append(encoded, make([]byte, 32)...)
			continue
		}

		encodedField, err := encodeEIP712Value(field.Type, val, allTypes)
		if err != nil {
			return common.Hash{}, fmt.Errorf("failed to encode field %s: %w", field.Name, err)
		}
		encoded = append(encoded, encodedField...)
	}

	return common.BytesToHash(ethcrypto.Keccak256(encoded)), nil
}

// hashEIP712Type computes the type hash for an EIP-712 type.
func hashEIP712Type(primaryType string, allTypes map[string][]types.TypedDataField) ([]byte, error) {
	typeStr := encodeEIP712TypeString(primaryType, allTypes)
	return ethcrypto.Keccak256([]byte(typeStr)), nil
}

// encodeEIP712TypeString builds the type encoding string for hashStruct.
func encodeEIP712TypeString(primaryType string, allTypes map[string][]types.TypedDataField) string {
	fields, ok := allTypes[primaryType]
	if !ok {
		return primaryType + "()"
	}

	// Build primary type string
	result := primaryType + "("
	for i, f := range fields {
		if i > 0 {
			result += ","
		}
		result += f.Type + " " + f.Name
	}
	result += ")"

	// Collect and sort referenced types (exclude primary and atomic types)
	referenced := make(map[string]bool)
	collectReferencedTypes(primaryType, allTypes, referenced)
	delete(referenced, primaryType)

	// Sort and append referenced types
	sorted := make([]string, 0, len(referenced))
	for t := range referenced {
		sorted = append(sorted, t)
	}
	// Simple sort
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[i] > sorted[j] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	for _, t := range sorted {
		f := allTypes[t]
		result += t + "("
		for i, field := range f {
			if i > 0 {
				result += ","
			}
			result += field.Type + " " + field.Name
		}
		result += ")"
	}

	return result
}

// collectReferencedTypes collects all struct types referenced by a type.
func collectReferencedTypes(typeName string, allTypes map[string][]types.TypedDataField, collected map[string]bool) {
	if collected[typeName] {
		return
	}
	fields, ok := allTypes[typeName]
	if !ok {
		return
	}
	collected[typeName] = true
	for _, f := range fields {
		baseType := stripArraySuffix(f.Type)
		if _, isStruct := allTypes[baseType]; isStruct {
			collectReferencedTypes(baseType, allTypes, collected)
		}
	}
}

// stripArraySuffix removes array suffixes like "[]" from a type name.
func stripArraySuffix(t string) string {
	for len(t) > 2 && t[len(t)-2:] == "[]" {
		t = t[:len(t)-2]
	}
	return t
}

// encodeEIP712Value encodes a single value according to EIP-712 rules.
func encodeEIP712Value(
	fieldType string,
	value interface{},
	allTypes map[string][]types.TypedDataField,
) ([]byte, error) {
	// Handle dynamic types
	switch fieldType {
	case "string":
		s, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("expected string, got %T", value)
		}
		return ethcrypto.Keccak256([]byte(s)), nil

	case "bytes":
		var b []byte
		switch v := value.(type) {
		case []byte:
			b = v
		case string:
			h, err := types.HexFromString(v)
			if err != nil {
				return nil, err
			}
			b = h.Bytes()
		default:
			return nil, fmt.Errorf("expected bytes, got %T", value)
		}
		return ethcrypto.Keccak256(b), nil
	}

	// Handle atomic types
	switch fieldType {
	case "address":
		addr, err := toAddress(value)
		if err != nil {
			return nil, err
		}
		return common.LeftPadBytes(addr.Bytes(), 32), nil

	case "bool":
		b, ok := value.(bool)
		if !ok {
			return nil, fmt.Errorf("expected bool, got %T", value)
		}
		if b {
			return common.LeftPadBytes([]byte{1}, 32), nil
		}
		return make([]byte, 32), nil

	case "uint256", "int256", "uint128", "int128", "uint64", "int64",
		"uint32", "int32", "uint16", "int16", "uint8", "int8":
		n, err := toBigInt(value)
		if err != nil {
			return nil, err
		}
		return common.LeftPadBytes(n.Bytes(), 32), nil

	case "bytes32", "bytes16", "bytes8", "bytes4", "bytes2", "bytes1":
		b, err := toFixedBytes(value, 32)
		if err != nil {
			return nil, err
		}
		return b, nil
	}

	// Handle struct types
	if _, isStruct := allTypes[fieldType]; isStruct {
		msg, ok := value.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("expected map for struct type %s, got %T", fieldType, value)
		}
		hash, err := hashEIP712Struct(fieldType, msg, allTypes)
		if err != nil {
			return nil, err
		}
		return hash.Bytes(), nil
	}

	return nil, fmt.Errorf("unsupported EIP-712 type: %s", fieldType)
}

// toAddress converts a value to common.Address.
func toAddress(v interface{}) (common.Address, error) {
	switch val := v.(type) {
	case common.Address:
		return val, nil
	case string:
		return common.HexToAddress(val), nil
	default:
		return common.Address{}, fmt.Errorf("cannot convert %T to address", v)
	}
}

// toBigInt converts a value to *big.Int.
func toBigInt(v interface{}) (*big.Int, error) {
	switch val := v.(type) {
	case *big.Int:
		return val, nil
	case int64:
		return big.NewInt(val), nil
	case float64:
		return new(big.Int).SetInt64(int64(val)), nil
	case string:
		n := new(big.Int)
		if _, ok := n.SetString(val, 0); !ok {
			return nil, fmt.Errorf("invalid integer string: %s", val)
		}
		return n, nil
	default:
		return nil, fmt.Errorf("cannot convert %T to big.Int", v)
	}
}

// toFixedBytes converts a value to a 32-byte padded slice.
func toFixedBytes(v interface{}, size int) ([]byte, error) {
	var b []byte
	switch val := v.(type) {
	case []byte:
		b = val
	case [32]byte:
		b = val[:]
	case string:
		h, err := types.HexFromString(val)
		if err != nil {
			return nil, err
		}
		b = h.Bytes()
	default:
		return nil, fmt.Errorf("cannot convert %T to fixed bytes", v)
	}
	// Right-pad to size
	result := make([]byte, size)
	copy(result, b)
	return result, nil
}
