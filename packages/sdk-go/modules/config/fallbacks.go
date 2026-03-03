package config

import (
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Token Receiver Fallback
// ============================================================================

// TokenReceiverFallback is the token receiver fallback module definition.
// Handles ERC-777 tokensReceived callbacks via fallback routing.
// ERC-721/ERC-1155 are handled natively by Kernel's built-in pure functions
// and do not require a fallback module.
var TokenReceiverFallback = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeFallback,
		Name:        "Token Receiver (ERC-777)",
		Description: "Handle ERC-777 tokensReceived callbacks. ERC-721/ERC-1155 are handled natively by Kernel.",
		Version:     "1.1.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"fallback", "token", "erc777"},
		DocsURL:     "https://docs.stablenet.io/modules/token-receiver",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "supportedInterfaces",
				Label:       "Supported Interfaces",
				Description: "Interface IDs to support (e.g., ERC721Receiver, ERC1155Receiver)",
				Type:        TypeBytes4Arr,
				Required:    true,
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0x39ff4ad6e3b8357fba61a9b10b74b344902e01a4"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// Flash Loan Receiver Fallback
// ============================================================================

// FlashLoanReceiverFallback is the flash loan receiver fallback module definition.
var FlashLoanReceiverFallback = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeFallback,
		Name:        "Flash Loan Receiver",
		Description: "Handle flash loan callbacks from lending protocols",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"fallback", "flash-loan", "defi", "lending"},
		DocsURL:     "https://docs.stablenet.io/modules/flash-loan-receiver",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "authorizedBorrower",
				Label:       "Authorized Borrower",
				Description: "Address that can initiate flash loans",
				Type:        TypeAddress,
				Required:    true,
			},
			{
				Name:        "allowedTokens",
				Label:       "Allowed Tokens",
				Description: "Tokens that can be flash loaned",
				Type:        TypeAddressAr,
				Required:    true,
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0xa9340c9a01cc85467eb43291845c28b1d0f47d02"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// ERC777 Receiver Fallback
// ============================================================================

// ERC777ReceiverFallback is the ERC-777 token receiver fallback module definition.
var ERC777ReceiverFallback = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeFallback,
		Name:        "ERC-777 Receiver",
		Description: "Handle ERC-777 token receive callbacks",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"fallback", "erc777", "token"},
		DocsURL:     "https://docs.stablenet.io/modules/erc777-receiver",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:         "allowedSenders",
				Label:        "Allowed Senders",
				Description:  "Token contract addresses to accept (empty for all)",
				Type:         TypeAddressAr,
				Required:     false,
				DefaultValue: "",
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0x0000000000000000000000000000000000000000"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// All Fallbacks
// ============================================================================

// FallbackModules contains all built-in fallback modules.
var FallbackModules = []ModuleRegistryEntry{
	TokenReceiverFallback,
	FlashLoanReceiverFallback,
	ERC777ReceiverFallback,
}
