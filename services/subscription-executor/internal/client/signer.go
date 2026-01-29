package client

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	dcrsecp "github.com/decred/dcrd/dcrec/secp256k1/v4"
	dcrecdsa "github.com/decred/dcrd/dcrec/secp256k1/v4/ecdsa"
	"golang.org/x/crypto/sha3"
)

// UserOpSigner signs ERC-4337 UserOperations using ECDSA on secp256k1.
type UserOpSigner struct {
	privateKey *dcrsecp.PrivateKey
	address    string
	chainID    *big.Int
	entryPoint string
}

// NewUserOpSigner creates a new UserOp signer from a hex-encoded private key.
func NewUserOpSigner(privateKeyHex string, chainID int64, entryPoint string) (*UserOpSigner, error) {
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")
	if len(privateKeyHex) != 64 {
		return nil, fmt.Errorf("invalid private key length: expected 64 hex chars, got %d", len(privateKeyHex))
	}

	keyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode private key hex: %w", err)
	}

	privKey := dcrsecp.PrivKeyFromBytes(keyBytes)
	if privKey == nil {
		return nil, fmt.Errorf("failed to parse private key")
	}

	// Validate non-zero key
	if privKey.Key.IsZero() {
		return nil, fmt.Errorf("private key is zero")
	}

	address := pubKeyToAddress(privKey.PubKey())

	return &UserOpSigner{
		privateKey: privKey,
		address:    address,
		chainID:    big.NewInt(chainID),
		entryPoint: entryPoint,
	}, nil
}

// SignUserOp signs a PackedUserOperation and returns the hex-encoded signature.
// Follows ERC-4337 v0.7 signature scheme:
//
//	userOpHash = keccak256(abi.encode(
//	    keccak256(pack(sender, nonce, hashInitCode, hashCallData,
//	                    accountGasLimits, preVerificationGas, gasFees, hashPaymasterAndData)),
//	    entryPoint,
//	    chainId
//	))
func (s *UserOpSigner) SignUserOp(userOp *PackedUserOperation) (string, error) {
	hash, err := s.computeUserOpHash(userOp)
	if err != nil {
		return "", fmt.Errorf("failed to compute userOp hash: %w", err)
	}

	// Sign the hash with Ethereum prefix: "\x19Ethereum Signed Message:\n32" + hash
	ethHash := ethSignHash(hash)

	sig, err := signCompact(ethHash, s.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign: %w", err)
	}

	return "0x" + hex.EncodeToString(sig), nil
}

// GetAddress returns the signer's Ethereum address.
func (s *UserOpSigner) GetAddress() string {
	return s.address
}

// computeUserOpHash computes the ERC-4337 v0.7 UserOperation hash.
func (s *UserOpSigner) computeUserOpHash(userOp *PackedUserOperation) ([]byte, error) {
	senderBytes, err := hexToBytes32(userOp.Sender)
	if err != nil {
		return nil, fmt.Errorf("invalid sender: %w", err)
	}

	nonceBytes, err := hexToPadded32(userOp.Nonce)
	if err != nil {
		return nil, fmt.Errorf("invalid nonce: %w", err)
	}

	initCodeHash := keccak256(mustHexDecode(userOp.InitCode))
	callDataHash := keccak256(mustHexDecode(userOp.CallData))

	accountGasLimitsBytes, err := hexToPadded32(userOp.AccountGasLimits)
	if err != nil {
		return nil, fmt.Errorf("invalid accountGasLimits: %w", err)
	}

	preVerificationGasBytes, err := hexToPadded32(userOp.PreVerificationGas)
	if err != nil {
		return nil, fmt.Errorf("invalid preVerificationGas: %w", err)
	}

	gasFeesBytes, err := hexToPadded32(userOp.GasFees)
	if err != nil {
		return nil, fmt.Errorf("invalid gasFees: %w", err)
	}

	paymasterAndDataHash := keccak256(mustHexDecode(userOp.PaymasterAndData))

	// Inner hash: keccak256(pack(sender, nonce, hashInitCode, hashCallData,
	//                           accountGasLimits, preVerificationGas, gasFees, hashPaymasterAndData))
	var innerPack []byte
	innerPack = append(innerPack, senderBytes...)
	innerPack = append(innerPack, nonceBytes...)
	innerPack = append(innerPack, initCodeHash...)
	innerPack = append(innerPack, callDataHash...)
	innerPack = append(innerPack, accountGasLimitsBytes...)
	innerPack = append(innerPack, preVerificationGasBytes...)
	innerPack = append(innerPack, gasFeesBytes...)
	innerPack = append(innerPack, paymasterAndDataHash...)

	innerHash := keccak256(innerPack)

	// Outer hash: keccak256(abi.encode(innerHash, entryPoint, chainId))
	entryPointBytes, err := hexToBytes32(s.entryPoint)
	if err != nil {
		return nil, fmt.Errorf("invalid entryPoint: %w", err)
	}

	chainIDBytes := make([]byte, 32)
	s.chainID.FillBytes(chainIDBytes)

	var outerPack []byte
	outerPack = append(outerPack, innerHash...)
	outerPack = append(outerPack, entryPointBytes...)
	outerPack = append(outerPack, chainIDBytes...)

	return keccak256(outerPack), nil
}

