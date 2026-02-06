// Package crypto provides cryptographic operations for stealth addresses.
// It implements the EIP-5564 stealth address scheme using secp256k1.
package crypto

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/plugins/stealth/constants"
	"github.com/stablenet/sdk-go/types"
)

var (
	// ErrInvalidPrivateKey indicates an invalid private key.
	ErrInvalidPrivateKey = errors.New("invalid private key")
	// ErrInvalidPublicKey indicates an invalid public key.
	ErrInvalidPublicKey = errors.New("invalid public key")
	// ErrInvalidStealthMetaAddress indicates an invalid stealth meta address.
	ErrInvalidStealthMetaAddress = errors.New("invalid stealth meta address")
	// ErrInvalidURI indicates an invalid stealth meta address URI.
	ErrInvalidURI = errors.New("invalid stealth meta address URI")
	// ErrDegenerateKey indicates a degenerate key (point at infinity or zero).
	ErrDegenerateKey = errors.New("degenerate key generated")
)

// curveOrder is the secp256k1 curve order (n).
var curveOrder = secp256k1.Params().N

// chainPrefixRegex validates chain prefix format (alphanumeric and hyphen).
var chainPrefixRegex = regexp.MustCompile(`^[a-zA-Z0-9-]+$`)

// GeneratePrivateKey generates a random private key.
func GeneratePrivateKey() (types.Hex, error) {
	privKey, err := secp256k1.GeneratePrivateKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate private key: %w", err)
	}
	return types.Hex(privKey.Serialize()), nil
}

// DerivePublicKey derives a public key from a private key.
// If compressed is true, returns compressed format (33 bytes), otherwise uncompressed (65 bytes).
func DerivePublicKey(privateKey types.Hex, compressed bool) (types.Hex, error) {
	if err := validatePrivateKey(privateKey); err != nil {
		return nil, err
	}

	privKey := secp256k1.PrivKeyFromBytes(privateKey)
	pubKey := privKey.PubKey()

	if compressed {
		return types.Hex(pubKey.SerializeCompressed()), nil
	}
	return types.Hex(pubKey.SerializeUncompressed()), nil
}

// GenerateStealthKeyPair generates a complete stealth key pair.
func GenerateStealthKeyPair() (*StealthKeyPair, error) {
	privateKey, err := GeneratePrivateKey()
	if err != nil {
		return nil, err
	}

	publicKey, err := DerivePublicKey(privateKey, true)
	if err != nil {
		return nil, err
	}

	return &StealthKeyPair{
		PrivateKey: privateKey,
		PublicKey:  publicKey,
	}, nil
}

// GenerateStealthKeys generates a complete set of stealth keys (spending + viewing).
func GenerateStealthKeys() (*StealthKeys, error) {
	spending, err := GenerateStealthKeyPair()
	if err != nil {
		return nil, fmt.Errorf("failed to generate spending key: %w", err)
	}

	viewing, err := GenerateStealthKeyPair()
	if err != nil {
		return nil, fmt.Errorf("failed to generate viewing key: %w", err)
	}

	return &StealthKeys{
		Spending: *spending,
		Viewing:  *viewing,
	}, nil
}

