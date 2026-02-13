package eip7702

import (
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// EIP7702Magic is the magic byte for EIP-7702 authorization signing (0x05).
const EIP7702Magic byte = 0x05

// DelegationPrefix is the bytecode prefix for EIP-7702 delegated accounts (0xef0100).
// A delegated account's bytecode is: 0xef0100 + 20 bytes address
var DelegationPrefix = types.Hex{0xef, 0x01, 0x00}

// DelegationPrefixHex is the hex string representation of the delegation prefix.
const DelegationPrefixHex = "0xef0100"

// ZeroAddress is the zero Ethereum address, used for revocation.
var ZeroAddress = common.HexToAddress("0x0000000000000000000000000000000000000000")

// DelegationBytecodeLength is the expected length of delegated account bytecode.
// 3 bytes prefix (0xef0100) + 20 bytes address = 23 bytes
const DelegationBytecodeLength = 23

// DelegatePresets contains known delegate contracts by chain ID.
var DelegatePresets = map[types.ChainID][]DelegatePreset{
	// Sepolia Testnet
	types.ChainIDSepolia: {
		{
			Name:        "Kernel v3.1",
			Address:     common.HexToAddress("0x0000000000000000000000000000000000000000"), // TODO: Update with actual address
			Description: "Kernel v3.1 ERC-7579 Smart Account",
			IsVerified:  true,
		},
	},
	// Polygon Amoy Testnet
	types.ChainIDPolygonAmoy: {
		{
			Name:        "Kernel v3.1",
			Address:     common.HexToAddress("0x0000000000000000000000000000000000000000"), // TODO: Update with actual address
			Description: "Kernel v3.1 ERC-7579 Smart Account",
			IsVerified:  true,
		},
	},
	// Local Anvil
	types.ChainIDAnvil: {
		{
			Name:        "Kernel v3.1 (Local)",
			Address:     common.HexToAddress("0xc5a5c42992decbae36851359345fe25997f5c42d"),
			Description: "Kernel v3.1 ERC-7579 Smart Account (Local)",
			IsVerified:  false,
		},
	},
}

// GetDelegatePresets returns the delegate presets for a chain.
func GetDelegatePresets(chainId types.ChainID) []DelegatePreset {
	if presets, ok := DelegatePresets[chainId]; ok {
		return presets
	}
	return nil
}
