package eip7702

import (
	"bytes"
	"fmt"
	"math/big"
	"regexp"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/rlp"

	"github.com/stablenet/sdk-go/types"
)

// CreateAuthorizationHash creates the authorization hash according to EIP-7702.
// Hash = keccak256(0x05 || rlp([chainId, address, nonce]))
func CreateAuthorizationHash(auth Authorization) (types.Hash, error) {
	// Prepare values for RLP encoding
	chainId := auth.ChainId
	if chainId == nil {
		chainId = big.NewInt(0)
	}

	nonce := auth.Nonce
	if nonce == nil {
		nonce = big.NewInt(0)
	}

	// RLP encode [chainId, address, nonce]
	encoded, err := rlp.EncodeToBytes([]interface{}{
		chainId,
		auth.Address,
		nonce,
	})
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to RLP encode authorization: %w", err)
	}

	// Prepend magic byte (0x05)
	prefixed := make([]byte, 1+len(encoded))
	prefixed[0] = EIP7702Magic
	copy(prefixed[1:], encoded)

	// Hash the prefixed data
	hash := crypto.Keccak256Hash(prefixed)

	return types.Hash(hash), nil
}

// CreateAuthorization creates an authorization structure.
func CreateAuthorization(chainId *big.Int, delegateAddress types.Address, nonce *big.Int) Authorization {
	return Authorization{
		ChainId: chainId,
		Address: delegateAddress,
		Nonce:   nonce,
	}
}

// CreateRevocationAuthorization creates an authorization that revokes delegation.
// This is done by delegating to the zero address.
func CreateRevocationAuthorization(chainId *big.Int, nonce *big.Int) Authorization {
	return CreateAuthorization(chainId, ZeroAddress, nonce)
}

// ParseSignature parses a 65-byte ECDSA signature into v, r, s components.
// The signature format is: r (32 bytes) || s (32 bytes) || v (1 byte)
func ParseSignature(signature types.Hex) (*ParsedSignature, error) {
	if len(signature) < 65 {
		return nil, fmt.Errorf("signature too short: expected 65 bytes, got %d", len(signature))
	}

	sigBytes := signature.Bytes()

	var r, s types.Hash
	copy(r[:], sigBytes[0:32])
	copy(s[:], sigBytes[32:64])

	v := sigBytes[64]

	// Normalize V value to 0 or 1 for EIP-7702
	// Ethereum legacy uses 27/28, EIP-155 uses chainId*2 + 35/36
	if v >= 27 {
		v -= 27
	}

	return &ParsedSignature{
		V: v,
		R: r,
		S: s,
	}, nil
}

// CreateSignedAuthorization creates a signed authorization from an authorization and signature.
func CreateSignedAuthorization(auth Authorization, signature types.Hex) (*SignedAuthorization, error) {
	parsed, err := ParseSignature(signature)
	if err != nil {
		return nil, fmt.Errorf("failed to parse signature: %w", err)
	}

	return &SignedAuthorization{
		Authorization: auth,
		V:             parsed.V,
		R:             parsed.R,
		S:             parsed.S,
	}, nil
}

// IsDelegatedAccount checks if an account has EIP-7702 delegation.
// Delegated accounts have bytecode starting with 0xef0100 + 20 bytes address.
func IsDelegatedAccount(code types.Hex) bool {
	if len(code) < DelegationBytecodeLength {
		return false
	}

	return bytes.HasPrefix(code.Bytes(), DelegationPrefix.Bytes())
}

// ExtractDelegateAddress extracts the delegate address from EIP-7702 delegated account bytecode.
// Returns nil if the account is not delegated.
func ExtractDelegateAddress(code types.Hex) *types.Address {
	if !IsDelegatedAccount(code) {
		return nil
	}

	// Extract 20 bytes after the 0xef0100 prefix
	addressBytes := code.Bytes()[3:23]
	address := common.BytesToAddress(addressBytes)

	return (*types.Address)(&address)
}

// GetDelegationStatus returns the delegation status of an account.
func GetDelegationStatus(code types.Hex) *DelegationStatus {
	isDelegated := IsDelegatedAccount(code)
	delegateAddress := ExtractDelegateAddress(code)

	return &DelegationStatus{
		IsDelegated:     isDelegated,
		DelegateAddress: delegateAddress,
		Code:            code,
	}
}

// IsValidAddress validates if a string is a valid Ethereum address.
func IsValidAddress(address string) bool {
	matched, _ := regexp.MatchString(`^0x[a-fA-F0-9]{40}$`, address)
	return matched
}

// IsRevocationAuthorization checks if an authorization is for revocation.
// A revocation authorization delegates to the zero address.
func IsRevocationAuthorization(auth Authorization) bool {
	return auth.Address == ZeroAddress
}

// FormatAuthorization returns a human-readable string representation of an authorization.
func FormatAuthorization(auth Authorization) string {
	chainId := "0"
	if auth.ChainId != nil {
		chainId = auth.ChainId.String()
	}

	nonce := "0"
	if auth.Nonce != nil {
		nonce = auth.Nonce.String()
	}

	return fmt.Sprintf("chainId: %s, delegate: %s, nonce: %s",
		chainId,
		auth.Address.Hex(),
		nonce,
	)
}

