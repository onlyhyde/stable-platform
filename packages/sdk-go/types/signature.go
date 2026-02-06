package types

import (
	"errors"
	"fmt"
)

// Signature represents an ECDSA signature with r, s, v components.
type Signature struct {
	R Hex    `json:"r"`
	S Hex    `json:"s"`
	V uint8  `json:"v"`
}

// YParity returns the y-parity value (0 or 1) from the V value.
func (s *Signature) YParity() uint8 {
	// For EIP-155 signatures, v is 27 or 28
	// For EIP-2718 type transactions, yParity is 0 or 1
	if s.V >= 27 {
		return s.V - 27
	}
	return s.V
}

// ToBytes converts the signature to a 65-byte array (r[32] + s[32] + v[1]).
func (s *Signature) ToBytes() ([]byte, error) {
	if len(s.R) != 32 || len(s.S) != 32 {
		return nil, errors.New("invalid signature component length")
	}

	result := make([]byte, 65)
	copy(result[0:32], s.R)
	copy(result[32:64], s.S)
	result[64] = s.V

	return result, nil
}

// SignatureFromBytes creates a Signature from a 65-byte array.
func SignatureFromBytes(data []byte) (*Signature, error) {
	if len(data) != 65 {
		return nil, fmt.Errorf("signature must be 65 bytes, got %d", len(data))
	}

	return &Signature{
		R: Hex(data[0:32]),
		S: Hex(data[32:64]),
		V: data[64],
	}, nil
}

// TypedDataDomain represents the EIP-712 domain separator parameters.
type TypedDataDomain struct {
	Name              string  `json:"name,omitempty"`
	Version           string  `json:"version,omitempty"`
	ChainId           *BigInt `json:"chainId,omitempty"`
	VerifyingContract Address `json:"verifyingContract,omitempty"`
	Salt              Hash    `json:"salt,omitempty"`
}

// TypedDataField represents a field in an EIP-712 type definition.
type TypedDataField struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// TypedData represents a complete EIP-712 typed data structure.
type TypedData struct {
	Domain      TypedDataDomain              `json:"domain"`
	Types       map[string][]TypedDataField  `json:"types"`
	PrimaryType string                       `json:"primaryType"`
	Message     map[string]interface{}       `json:"message"`
}
