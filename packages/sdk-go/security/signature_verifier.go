// Package security provides signature verification utilities.
//
// This module implements EIP-1271: Standard Signature Validation Method for Contracts.
// It supports verifying signatures from both EOA (Externally Owned Accounts) and
// smart contract accounts.
//
// See: https://eips.ethereum.org/EIPS/eip-1271
package security

import (
	"context"
	"fmt"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Constants
// ============================================================================

// EIP1271MagicValue is returned for valid signatures.
// bytes4(keccak256("isValidSignature(bytes32,bytes)"))
const EIP1271MagicValue = "0x1626ba7e"

// EIP1271InvalidValue is returned for invalid signatures.
const EIP1271InvalidValue = "0xffffffff"

// IsValidSignatureSelector is the EIP-1271 function selector.
const IsValidSignatureSelector = "0x1626ba7e"

// EIP1271ABI is the ABI for the isValidSignature function.
const EIP1271ABIString = `[{
	"name": "isValidSignature",
	"type": "function",
	"stateMutability": "view",
	"inputs": [
		{"name": "hash", "type": "bytes32"},
		{"name": "signature", "type": "bytes"}
	],
	"outputs": [
		{"name": "magicValue", "type": "bytes4"}
	]
}]`

// ============================================================================
// Types
// ============================================================================

// SignatureType classifies the type of signature.
type SignatureType string

const (
	// SignatureTypeEOA indicates an EOA signature.
	SignatureTypeEOA SignatureType = "eoa"
	// SignatureTypeContract indicates a contract signature (EIP-1271).
	SignatureTypeContract SignatureType = "contract"
	// SignatureTypeUnknown indicates an unknown signature type.
	SignatureTypeUnknown SignatureType = "unknown"
)

// SignatureVerificationResult contains the result of signature verification.
type SignatureVerificationResult struct {
	// IsValid indicates whether the signature is valid.
	IsValid bool `json:"isValid"`
	// SignatureType is the type of signature (EOA or contract).
	SignatureType SignatureType `json:"signatureType"`
	// Signer is the recovered/verified signer address.
	Signer *types.Address `json:"signer,omitempty"`
	// Error contains the error message if verification failed.
	Error string `json:"error,omitempty"`
	// Details contains additional verification details.
	Details *SignatureVerificationDetails `json:"details,omitempty"`
}

// SignatureVerificationDetails contains additional verification details.
type SignatureVerificationDetails struct {
	// IsContract indicates whether the signer is a contract.
	IsContract bool `json:"isContract"`
	// ReturnValue is the raw return value from contract (for EIP-1271).
	ReturnValue types.Hex `json:"returnValue,omitempty"`
}

// VerifySignatureOptions configures signature verification.
type VerifySignatureOptions struct {
	// EOAOnly forces EOA verification only.
	EOAOnly bool `json:"eoaOnly,omitempty"`
	// ContractOnly forces contract verification only.
	ContractOnly bool `json:"contractOnly,omitempty"`
}

// VerifyPersonalMessageParams contains parameters for personal message verification.
type VerifyPersonalMessageParams struct {
	// Message is the message that was signed (string).
	Message string
	// Signature is the signature.
	Signature types.Hex
	// Signer is the expected signer address.
	Signer types.Address
	// Options are verification options.
	Options *VerifySignatureOptions
}

// VerifyTypedDataParams contains parameters for typed data verification.
type VerifyTypedDataParams struct {
	// Domain is the EIP-712 domain.
	Domain TypedDataDomain
	// Types contains the type definitions.
	Types map[string][]TypedDataField
	// PrimaryType is the primary type name.
	PrimaryType string
	// Message contains the message data.
	Message map[string]any
	// Signature is the signature.
	Signature types.Hex
	// Signer is the expected signer address.
	Signer types.Address
	// Options are verification options.
	Options *VerifySignatureOptions
}

// VerifyHashParams contains parameters for raw hash verification.
type VerifyHashParams struct {
	// Hash is the hash that was signed.
	Hash types.Hex
	// Signature is the signature.
	Signature types.Hex
	// Signer is the expected signer address.
	Signer types.Address
	// Options are verification options.
	Options *VerifySignatureOptions
}

// ============================================================================
// Signature Verifier
// ============================================================================

// SignatureVerifier verifies signatures from EOAs and smart contracts.
//
// Supports:
//   - EOA signatures (ecrecover)
//   - Smart contract signatures (EIP-1271)
//   - Personal messages (EIP-191)
//   - Typed data (EIP-712)
type SignatureVerifier struct {
	client *ethclient.Client
	abi    abi.ABI
}

// NewSignatureVerifier creates a new signature verifier.
func NewSignatureVerifier(client *ethclient.Client) (*SignatureVerifier, error) {
	parsedABI, err := abi.JSON(strings.NewReader(EIP1271ABIString))
	if err != nil {
		return nil, fmt.Errorf("failed to parse EIP-1271 ABI: %w", err)
	}

	return &SignatureVerifier{
		client: client,
		abi:    parsedABI,
	}, nil
}

// IsContract checks if an address is a contract.
func (v *SignatureVerifier) IsContract(ctx context.Context, address types.Address) (bool, error) {
	code, err := v.client.CodeAt(ctx, address, nil)
	if err != nil {
		return false, err
	}
	return len(code) > 0, nil
}

// VerifyPersonalMessage verifies a personal message signature (EIP-191).
func (v *SignatureVerifier) VerifyPersonalMessage(ctx context.Context, params VerifyPersonalMessageParams) (*SignatureVerificationResult, error) {
	// Validate signer address
	if params.Signer == (types.Address{}) {
		return &SignatureVerificationResult{
			IsValid:       false,
			SignatureType: SignatureTypeUnknown,
			Error:         "Invalid signer address",
		}, nil
	}

	// Check if signer is a contract
	isSignerContract, err := v.IsContract(ctx, params.Signer)
	if err != nil {
		return nil, fmt.Errorf("failed to check if signer is contract: %w", err)
	}

	options := params.Options
	if options == nil {
		options = &VerifySignatureOptions{}
	}

	// If contract-only is requested but signer is EOA
	if options.ContractOnly && !isSignerContract {
		return &SignatureVerificationResult{
			IsValid:       false,
			SignatureType: SignatureTypeEOA,
			Signer:        &params.Signer,
			Error:         "Expected contract signer but found EOA",
			Details:       &SignatureVerificationDetails{IsContract: false},
		}, nil
	}

	// If EOA-only is requested but signer is contract
	if options.EOAOnly && isSignerContract {
		return &SignatureVerificationResult{
			IsValid:       false,
			SignatureType: SignatureTypeContract,
			Signer:        &params.Signer,
			Error:         "Expected EOA signer but found contract",
			Details:       &SignatureVerificationDetails{IsContract: true},
		}, nil
	}

	// Try EOA verification first (unless contract-only)
	if !options.ContractOnly {
		hash := hashPersonalMessage(params.Message)
		recoveredAddr, err := recoverAddress(hash, params.Signature)
		if err == nil && recoveredAddr == params.Signer {
			return &SignatureVerificationResult{
				IsValid:       true,
				SignatureType: SignatureTypeEOA,
				Signer:        &params.Signer,
				Details:       &SignatureVerificationDetails{IsContract: isSignerContract},
			}, nil
		}
	}

	// Try contract verification (EIP-1271)
	if isSignerContract && !options.EOAOnly {
		hash := hashPersonalMessage(params.Message)
		return v.verifyContractSignature(ctx, params.Signer, hash, params.Signature)
	}

	return &SignatureVerificationResult{
		IsValid:       false,
		SignatureType: signatureTypeFromContract(isSignerContract),
		Signer:        &params.Signer,
		Error:         "Signature verification failed",
		Details:       &SignatureVerificationDetails{IsContract: isSignerContract},
	}, nil
}

// VerifyTypedData verifies a typed data signature (EIP-712).
func (v *SignatureVerifier) VerifyTypedData(ctx context.Context, params VerifyTypedDataParams) (*SignatureVerificationResult, error) {
	// Validate signer address
	if params.Signer == (types.Address{}) {
		return &SignatureVerificationResult{
			IsValid:       false,
			SignatureType: SignatureTypeUnknown,
			Error:         "Invalid signer address",
		}, nil
	}

	// Check if signer is a contract
	isSignerContract, err := v.IsContract(ctx, params.Signer)
	if err != nil {
		return nil, fmt.Errorf("failed to check if signer is contract: %w", err)
	}

	options := params.Options
	if options == nil {
		options = &VerifySignatureOptions{}
	}

	// If contract-only is requested but signer is EOA
	if options.ContractOnly && !isSignerContract {
		return &SignatureVerificationResult{
			IsValid:       false,
			SignatureType: SignatureTypeEOA,
			Signer:        &params.Signer,
			Error:         "Expected contract signer but found EOA",
			Details:       &SignatureVerificationDetails{IsContract: false},
		}, nil
	}

	// Compute the typed data hash
	typedData := TypedData{
		Types:       params.Types,
		PrimaryType: params.PrimaryType,
		Domain:      params.Domain,
		Message:     params.Message,
	}
	hash, err := hashTypedData(typedData)
	if err != nil {
		return nil, fmt.Errorf("failed to hash typed data: %w", err)
	}

	// Try EOA verification first (unless contract-only)
	if !options.ContractOnly {
		recoveredAddr, err := recoverAddress(hash, params.Signature)
		if err == nil && recoveredAddr == params.Signer {
			return &SignatureVerificationResult{
				IsValid:       true,
				SignatureType: SignatureTypeEOA,
				Signer:        &params.Signer,
				Details:       &SignatureVerificationDetails{IsContract: isSignerContract},
			}, nil
		}
	}

	// Try contract verification (EIP-1271)
	if isSignerContract && !options.EOAOnly {
		return v.verifyContractSignature(ctx, params.Signer, hash, params.Signature)
	}

	return &SignatureVerificationResult{
		IsValid:       false,
		SignatureType: signatureTypeFromContract(isSignerContract),
		Signer:        &params.Signer,
		Error:         "Signature verification failed",
		Details:       &SignatureVerificationDetails{IsContract: isSignerContract},
	}, nil
}

// VerifyHash verifies a raw hash signature.
func (v *SignatureVerifier) VerifyHash(ctx context.Context, params VerifyHashParams) (*SignatureVerificationResult, error) {
	// Validate signer address
	if params.Signer == (types.Address{}) {
		return &SignatureVerificationResult{
			IsValid:       false,
			SignatureType: SignatureTypeUnknown,
			Error:         "Invalid signer address",
		}, nil
	}

	// Check if signer is a contract
	isSignerContract, err := v.IsContract(ctx, params.Signer)
	if err != nil {
		return nil, fmt.Errorf("failed to check if signer is contract: %w", err)
	}

	options := params.Options
	if options == nil {
		options = &VerifySignatureOptions{}
	}

	// Contract signature verification (EIP-1271)
	if isSignerContract && !options.EOAOnly {
		hash := [32]byte{}
		copy(hash[:], params.Hash)
		return v.verifyContractSignature(ctx, params.Signer, hash[:], params.Signature)
	}

	// For EOA, try to recover the address
	if !options.ContractOnly {
		hash := [32]byte{}
		copy(hash[:], params.Hash)
		recoveredAddr, err := recoverAddress(hash[:], params.Signature)
		if err == nil && recoveredAddr == params.Signer {
			return &SignatureVerificationResult{
				IsValid:       true,
				SignatureType: SignatureTypeEOA,
				Signer:        &params.Signer,
				Details:       &SignatureVerificationDetails{IsContract: false},
			}, nil
		}
	}

	return &SignatureVerificationResult{
		IsValid:       false,
		SignatureType: SignatureTypeEOA,
		Signer:        &params.Signer,
		Error:         "Cannot verify raw hash for EOA without original message",
		Details:       &SignatureVerificationDetails{IsContract: false},
	}, nil
}

// verifyContractSignature verifies a signature using EIP-1271 contract call.
func (v *SignatureVerifier) verifyContractSignature(ctx context.Context, contractAddress types.Address, hash []byte, signature types.Hex) (*SignatureVerificationResult, error) {
	// Prepare the call data
	hashBytes := [32]byte{}
	copy(hashBytes[:], hash)

	callData, err := v.abi.Pack("isValidSignature", hashBytes, []byte(signature))
	if err != nil {
		return nil, fmt.Errorf("failed to pack call data: %w", err)
	}

	// Make the call
	msg := ethereum.CallMsg{
		To:   &contractAddress,
		Data: callData,
	}

	result, err := v.client.CallContract(ctx, msg, nil)
	if err != nil {
		return &SignatureVerificationResult{
			IsValid:       false,
			SignatureType: SignatureTypeContract,
			Signer:        &contractAddress,
			Error:         fmt.Sprintf("EIP-1271 verification failed: %s", err.Error()),
			Details:       &SignatureVerificationDetails{IsContract: true},
		}, nil
	}

	// Parse the result
	returnValue := types.Hex(result)
	isValid := len(result) >= 4 && fmt.Sprintf("0x%x", result[:4]) == EIP1271MagicValue

	return &SignatureVerificationResult{
		IsValid:       isValid,
		SignatureType: SignatureTypeContract,
		Signer:        &contractAddress,
		Details: &SignatureVerificationDetails{
			IsContract:  true,
			ReturnValue: returnValue,
		},
	}, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// hashPersonalMessage hashes a message with the Ethereum Signed Message prefix (EIP-191).
func hashPersonalMessage(message string) []byte {
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(message))
	data := append([]byte(prefix), []byte(message)...)
	return crypto.Keccak256(data)
}

// recoverAddress recovers the signer address from a hash and signature.
func recoverAddress(hash []byte, signature types.Hex) (types.Address, error) {
	if len(signature) != 65 {
		return types.Address{}, fmt.Errorf("invalid signature length: expected 65, got %d", len(signature))
	}

	sig := make([]byte, 65)
	copy(sig, signature)

	// Adjust v value if needed (Ethereum uses 27/28, go-ethereum uses 0/1)
	if sig[64] >= 27 {
		sig[64] -= 27
	}

	pubKey, err := crypto.Ecrecover(hash, sig)
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to recover public key: %w", err)
	}

	if len(pubKey) == 0 {
		return types.Address{}, fmt.Errorf("empty public key recovered")
	}

	pubKeyECDSA, err := crypto.UnmarshalPubkey(pubKey)
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to unmarshal public key: %w", err)
	}

	return crypto.PubkeyToAddress(*pubKeyECDSA), nil
}