// GenerateStealthAddress generates a stealth address for a recipient.
//
// This implements the EIP-5564 stealth address generation:
// 1. Generate ephemeral key pair (r, R = r*G)
// 2. Compute shared secret S = r * viewingPubKey
// 3. Compute stealth public key P = spendingPubKey + H(S) * G
// 4. Derive stealth address from P
func GenerateStealthAddress(spendingPubKey, viewingPubKey types.Hex) (*GeneratedStealthAddress, error) {
	// Validate and parse public keys
	spendingPoint, err := parsePublicKey(spendingPubKey)
	if err != nil {
		return nil, fmt.Errorf("invalid spending public key: %w", err)
	}

	viewingPoint, err := parsePublicKey(viewingPubKey)
	if err != nil {
		return nil, fmt.Errorf("invalid viewing public key: %w", err)
	}

	// 1. Generate ephemeral key pair
	ephemeralPrivKey, err := secp256k1.GeneratePrivateKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate ephemeral key: %w", err)
	}
	ephemeralPubKey := ephemeralPrivKey.PubKey()

	// 2. Compute shared secret: S = r * viewingPubKey
	var sharedSecretPoint secp256k1.JacobianPoint
	viewingPoint.AsJacobian(&sharedSecretPoint)
	secp256k1.ScalarMultNonConst(&ephemeralPrivKey.Key, &sharedSecretPoint, &sharedSecretPoint)
	sharedSecretPoint.ToAffine()

	// Convert to compressed bytes for hashing
	sharedSecretPubKey := secp256k1.NewPublicKey(&sharedSecretPoint.X, &sharedSecretPoint.Y)
	sharedSecretBytes := sharedSecretPubKey.SerializeCompressed()

	// 3. Hash the shared secret: H(S)
	hashedSecret := crypto.Keccak256(sharedSecretBytes)

	// Convert hash to scalar (mod n)
	hashScalar := new(big.Int).SetBytes(hashedSecret)
	hashScalar.Mod(hashScalar, curveOrder)

	// Check for zero (extremely unlikely)
	if hashScalar.Sign() == 0 {
		return nil, ErrDegenerateKey
	}

	// 4. Compute stealth public key: P = spendingPubKey + H(S) * G
	var hashScalarModN secp256k1.ModNScalar
	hashScalarModN.SetByteSlice(hashScalar.Bytes())

	// H(S) * G
	var hashPointJac secp256k1.JacobianPoint
	secp256k1.ScalarBaseMultNonConst(&hashScalarModN, &hashPointJac)
	hashPointJac.ToAffine()

	// spendingPubKey + H(S) * G
	var spendingPointJac secp256k1.JacobianPoint
	spendingPoint.AsJacobian(&spendingPointJac)

	var stealthPointJac secp256k1.JacobianPoint
	secp256k1.AddNonConst(&spendingPointJac, &hashPointJac, &stealthPointJac)
	stealthPointJac.ToAffine()

	// Check for point at infinity
	if stealthPointJac.X.IsZero() && stealthPointJac.Y.IsZero() {
		return nil, ErrDegenerateKey
	}

	stealthPubKey := secp256k1.NewPublicKey(&stealthPointJac.X, &stealthPointJac.Y)

	// 5. Derive Ethereum address from stealth public key (uncompressed, skip first byte)
	uncompressedPubKey := stealthPubKey.SerializeUncompressed()
	addressHash := crypto.Keccak256(uncompressedPubKey[1:])
	stealthAddress := common.BytesToAddress(addressHash[12:])

	// 6. Compute view tag
	viewTag := ComputeViewTag(sharedSecretBytes)

	return &GeneratedStealthAddress{
		StealthAddress:  types.Address(stealthAddress),
		EphemeralPubKey: types.Hex(ephemeralPubKey.SerializeCompressed()),
		ViewTag:         viewTag,
	}, nil
}

// ComputeStealthPrivateKey computes the stealth private key from an announcement.
//
// This implements the recipient's key derivation:
// 1. Compute shared secret S = viewingPrivateKey * ephemeralPubKey
// 2. Compute stealth private key p = spendingPrivateKey + H(S)
func ComputeStealthPrivateKey(ephemeralPubKey, spendingPrivateKey, viewingPrivateKey types.Hex) (*ComputedStealthKey, error) {
	// Validate inputs
	if err := validatePrivateKey(spendingPrivateKey); err != nil {
		return nil, fmt.Errorf("invalid spending private key: %w", err)
	}
	if err := validatePrivateKey(viewingPrivateKey); err != nil {
		return nil, fmt.Errorf("invalid viewing private key: %w", err)
	}

	ephemeralPoint, err := parsePublicKey(ephemeralPubKey)
	if err != nil {
		return nil, fmt.Errorf("invalid ephemeral public key: %w", err)
	}

	// 1. Compute shared secret: S = viewingPrivateKey * ephemeralPubKey
	viewingPrivKey := secp256k1.PrivKeyFromBytes(viewingPrivateKey)

	var sharedSecretPoint secp256k1.JacobianPoint
	ephemeralPoint.AsJacobian(&sharedSecretPoint)
	secp256k1.ScalarMultNonConst(&viewingPrivKey.Key, &sharedSecretPoint, &sharedSecretPoint)
	sharedSecretPoint.ToAffine()

	// Convert to compressed bytes for hashing
	sharedSecretPubKey := secp256k1.NewPublicKey(&sharedSecretPoint.X, &sharedSecretPoint.Y)
	sharedSecretBytes := sharedSecretPubKey.SerializeCompressed()

	// 2. Hash the shared secret
	hashedSecret := crypto.Keccak256(sharedSecretBytes)

	// 3. Compute stealth private key: p = spendingPrivateKey + H(S) mod n
	spendingPrivKeyInt := new(big.Int).SetBytes(spendingPrivateKey)
	hashScalar := new(big.Int).SetBytes(hashedSecret)

	stealthPrivKeyInt := new(big.Int).Add(spendingPrivKeyInt, hashScalar)
	stealthPrivKeyInt.Mod(stealthPrivKeyInt, curveOrder)

	// Check for zero (extremely unlikely)
	if stealthPrivKeyInt.Sign() == 0 {
		return nil, ErrDegenerateKey
	}

	// Pad to 32 bytes
	stealthPrivKeyBytes := make([]byte, 32)
	stealthPrivKeyInt.FillBytes(stealthPrivKeyBytes)

	// 4. Derive the stealth address
	stealthPrivKey := secp256k1.PrivKeyFromBytes(stealthPrivKeyBytes)
	stealthPubKey := stealthPrivKey.PubKey()

	// Derive Ethereum address
	uncompressedPubKey := stealthPubKey.SerializeUncompressed()
	addressHash := crypto.Keccak256(uncompressedPubKey[1:])
	stealthAddress := common.BytesToAddress(addressHash[12:])

	return &ComputedStealthKey{
		StealthAddress:    types.Address(stealthAddress),
		StealthPrivateKey: types.Hex(stealthPrivKeyBytes),
	}, nil
}

