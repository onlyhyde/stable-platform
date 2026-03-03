package paymaster

import (
	"errors"
	"fmt"
)

// Constants matching PaymasterDataLib.sol
const (
	PaymasterDataVersion = 0x01
	VersionOffset        = 0
	TypeOffset           = 1
	FlagsOffset          = 2
	ValidUntilOffset     = 3  // 6 bytes
	ValidAfterOffset     = 9  // 6 bytes
	NonceOffset          = 15 // 8 bytes
	PayloadLenOffset     = 23 // 2 bytes
	PayloadOffset        = 25
	HeaderSize           = 25
)

// PaymasterSigMagic is the EIP-4337 v0.9 parallel signing magic (8 bytes).
// When present at the end of paymasterData, indicates v0.9 format:
//
//	envelope + signature + uint16(sigLen) + MAGIC(8 bytes)
var PaymasterSigMagic = []byte{0x22, 0xe3, 0x25, 0xa2, 0x97, 0x43, 0x96, 0x56}

const (
	PaymasterSigMagicSize = 8
	PaymasterSigLenSize   = 2 // uint16 for signature length
)

// PaymasterType represents the type of paymaster.
type PaymasterType uint8

const (
	PaymasterTypeVerifying PaymasterType = 0
	PaymasterTypeSponsor   PaymasterType = 1
	PaymasterTypeERC20     PaymasterType = 2
	PaymasterTypePermit2   PaymasterType = 3
)

// Envelope represents a decoded paymaster data envelope.
type Envelope struct {
	Version       uint8
	PaymasterType PaymasterType
	Flags         uint8
	ValidUntil    uint64 // uint48 in Solidity, fits in uint64
	ValidAfter    uint64 // uint48 in Solidity
	Nonce         uint64
	Payload       []byte
}

var (
	ErrInvalidVersion = errors.New("invalid version")
	ErrInvalidLength  = errors.New("invalid length")
	ErrInvalidType    = errors.New("invalid paymaster type")
)

// EncodePaymasterData encodes an envelope to bytes.
// Layout: [version(1)][type(1)][flags(1)][validUntil(6)][validAfter(6)][nonce(8)][payloadLen(2)][payload(N)]
func EncodePaymasterData(env *Envelope) ([]byte, error) {
	if env.PaymasterType > PaymasterTypePermit2 {
		return nil, fmt.Errorf("%w: %d", ErrInvalidType, env.PaymasterType)
	}
	if len(env.Payload) > 0xFFFF {
		return nil, fmt.Errorf("%w: payload too large %d", ErrInvalidLength, len(env.Payload))
	}

	payloadLen := len(env.Payload)
	out := make([]byte, HeaderSize+payloadLen)

	out[VersionOffset] = PaymasterDataVersion
	out[TypeOffset] = uint8(env.PaymasterType)
	out[FlagsOffset] = env.Flags

	// validUntil: 6 bytes big-endian
	putUint48(out[ValidUntilOffset:], env.ValidUntil)
	// validAfter: 6 bytes big-endian
	putUint48(out[ValidAfterOffset:], env.ValidAfter)
	// nonce: 8 bytes big-endian
	putUint64(out[NonceOffset:], env.Nonce)
	// payloadLen: 2 bytes big-endian
	out[PayloadLenOffset] = byte(payloadLen >> 8)
	out[PayloadLenOffset+1] = byte(payloadLen)
	// payload
	copy(out[PayloadOffset:], env.Payload)

	return out, nil
}

// DecodePaymasterData decodes bytes into an Envelope.
func DecodePaymasterData(data []byte) (*Envelope, error) {
	if len(data) < HeaderSize {
		return nil, fmt.Errorf("%w: got %d, need >= %d", ErrInvalidLength, len(data), HeaderSize)
	}

	version := data[VersionOffset]
	if version != PaymasterDataVersion {
		return nil, fmt.Errorf("%w: got %d, want %d", ErrInvalidVersion, version, PaymasterDataVersion)
	}

	pmType := PaymasterType(data[TypeOffset])
	if pmType > PaymasterTypePermit2 {
		return nil, fmt.Errorf("%w: %d", ErrInvalidType, pmType)
	}

	flags := data[FlagsOffset]
	validUntil := getUint48(data[ValidUntilOffset:])
	validAfter := getUint48(data[ValidAfterOffset:])
	nonce := getUint64(data[NonceOffset:])
	payloadLen := int(data[PayloadLenOffset])<<8 | int(data[PayloadLenOffset+1])

	expectedLen := PayloadOffset + payloadLen
	if len(data) != expectedLen {
		return nil, fmt.Errorf("%w: got %d, want %d", ErrInvalidLength, len(data), expectedLen)
	}

	payload := make([]byte, payloadLen)
	copy(payload, data[PayloadOffset:])

	return &Envelope{
		Version:       version,
		PaymasterType: pmType,
		Flags:         flags,
		ValidUntil:    validUntil,
		ValidAfter:    validAfter,
		Nonce:         nonce,
		Payload:       payload,
	}, nil
}