// hashTypedData computes the EIP-712 hash of typed data.
func hashTypedData(data TypedData) ([]byte, error) {
	// Compute domain separator
	domainSeparator, err := computeDomainSeparator(data.Domain)
	if err != nil {
		return nil, err
	}

	// Compute struct hash
	structHash, err := computeStructHash(data.Types, data.PrimaryType, data.Message)
	if err != nil {
		return nil, err
	}

	// Combine with EIP-712 prefix
	hashData := make([]byte, 66)
	hashData[0] = 0x19
	hashData[1] = 0x01
	copy(hashData[2:34], domainSeparator)
	copy(hashData[34:66], structHash)

	return crypto.Keccak256(hashData), nil
}

// computeDomainSeparator computes the EIP-712 domain separator.
func computeDomainSeparator(domain TypedDataDomain) ([]byte, error) {
	// Domain type hash
	domainTypeHash := crypto.Keccak256([]byte("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"))

	// Encode domain fields
	data := make([]byte, 0, 160)
	data = append(data, domainTypeHash...)
	data = append(data, crypto.Keccak256([]byte(domain.Name))...)
	data = append(data, crypto.Keccak256([]byte(domain.Version))...)

	// ChainID
	chainIDBytes := make([]byte, 32)
	if domain.ChainID != nil {
		switch v := domain.ChainID.(type) {
		case int:
			chainIDBytes[31] = byte(v)
		case int64:
			for i := 0; i < 8; i++ {
				chainIDBytes[31-i] = byte(v >> (8 * i))
			}
		case string:
			// Handle hex string
			if len(v) > 2 && v[:2] == "0x" {
				addr := common.HexToHash(v)
				copy(chainIDBytes, addr[:])
			}
		}
	}
	data = append(data, chainIDBytes...)

	// Verifying contract
	contractBytes := make([]byte, 32)
	if domain.VerifyingContract != "" {
		addr := common.HexToAddress(domain.VerifyingContract)
		copy(contractBytes[12:], addr[:])
	}
	data = append(data, contractBytes...)

	return crypto.Keccak256(data), nil
}

