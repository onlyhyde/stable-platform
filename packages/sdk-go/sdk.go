// Package sdk provides the StableNet Go SDK for ERC-4337 Account Abstraction.
//
// This SDK provides a Go implementation of the StableNet TypeScript SDK,
// enabling developers to build applications with ERC-4337 smart accounts,
// ERC-7579 modular modules, and EIP-7702 delegate transactions.
//
// # Quick Start
//
// Create a bundler client to send UserOperations:
//
//	bundlerClient := bundler.NewClient(bundler.ClientConfig{
//		URL:        "https://bundler.example.com",
//		EntryPoint: core.EntryPointV07Address,
//	})
//
// Create a paymaster client for gas sponsorship:
//
//	paymasterClient := paymaster.NewClient(paymaster.ClientConfig{
//		URL:     "https://paymaster.example.com",
//		ChainID: types.ChainIDSepolia,
//		APIKey:  "your-api-key",
//	})
//
// Get contract addresses for a chain:
//
//	addrs, err := addresses.GetChainAddresses(types.ChainIDSepolia)
//	if err != nil {
//		log.Fatal(err)
//	}
//	entryPoint := addrs.Core.EntryPoint
//
// # Package Structure
//
// The SDK is organized into the following packages:
//
//   - types: Core type definitions (Address, Hash, UserOperation, etc.)
//   - addresses: Contract address resolution for different chains
//   - crypto: Cryptographic interfaces and implementations
//   - crypto/geth: go-ethereum based crypto implementation
//   - core: Core SDK functionality
//   - core/bundler: ERC-4337 bundler client
//   - core/paymaster: Paymaster client for gas sponsorship
//   - core/userop: UserOperation utilities
//   - core/rpc: JSON-RPC client utilities
//
// # Features
//
//   - ERC-4337 v0.7 UserOperation building and signing
//   - Bundler client for submitting UserOperations
//   - Paymaster client for gas sponsorship and ERC20 payment
//   - Contract address resolution for multiple chains
//   - Crypto provider abstraction for signing and encoding
package sdk

import (
	// Import all sub-packages for convenience
	_ "github.com/stablenet/sdk-go/addresses"
	_ "github.com/stablenet/sdk-go/core"
	_ "github.com/stablenet/sdk-go/core/bundler"
	_ "github.com/stablenet/sdk-go/core/paymaster"
	_ "github.com/stablenet/sdk-go/core/rpc"
	_ "github.com/stablenet/sdk-go/core/userop"
	_ "github.com/stablenet/sdk-go/crypto"
	_ "github.com/stablenet/sdk-go/crypto/geth"
	_ "github.com/stablenet/sdk-go/types"
)

// Version is the SDK version.
const Version = "0.1.0"