// IsSupported checks if data uses the supported paymaster format.
func IsSupported(data []byte) bool {
	return len(data) >= HeaderSize && data[0] == PaymasterDataVersion
}

// EnvelopeLength returns the total length of the envelope (header + payload).
func EnvelopeLength(data []byte) (int, error) {
	if len(data) < HeaderSize {
		return 0, fmt.Errorf("%w: got %d", ErrInvalidLength, len(data))
	}
	payloadLen := int(data[PayloadLenOffset])<<8 | int(data[PayloadLenOffset+1])
	return PayloadOffset + payloadLen, nil
}

// ConcatWithSignature appends a signature to envelope bytes (legacy format).
func ConcatWithSignature(envelope, signature []byte) []byte {
	result := make([]byte, len(envelope)+len(signature))
	copy(result, envelope)
	copy(result[len(envelope):], signature)
	return result
}

// ConcatWithSignatureV09 appends a signature using v0.9 parallel signing format.
// Layout: envelope + signature + uint16(sigLen) + PAYMASTER_SIG_MAGIC(8 bytes)
func ConcatWithSignatureV09(envelope, signature []byte) []byte {
	sigLen := len(signature)
	totalLen := len(envelope) + sigLen + PaymasterSigLenSize + PaymasterSigMagicSize
	result := make([]byte, totalLen)

	offset := 0
	copy(result[offset:], envelope)
	offset += len(envelope)
	copy(result[offset:], signature)
	offset += sigLen
	// uint16 signature length (big-endian)
	result[offset] = byte(sigLen >> 8)
	result[offset+1] = byte(sigLen)
	offset += PaymasterSigLenSize
	copy(result[offset:], PaymasterSigMagic)

	return result
}

// HasSignatureMagic checks if data ends with the v0.9 signature magic.
func HasSignatureMagic(data []byte) bool {
	if len(data) < PaymasterSigMagicSize {
		return false
	}
	tail := data[len(data)-PaymasterSigMagicSize:]
	for i := 0; i < PaymasterSigMagicSize; i++ {
		if tail[i] != PaymasterSigMagic[i] {
			return false
		}
	}
	return true
}

// SplitEnvelopeAndSignature splits data into envelope and signature parts.
// Auto-detects v0.9 format (magic suffix) vs legacy format.
func SplitEnvelopeAndSignature(data []byte, sigLen int) (envelope, signature []byte, err error) {
	envLen, err := EnvelopeLength(data)
	if err != nil {
		return nil, nil, err
	}

	// v0.9 detection: check for magic suffix
	if HasSignatureMagic(data) {
		dataLen := len(data)
		sigLenOffset := dataLen - PaymasterSigMagicSize - PaymasterSigLenSize
		actualSigLen := int(data[sigLenOffset])<<8 | int(data[sigLenOffset+1])
		sigStart := sigLenOffset - actualSigLen

		if sigStart < envLen {
			return nil, nil, fmt.Errorf("%w: v0.9 signature overlaps envelope", ErrInvalidLength)
		}

		return data[:envLen], data[sigStart : sigStart+actualSigLen], nil
	}

	// Legacy format
	if len(data) < envLen+sigLen {
		return nil, nil, fmt.Errorf("%w: data too short for envelope + sig", ErrInvalidLength)
	}
	return data[:envLen], data[envLen:], nil
}

// helpers

func putUint48(b []byte, v uint64) {
	b[0] = byte(v >> 40)
	b[1] = byte(v >> 32)
	b[2] = byte(v >> 24)
	b[3] = byte(v >> 16)
	b[4] = byte(v >> 8)
	b[5] = byte(v)
}

func getUint48(b []byte) uint64 {
	return uint64(b[0])<<40 | uint64(b[1])<<32 | uint64(b[2])<<24 |
		uint64(b[3])<<16 | uint64(b[4])<<8 | uint64(b[5])
}

func putUint64(b []byte, v uint64) {
	b[0] = byte(v >> 56)
	b[1] = byte(v >> 48)
	b[2] = byte(v >> 40)
	b[3] = byte(v >> 32)
	b[4] = byte(v >> 24)
	b[5] = byte(v >> 16)
	b[6] = byte(v >> 8)
	b[7] = byte(v)
}

func getUint64(b []byte) uint64 {
	return uint64(b[0])<<56 | uint64(b[1])<<48 | uint64(b[2])<<40 |
		uint64(b[3])<<32 | uint64(b[4])<<24 | uint64(b[5])<<16 |
		uint64(b[6])<<8 | uint64(b[7])
}
