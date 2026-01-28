package service

import (
	"encoding/hex"
	"regexp"
	"strings"

	"golang.org/x/crypto/sha3"
)

// EVM address validation regex
var evmAddressRegex = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

// WalletValidationResult represents the result of wallet address validation
type WalletValidationResult struct {
	Valid           bool     `json:"valid"`
	Address         string   `json:"address"`
	ChecksumAddress string   `json:"checksumAddress,omitempty"`
	ChainID         int      `json:"chainId"`
	ChainName       string   `json:"chainName"`
	Warnings        []string `json:"warnings,omitempty"`
	Error           string   `json:"error,omitempty"`
}

// ValidateEVMAddress validates an EVM-compatible wallet address
// Returns: (valid, checksumAddress, warnings)
func ValidateEVMAddress(address string) (bool, string, []string) {
	var warnings []string

	// 1. Basic format validation
	if !evmAddressRegex.MatchString(address) {
		return false, "", nil
	}

	// 2. Calculate checksum (EIP-55)
	checksumAddress := ToChecksumAddress(address)

	// 3. Checksum warning (only if mixed case)
	if hasMixedCase(address) && address != checksumAddress {
		warnings = append(warnings, "Address checksum does not match. Please verify the address is correct.")
	}

	return true, checksumAddress, warnings
}

// hasMixedCase checks if the hex part of the address has both upper and lower case letters
func hasMixedCase(address string) bool {
	hexPart := address[2:]
	hasLower := strings.ContainsAny(hexPart, "abcdef")
	hasUpper := strings.ContainsAny(hexPart, "ABCDEF")
	return hasLower && hasUpper
}

// ToChecksumAddress converts an address to EIP-55 checksum format
func ToChecksumAddress(address string) string {
	// Convert to lowercase
	address = strings.ToLower(address)
	hexPart := address[2:]

	// Calculate Keccak256 hash
	hash := sha3.NewLegacyKeccak256()
	hash.Write([]byte(hexPart))
	hashBytes := hash.Sum(nil)
	hashHex := hex.EncodeToString(hashBytes)

	// Apply checksum
	result := "0x"
	for i, c := range hexPart {
		if c >= 'a' && c <= 'f' {
			// If the hash character at this position is >= 8, uppercase
			if hashHex[i] >= '8' {
				result += strings.ToUpper(string(c))
			} else {
				result += string(c)
			}
		} else {
			result += string(c)
		}
	}

	return result
}

// ValidateWalletRequest represents a wallet validation request
type ValidateWalletRequest struct {
	Address string `json:"address" binding:"required"`
	ChainID int    `json:"chainId" binding:"required"`
}