// computeStructHash computes the struct hash for EIP-712.
func computeStructHash(types map[string][]TypedDataField, primaryType string, message map[string]any) ([]byte, error) {
	// Build type hash
	typeString := encodeType(types, primaryType)
	typeHash := crypto.Keccak256([]byte(typeString))

	// Encode values
	data := make([]byte, 0, 32*(1+len(message)))
	data = append(data, typeHash...)

	fields, ok := types[primaryType]
	if !ok {
		return nil, fmt.Errorf("type %s not found", primaryType)
	}

	for _, field := range fields {
		value, exists := message[field.Name]
		if !exists {
			value = nil
		}

		encoded, err := encodeValue(types, field.Type, value)
		if err != nil {
			return nil, err
		}
		data = append(data, encoded...)
	}

	return crypto.Keccak256(data), nil
}

// encodeType encodes a type string for EIP-712.
func encodeType(types map[string][]TypedDataField, primaryType string) string {
	result := primaryType + "("
	fields := types[primaryType]
	for i, field := range fields {
		if i > 0 {
			result += ","
		}
		result += field.Type + " " + field.Name
	}
	result += ")"
	return result
}

// encodeValue encodes a value for EIP-712.
func encodeValue(_ map[string][]TypedDataField, typeName string, value any) ([]byte, error) {
	result := make([]byte, 32)

	switch typeName {
	case "string":
		if s, ok := value.(string); ok {
			hash := crypto.Keccak256([]byte(s))
			copy(result, hash)
		}
	case "bytes":
		if b, ok := value.([]byte); ok {
			hash := crypto.Keccak256(b)
			copy(result, hash)
		}
	case "address":
		if s, ok := value.(string); ok {
			addr := common.HexToAddress(s)
			copy(result[12:], addr[:])
		}
	case "bool":
		if b, ok := value.(bool); ok && b {
			result[31] = 1
		}
	case "uint256", "int256":
		if s, ok := value.(string); ok {
			hash := common.HexToHash(s)
			copy(result, hash[:])
		}
	default:
		// For other types, use zero bytes
	}

	return result, nil
}

