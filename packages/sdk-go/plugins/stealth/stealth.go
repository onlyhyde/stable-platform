// Package stealth provides EIP-5564 stealth address functionality for the StableNet SDK.
//
// Stealth addresses enable privacy-preserving transactions by generating one-time
// addresses that only the intended recipient can spend from.
//
// # Overview
//
// The stealth address scheme works as follows:
//
//  1. The recipient publishes their stealth meta-address (spending + viewing public keys)
//  2. The sender generates a one-time stealth address using the meta-address
//  3. The sender announces the payment with the ephemeral public key
//  4. The recipient scans announcements to find payments addressed to them
//  5. The recipient derives the private key to spend from the stealth address
//
// # Quick Start
//
// Generate keys for receiving stealth payments:
//
//	keys, err := stealth.GenerateStealthKeys()
//	uri, err := stealth.EncodeStealthMetaAddressURI("eth", keys.Spending.PublicKey, keys.Viewing.PublicKey)
//	fmt.Println("Your stealth meta-address:", uri)
//
// Send to a stealth address:
//
//	result, err := actions.GenerateStealthAddress(stealth.GenerateStealthAddressParams{
//	    StealthMetaAddressURI: "st:eth:0x...",
//	})
//	// Send funds to result.StealthAddress
//	// Then announce the payment
//	actions.Announce(ctx, client, stealth.AnnounceParams{
//	    SchemeID:        stealth.SchemeSecp256k1,
//	    StealthAddress:  result.StealthAddress,
//	    EphemeralPubKey: result.EphemeralPubKey,
//	    Metadata:        result.ViewTag,
//	})
//
// Receive stealth payments:
//
//	// Watch for announcements
//	stop, err := actions.WatchAnnouncements(ctx, client, opts, spendingPrivKey,
//	    func(announcement, key) {
//	        // Found a payment! Use key.StealthPrivateKey to spend
//	    },
//	    func(err) { log.Error(err) },
//	)
//	defer stop()
//
// # Subpackages
//
//   - crypto: Core cryptographic operations (key generation, stealth address computation)
//   - actions: High-level operations (generate, announce, fetch, watch, register)
//   - client: Client for interacting with EIP-5564/6538 contracts
//   - constants: Contract addresses, ABIs, and constants
//
// # References
//
//   - EIP-5564: Stealth Addresses (https://eips.ethereum.org/EIPS/eip-5564)
//   - EIP-6538: Stealth Meta-Address Registry (https://eips.ethereum.org/EIPS/eip-6538)
package stealth

// This file provides re-exports of commonly used types and functions.
// For full functionality, import the subpackages directly:
//   - github.com/stablenet/sdk-go/plugins/stealth/crypto
//   - github.com/stablenet/sdk-go/plugins/stealth/actions
//   - github.com/stablenet/sdk-go/plugins/stealth/client
//   - github.com/stablenet/sdk-go/plugins/stealth/constants
