package config

import (
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Spending Limit Hook
// ============================================================================

// SpendingLimitHook is the spending limit hook module definition.
var SpendingLimitHook = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeHook,
		Name:        "Spending Limit",
		Description: "Limit spending per time period for enhanced security",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"hook", "security", "limit", "spending"},
		DocsURL:     "https://docs.stablenet.io/modules/spending-limit",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:         "token",
				Label:        "Token",
				Description:  "Token to limit (0x0 for native ETH)",
				Type:         TypeAddress,
				Required:     true,
				DefaultValue: "0x0000000000000000000000000000000000000000",
			},
			{
				Name:        "limit",
				Label:       "Spending Limit",
				Description: "Maximum amount per period",
				Type:        TypeUint256,
				Required:    true,
			},
			{
				Name:        "period",
				Label:       "Reset Period",
				Description: "Period in seconds before limit resets",
				Type:        TypeUint64,
				Required:    true,
				Validation: &FieldValidation{
					Min:     "3600", // 1 hour minimum
					Message: "Period must be at least 1 hour (3600 seconds)",
				},
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0x304cb9f3725e8b807c2fe951c8db7fea4176f1c5"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// Audit Hook
// ============================================================================

// AuditHook is the audit hook module definition.
var AuditHook = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeHook,
		Name:        "Audit Hook",
		Description: "Log all account activities for audit trail",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"hook", "audit", "compliance", "logging"},
		DocsURL:     "https://docs.stablenet.io/modules/audit-hook",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "auditAddress",
				Label:       "Audit Contract",
				Description: "Address of the audit logging contract",
				Type:        TypeAddress,
				Required:    true,
			},
			{
				Name:        "eventFlags",
				Label:       "Event Flags",
				Description: "Flags indicating which events to log",
				Type:        TypeUint32,
				Required:    true,
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0xae0a55d267722102880b774899998a2c338d960d"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// Whitelist Hook
// ============================================================================

// WhitelistHook is the whitelist hook module definition.
var WhitelistHook = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeHook,
		Name:        "Whitelist Hook",
		Description: "Only allow transactions to whitelisted addresses",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"hook", "security", "whitelist", "access-control"},
		DocsURL:     "https://docs.stablenet.io/modules/whitelist-hook",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "whitelistedAddresses",
				Label:       "Whitelisted Addresses",
				Description: "Addresses that can receive transactions",
				Type:        TypeAddressAr,
				Required:    true,
			},
			{
				Name:         "allowSelf",
				Label:        "Allow Self",
				Description:  "Allow transactions to self (account address)",
				Type:         TypeBool,
				Required:     true,
				DefaultValue: "true",
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
// Timelock Hook
// ============================================================================

// TimelockHook is the timelock hook module definition.
var TimelockHook = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeHook,
		Name:        "Timelock Hook",
		Description: "Require time delay for high-value transactions",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"hook", "security", "timelock", "delay"},
		DocsURL:     "https://docs.stablenet.io/modules/timelock-hook",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "threshold",
				Label:       "Value Threshold",
				Description: "Minimum value to trigger timelock (in wei)",
				Type:        TypeUint256,
				Required:    true,
			},
			{
				Name:        "delay",
				Label:       "Delay Period",
				Description: "Delay in seconds before execution",
				Type:        TypeUint64,
				Required:    true,
				Validation: &FieldValidation{
					Min:     "3600",   // 1 hour minimum
					Max:     "604800", // 1 week maximum
					Message: "Delay must be between 1 hour and 1 week",
				},
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
// Hook Gas Limit Configuration
// ============================================================================

// HookGasLimitConfig represents a per-hook gas limit setting.
// GasLimit of 0 means unlimited (backward compatible default).
type HookGasLimitConfig struct {
	// Hook is the hook module address.
	Hook types.Address `json:"hook"`
	// GasLimit is the maximum gas the hook can consume (0 = unlimited).
	GasLimit uint64 `json:"gasLimit"`
}

// ============================================================================
// All Hooks
// ============================================================================

// HookModules contains all built-in hook modules.
var HookModules = []ModuleRegistryEntry{
	SpendingLimitHook,
	AuditHook,
	WhitelistHook,
	TimelockHook,
}