// signatureTypeFromContract returns the signature type based on whether the signer is a contract.
func signatureTypeFromContract(isContract bool) SignatureType {
	if isContract {
		return SignatureTypeContract
	}
	return SignatureTypeEOA
}

// ============================================================================
// Standalone Utility Functions
// ============================================================================

// IsEIP1271MagicValue checks if a bytes4 value is the EIP-1271 magic value.
func IsEIP1271MagicValue(value types.Hex) bool {
	if len(value) < 4 {
		return false
	}
	return fmt.Sprintf("0x%x", value[:4]) == EIP1271MagicValue
}

// EncodeIsValidSignatureCall encodes isValidSignature call data.
func EncodeIsValidSignatureCall(hash types.Hex, signature types.Hex) (types.Hex, error) {
	parsedABI, err := abi.JSON(strings.NewReader(EIP1271ABIString))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	hashBytes := [32]byte{}
	copy(hashBytes[:], hash)

	data, err := parsedABI.Pack("isValidSignature", hashBytes, []byte(signature))
	if err != nil {
		return nil, fmt.Errorf("failed to pack call data: %w", err)
	}

	return types.Hex(data), nil
}

// DecodeIsValidSignatureResult decodes isValidSignature result.
func DecodeIsValidSignatureResult(data types.Hex) (isValid bool, magicValue types.Hex) {
	if len(data) < 4 {
		return false, nil
	}
	magicValue = types.Hex(data[:4])
	isValid = IsEIP1271MagicValue(magicValue)
	return isValid, magicValue
}