// signCompact signs a 32-byte hash and returns a 65-byte [R || S || V] signature.
// V is 27 or 28, compatible with Ethereum's ecrecover.
func signCompact(hash []byte, key *dcrsecp.PrivateKey) ([]byte, error) {
	if len(hash) != 32 {
		return nil, fmt.Errorf("hash must be 32 bytes, got %d", len(hash))
	}

	// SignCompact returns [V || R || S] (65 bytes, V is 0-3 recovery flag)
	compactSig := dcrecdsa.SignCompact(key, hash, false)

	// compactSig: [recovery (1 byte)] [R (32 bytes)] [S (32 bytes)]
	// Ethereum expects: [R (32 bytes)] [S (32 bytes)] [V (1 byte)] where V = recovery + 27
	ethSig := make([]byte, 65)
	copy(ethSig[0:32], compactSig[1:33])  // R
	copy(ethSig[32:64], compactSig[33:65]) // S
	ethSig[64] = compactSig[0] - 27 + 27  // V (normalize: dcrd uses 27-30, Ethereum uses 27-28)

	return ethSig, nil
}

// pubKeyToAddress derives the Ethereum address from a secp256k1 public key.
func pubKeyToAddress(pub *dcrsecp.PublicKey) string {
	// Uncompressed public key bytes (without 04 prefix): X || Y, each 32 bytes
	pubBytes := pub.SerializeUncompressed()
	// SerializeUncompressed returns [0x04 || X(32) || Y(32)] = 65 bytes
	// For keccak256 we need just X || Y (64 bytes)
	hash := keccak256(pubBytes[1:])
	// Take last 20 bytes
	return "0x" + hex.EncodeToString(hash[12:])
}

// keccak256 computes the Keccak-256 hash.
func keccak256(data []byte) []byte {
	h := sha3.NewLegacyKeccak256()
	h.Write(data)
	return h.Sum(nil)
}

// ethSignHash applies the Ethereum Signed Message prefix.
func ethSignHash(hash []byte) []byte {
	prefix := []byte("\x19Ethereum Signed Message:\n32")
	var msg []byte
	msg = append(msg, prefix...)
	msg = append(msg, hash...)
	return keccak256(msg)
}

// hexToBytes32 converts a hex address to a 32-byte left-padded ABI encoding.
func hexToBytes32(hexStr string) ([]byte, error) {
	hexStr = strings.TrimPrefix(hexStr, "0x")
	b, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, err
	}
	result := make([]byte, 32)
	copy(result[32-len(b):], b)
	return result, nil
}

// hexToPadded32 converts a hex number to a 32-byte big-endian representation.
func hexToPadded32(hexStr string) ([]byte, error) {
	hexStr = strings.TrimPrefix(hexStr, "0x")
	if hexStr == "" {
		return make([]byte, 32), nil
	}
	n := new(big.Int)
	if _, ok := n.SetString(hexStr, 16); !ok {
		return nil, fmt.Errorf("invalid hex number: %s", hexStr)
	}
	result := make([]byte, 32)
	n.FillBytes(result)
	return result, nil
}

// mustHexDecode decodes hex, returning empty bytes for "0x" or empty input.
// Panics if the hex string is invalid (use tryHexDecode for error handling).
func mustHexDecode(hexStr string) []byte {
	hexStr = strings.TrimPrefix(hexStr, "0x")
	if hexStr == "" {
		return []byte{}
	}
	b, err := hex.DecodeString(hexStr)
	if err != nil {
		panic(fmt.Sprintf("mustHexDecode: invalid hex string %q: %v", hexStr, err))
	}
	return b
}

// tryHexDecode attempts to decode a hex string, returning an error if invalid.
func tryHexDecode(hexStr string) ([]byte, error) {
	hexStr = strings.TrimPrefix(hexStr, "0x")
	if hexStr == "" {
		return []byte{}, nil
	}
	return hex.DecodeString(hexStr)
}
