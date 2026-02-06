// Package actions provides high-level actions for stealth address operations.
package actions

import (
	"github.com/stablenet/sdk-go/plugins/stealth"
	"github.com/stablenet/sdk-go/plugins/stealth/crypto"
)

// GenerateStealthAddress generates a stealth address for a recipient.
//
// This action parses the stealth meta-address URI and generates
// a one-time stealth address that only the recipient can spend from.
//
// Example:
//
//	result, err := GenerateStealthAddress(GenerateStealthAddressParams{
//	    StealthMetaAddressURI: "st:eth:0x...",
//	})
//	// Send funds to result.StealthAddress
//	// Announce result.EphemeralPubKey with result.ViewTag as metadata
func GenerateStealthAddress(params stealth.GenerateStealthAddressParams) (*crypto.GeneratedStealthAddress, error) {
	// Parse the stealth meta-address URI
	parsed, err := crypto.ParseStealthMetaAddressURI(params.StealthMetaAddressURI)
	if err != nil {
		return nil, err
	}

	// Generate the stealth address
	return crypto.GenerateStealthAddress(
		parsed.StealthMetaAddress.SpendingPubKey,
		parsed.StealthMetaAddress.ViewingPubKey,
	)
}

// GenerateStealthAddressFromPubKeys generates a stealth address directly from public keys.
// This is useful when you already have the parsed public keys.
func GenerateStealthAddressFromPubKeys(spendingPubKey, viewingPubKey crypto.StealthKeyPair) (*crypto.GeneratedStealthAddress, error) {
	return crypto.GenerateStealthAddress(spendingPubKey.PublicKey, viewingPubKey.PublicKey)
}

// GenerateStealthAddressFromMetaAddress generates a stealth address from a stealth meta address.
func GenerateStealthAddressFromMetaAddress(metaAddress *crypto.StealthMetaAddress) (*crypto.GeneratedStealthAddress, error) {
	return crypto.GenerateStealthAddress(metaAddress.SpendingPubKey, metaAddress.ViewingPubKey)
}