// CheckViewTag checks if an ephemeral public key corresponds to a potential stealth address.
// This is used for efficient scanning with view tags.
func CheckViewTag(ephemeralPubKey, viewingPrivateKey, expectedViewTag types.Hex) (bool, error) {
	// Validate inputs
	if err := validatePrivateKey(viewingPrivateKey); err != nil {
		return false, fmt.Errorf("invalid viewing private key: %w", err)
	}

	ephemeralPoint, err := parsePublicKey(ephemeralPubKey)
	if err != nil {
		return false, fmt.Errorf("invalid ephemeral public key: %w", err)
	}

	// Compute shared secret
	viewingPrivKey := secp256k1.PrivKeyFromBytes(viewingPrivateKey)

	var sharedSecretPoint secp256k1.JacobianPoint
	ephemeralPoint.AsJacobian(&sharedSecretPoint)
	secp256k1.ScalarMultNonConst(&viewingPrivKey.Key, &sharedSecretPoint, &sharedSecretPoint)
	sharedSecretPoint.ToAffine()

	sharedSecretPubKey := secp256k1.NewPublicKey(&sharedSecretPoint.X, &sharedSecretPoint.Y)
	sharedSecretBytes := sharedSecretPubKey.SerializeCompressed()

	// Compute view tag
	computedViewTag := ComputeViewTag(sharedSecretBytes)

	// Compare
	return strings.EqualFold(computedViewTag.String(), expectedViewTag.String()), nil
}

// ParseStealthMetaAddress parses a stealth meta-address from raw bytes.
// Format: spendingPubKey (33 bytes) + viewingPubKey (33 bytes) = 66 bytes
func ParseStealthMetaAddress(raw types.Hex) (*StealthMetaAddress, error) {
	if len(raw) != constants.StealthMetaAddressSize {
		return nil, fmt.Errorf("%w: expected %d bytes, got %d",
			ErrInvalidStealthMetaAddress, constants.StealthMetaAddressSize, len(raw))
	}

	spendingPubKey := types.Hex(raw[:constants.CompressedPubKeySize])
	viewingPubKey := types.Hex(raw[constants.CompressedPubKeySize:])

	// Validate both public keys
	if _, err := parsePublicKey(spendingPubKey); err != nil {
		return nil, fmt.Errorf("invalid spending public key in meta address: %w", err)
	}
	if _, err := parsePublicKey(viewingPubKey); err != nil {
		return nil, fmt.Errorf("invalid viewing public key in meta address: %w", err)
	}

	return &StealthMetaAddress{
		SpendingPubKey: spendingPubKey,
		ViewingPubKey:  viewingPubKey,
		SchemeID:       SchemeSecp256k1,
	}, nil
}

// EncodeStealthMetaAddress encodes a stealth meta-address to raw bytes.
func EncodeStealthMetaAddress(spendingPubKey, viewingPubKey types.Hex) (types.Hex, error) {
	if len(spendingPubKey) != constants.CompressedPubKeySize {
		return nil, fmt.Errorf("spending public key must be %d bytes (compressed)", constants.CompressedPubKeySize)
	}
	if len(viewingPubKey) != constants.CompressedPubKeySize {
		return nil, fmt.Errorf("viewing public key must be %d bytes (compressed)", constants.CompressedPubKeySize)
	}

	combined := make([]byte, constants.StealthMetaAddressSize)
	copy(combined[:constants.CompressedPubKeySize], spendingPubKey)
	copy(combined[constants.CompressedPubKeySize:], viewingPubKey)

	return types.Hex(combined), nil
}

