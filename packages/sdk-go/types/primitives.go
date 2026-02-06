// Package types provides core type definitions for the StableNet SDK.
// These types are designed to be portable across implementations (TypeScript, Go, Rust).
package types

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

// Address represents an Ethereum address (20 bytes).
// Uses go-ethereum's common.Address for compatibility.
type Address = common.Address

// Hash represents a 32-byte hash (keccak256 output).
type Hash = common.Hash

// Hex represents arbitrary hex-encoded data.
type Hex []byte

// HexFromString converts a hex string (with or without 0x prefix) to Hex.
func HexFromString(s string) (Hex, error) {
	s = strings.TrimPrefix(s, "0x")
	data, err := hex.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("invalid hex string: %w", err)
	}
	return Hex(data), nil
}

// MustHexFromString converts a hex string to Hex, panicking on error.
func MustHexFromString(s string) Hex {
	h, err := HexFromString(s)
	if err != nil {
		panic(err)
	}
	return h
}

// String returns the hex string representation with 0x prefix.
func (h Hex) String() string {
	return "0x" + hex.EncodeToString(h)
}

// Bytes returns the underlying byte slice.
func (h Hex) Bytes() []byte {
	return []byte(h)
}

// BigInt is a convenience wrapper for *big.Int with JSON marshaling support.
type BigInt struct {
	*big.Int
}

// NewBigInt creates a new BigInt from an int64.
func NewBigInt(v int64) *BigInt {
	return &BigInt{Int: big.NewInt(v)}
}

// NewBigIntFromString creates a BigInt from a decimal string.
func NewBigIntFromString(s string) (*BigInt, bool) {
	i, ok := new(big.Int).SetString(s, 10)
	if !ok {
		return nil, false
	}
	return &BigInt{Int: i}, true
}

// ZeroAddress is the zero address (0x0000...0000).
var ZeroAddress = common.Address{}

// IsZeroAddress checks if an address is the zero address.
func IsZeroAddress(addr Address) bool {
	return addr == ZeroAddress
}

// AddressFromHex converts a hex string to an Address.
func AddressFromHex(s string) (Address, error) {
	if !common.IsHexAddress(s) {
		return Address{}, fmt.Errorf("invalid address: %s", s)
	}
	return common.HexToAddress(s), nil
}

// MustAddressFromHex converts a hex string to Address, panicking on error.
func MustAddressFromHex(s string) Address {
	addr, err := AddressFromHex(s)
	if err != nil {
		panic(err)
	}
	return addr
}

// HashFromHex converts a hex string to a Hash.
func HashFromHex(s string) Hash {
	return common.HexToHash(s)
}

// HexFromBytes creates a Hex from a byte slice.
func HexFromBytes(b []byte) Hex {
	return Hex(b)
}

// AddressFromBytes creates an Address from a byte slice.
func AddressFromBytes(b []byte) Address {
	return common.BytesToAddress(b)
}

// HashFromBytes creates a Hash from a byte slice.
func HashFromBytes(b []byte) (Hash, error) {
	if len(b) != 32 {
		return Hash{}, fmt.Errorf("invalid hash length: expected 32, got %d", len(b))
	}
	return common.BytesToHash(b), nil
}