// EncodeSignedAuthorization encodes a signed authorization for transaction inclusion.
// Returns the RLP-encoded signed authorization.
func EncodeSignedAuthorization(signedAuth *SignedAuthorization) (types.Hex, error) {
	chainId := signedAuth.ChainId
	if chainId == nil {
		chainId = big.NewInt(0)
	}

	nonce := signedAuth.Nonce
	if nonce == nil {
		nonce = big.NewInt(0)
	}

	// Convert v, r, s to big.Int for RLP encoding
	vBig := big.NewInt(int64(signedAuth.V))
	rBig := new(big.Int).SetBytes(signedAuth.R[:])
	sBig := new(big.Int).SetBytes(signedAuth.S[:])

	// RLP encode [chainId, address, nonce, v, r, s]
	encoded, err := rlp.EncodeToBytes([]interface{}{
		chainId,
		signedAuth.Address,
		nonce,
		vBig,
		rBig,
		sBig,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to RLP encode signed authorization: %w", err)
	}

	return types.Hex(encoded), nil
}

// DecodeSignedAuthorization decodes an RLP-encoded signed authorization.
func DecodeSignedAuthorization(encoded types.Hex) (*SignedAuthorization, error) {
	var decoded []interface{}
	if err := rlp.DecodeBytes(encoded.Bytes(), &decoded); err != nil {
		return nil, fmt.Errorf("failed to RLP decode signed authorization: %w", err)
	}

	if len(decoded) < 6 {
		return nil, fmt.Errorf("invalid signed authorization: expected 6 fields, got %d", len(decoded))
	}

	chainId, ok := decoded[0].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid chainId type")
	}

	addressBytes, ok := decoded[1].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid address type")
	}
	address := common.BytesToAddress(addressBytes)

	nonce, ok := decoded[2].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid nonce type")
	}

	vBig, ok := decoded[3].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid v type")
	}

	rBytes, ok := decoded[4].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid r type")
	}
	var r types.Hash
	copy(r[32-len(rBytes):], rBytes)

	sBytes, ok := decoded[5].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid s type")
	}
	var s types.Hash
	copy(s[32-len(sBytes):], sBytes)

	return &SignedAuthorization{
		Authorization: Authorization{
			ChainId: chainId,
			Address: address,
			Nonce:   nonce,
		},
		V: uint8(vBig.Uint64()),
		R: r,
		S: s,
	}, nil
}

// ValidateAuthorization validates an authorization structure.
func ValidateAuthorization(auth Authorization) error {
	// ChainId must be non-negative
	if auth.ChainId != nil && auth.ChainId.Sign() < 0 {
		return fmt.Errorf("chainId must be non-negative")
	}

	// Address must be valid (but can be zero for revocation)
	if !IsValidAddress(strings.ToLower(auth.Address.Hex())) {
		return fmt.Errorf("invalid delegate address")
	}

	// Nonce must be non-negative
	if auth.Nonce != nil && auth.Nonce.Sign() < 0 {
		return fmt.Errorf("nonce must be non-negative")
	}

	return nil
}

// RecoverSigner recovers the signer address from a signed authorization.
func RecoverSigner(signedAuth *SignedAuthorization) (types.Address, error) {
	// Recreate the authorization hash
	hash, err := CreateAuthorizationHash(signedAuth.Authorization)
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to create authorization hash: %w", err)
	}

	// Reconstruct the signature bytes
	sig := make([]byte, 65)
	copy(sig[0:32], signedAuth.R[:])
	copy(sig[32:64], signedAuth.S[:])
	sig[64] = signedAuth.V

	// Recover the public key
	pubKey, err := crypto.SigToPub(hash[:], sig)
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to recover public key: %w", err)
	}

	// Get the address from the public key
	address := crypto.PubkeyToAddress(*pubKey)

	return types.Address(address), nil
}

// ============================================================================
// EIP-4337 v0.9 initCode 0x7702 Detection
// ============================================================================

// IsEIP7702InitCode checks if initCode uses the EIP-7702 path.
//
// Per EIP-4337 v0.9, when initCode starts with address 0x...7702
// (right-padded to 20 bytes), the EntryPoint skips factory deployment
// and uses EIP-7702 authorization verification instead.
func IsEIP7702InitCode(initCode []byte) bool {
	if len(initCode) < 20 {
		return false
	}
	return bytes.Equal(initCode[:20], EIP7702InitCodeAddress.Bytes())
}

// EIP7702InitCodeResult contains parsed EIP-7702 initCode components.
type EIP7702InitCodeResult struct {
	// IsEIP7702 indicates the initCode uses EIP-7702 path.
	IsEIP7702 bool
	// InitData contains initialization data (bytes after the 20-byte address).
	// Empty if initCode is exactly 20 bytes.
	InitData []byte
}

// ParseEIP7702InitCode parses EIP-7702 initCode into its components.
//
// If initCode > 20 bytes, the remaining bytes are initialization data
// to be called via senderCreator.
func ParseEIP7702InitCode(initCode []byte) *EIP7702InitCodeResult {
	if !IsEIP7702InitCode(initCode) {
		return nil
	}

	var initData []byte
	if len(initCode) > 20 {
		initData = make([]byte, len(initCode)-20)
		copy(initData, initCode[20:])
	}

	return &EIP7702InitCodeResult{
		IsEIP7702: true,
		InitData:  initData,
	}
}