// ParseStealthMetaAddressURI parses a stealth meta-address URI.
// Format: st:<chain>:<stealthMetaAddress>
func ParseStealthMetaAddressURI(uri string) (*ParsedStealthMetaAddressURI, error) {
	uri = strings.TrimSpace(uri)

	if uri == "" {
		return nil, fmt.Errorf("%w: empty URI", ErrInvalidURI)
	}

	// Check prefix
	if !strings.HasPrefix(uri, constants.StealthMetaAddressPrefix+":") {
		return nil, fmt.Errorf("%w: must start with '%s:'", ErrInvalidURI, constants.StealthMetaAddressPrefix)
	}

	// Split on colons (only first two)
	firstColonIdx := strings.Index(uri, ":")
	secondColonIdx := strings.Index(uri[firstColonIdx+1:], ":")
	if secondColonIdx == -1 {
		return nil, fmt.Errorf("%w: expected format st:<chain>:<address>", ErrInvalidURI)
	}
	secondColonIdx += firstColonIdx + 1

	chainPrefix := uri[firstColonIdx+1 : secondColonIdx]
	rawHex := uri[secondColonIdx+1:]

	// Validate chain prefix
	if chainPrefix == "" {
		return nil, fmt.Errorf("%w: chain prefix cannot be empty", ErrInvalidURI)
	}
	if !chainPrefixRegex.MatchString(chainPrefix) {
		return nil, fmt.Errorf("%w: chain prefix must be alphanumeric", ErrInvalidURI)
	}

	// Validate and parse address
	if rawHex == "" {
		return nil, fmt.Errorf("%w: address cannot be empty", ErrInvalidURI)
	}
	if !strings.HasPrefix(rawHex, "0x") {
		return nil, fmt.Errorf("%w: address must start with 0x", ErrInvalidURI)
	}

	raw, err := types.HexFromString(rawHex)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid hex: %v", ErrInvalidURI, err)
	}

	stealthMetaAddress, err := ParseStealthMetaAddress(raw)
	if err != nil {
		return nil, err
	}

	return &ParsedStealthMetaAddressURI{
		ChainPrefix:        chainPrefix,
		StealthMetaAddress: *stealthMetaAddress,
		Raw:                raw,
	}, nil
}

// EncodeStealthMetaAddressURI encodes a stealth meta-address to URI format.
func EncodeStealthMetaAddressURI(chainPrefix string, spendingPubKey, viewingPubKey types.Hex) (string, error) {
	raw, err := EncodeStealthMetaAddress(spendingPubKey, viewingPubKey)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s:%s:%s", constants.StealthMetaAddressPrefix, chainPrefix, raw.String()), nil
}

// validatePrivateKey validates a private key.
func validatePrivateKey(privateKey types.Hex) error {
	if len(privateKey) == 0 {
		return fmt.Errorf("%w: empty key", ErrInvalidPrivateKey)
	}

	privKeyInt := new(big.Int).SetBytes(privateKey)

	// Must not be zero
	if privKeyInt.Sign() == 0 {
		return fmt.Errorf("%w: cannot be zero", ErrInvalidPrivateKey)
	}

	// Must be less than curve order
	if privKeyInt.Cmp(curveOrder) >= 0 {
		return fmt.Errorf("%w: must be less than curve order", ErrInvalidPrivateKey)
	}

	return nil
}

// parsePublicKey parses and validates a public key.
func parsePublicKey(publicKey types.Hex) (*secp256k1.PublicKey, error) {
	if len(publicKey) == 0 {
		return nil, fmt.Errorf("%w: empty key", ErrInvalidPublicKey)
	}

	pubKey, err := secp256k1.ParsePubKey(publicKey)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidPublicKey, err)
	}

	// Check for point at infinity (both coordinates zero)
	var point secp256k1.JacobianPoint
	pubKey.AsJacobian(&point)
	point.ToAffine()
	if point.X.IsZero() && point.Y.IsZero() {
		return nil, fmt.Errorf("%w: point at infinity", ErrInvalidPublicKey)
	}

	return pubKey, nil
}

// GenerateRandomBytes generates n random bytes.
func GenerateRandomBytes(n int) ([]byte, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return nil, fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return bytes, nil
}
