package config

import (
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Session Key Executor
// ============================================================================

// SessionKeyExecutor is the session key executor module definition.
var SessionKeyExecutor = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeExecutor,
		Name:        "Session Key",
		Description: "Temporary keys with limited permissions for dApp sessions",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"executor", "session", "dapp", "permissions"},
		DocsURL:     "https://docs.stablenet.io/modules/session-key",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "sessionKey",
				Label:       "Session Key Address",
				Description: "Temporary key that can execute transactions",
				Type:        TypeAddress,
				Required:    true,
			},
			{
				Name:        "allowedTargets",
				Label:       "Allowed Targets",
				Description: "Contract addresses the session key can interact with",
				Type:        TypeAddressAr,
				Required:    true,
			},
			{
				Name:        "allowedSelectors",
				Label:       "Allowed Functions",
				Description: "Function selectors that can be called",
				Type:        TypeBytes4Arr,
				Required:    false,
			},
			{
				Name:         "maxValuePerTx",
				Label:        "Max Value Per Transaction",
				Description:  "Maximum ETH value per transaction (in wei)",
				Type:         TypeUint256,
				Required:     true,
				DefaultValue: "0",
			},
			{
				Name:        "validUntil",
				Label:       "Valid Until",
				Description: "Expiration timestamp",
				Type:        TypeUint64,
				Required:    true,
			},
			{
				Name:         "validAfter",
				Label:        "Valid After",
				Description:  "Start timestamp",
				Type:         TypeUint64,
				Required:     true,
				DefaultValue: "0",
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0x621b0872c00f6328bd9001a121af09dd18b193e0"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// Recurring Payment Executor
// ============================================================================

// RecurringPaymentExecutor is the recurring payment executor module definition.
var RecurringPaymentExecutor = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeExecutor,
		Name:        "Recurring Payment",
		Description: "Automated recurring payments (subscriptions, salary, etc.)",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"executor", "payment", "subscription", "automation"},
		DocsURL:     "https://docs.stablenet.io/modules/recurring-payment",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "recipient",
				Label:       "Recipient",
				Description: "Address to receive payments",
				Type:        TypeAddress,
				Required:    true,
			},
			{
				Name:         "token",
				Label:        "Token",
				Description:  "Token address (0x0 for native ETH)",
				Type:         TypeAddress,
				Required:     true,
				DefaultValue: "0x0000000000000000000000000000000000000000",
			},
			{
				Name:        "amount",
				Label:       "Amount",
				Description: "Payment amount per interval",
				Type:        TypeUint256,
				Required:    true,
			},
			{
				Name:        "interval",
				Label:       "Interval",
				Description: "Payment interval in seconds",
				Type:        TypeUint64,
				Required:    true,
				Validation: &FieldValidation{
					Min:     "86400", // 1 day minimum
					Message: "Interval must be at least 1 day (86400 seconds)",
				},
			},
			{
				Name:         "maxPayments",
				Label:        "Max Payments",
				Description:  "Maximum number of payments (0 for unlimited)",
				Type:         TypeUint32,
				Required:     true,
				DefaultValue: "0",
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0x3157c4a86d07a223e3b46f20633f5486e96b8f3c"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// Swap Executor
// ============================================================================

// SwapExecutor is the swap executor module definition.
var SwapExecutor = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeExecutor,
		Name:        "Swap Executor",
		Description: "Execute token swaps through DEX aggregators",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"executor", "swap", "defi", "trading"},
		DocsURL:     "https://docs.stablenet.io/modules/swap-executor",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "router",
				Label:       "DEX Router",
				Description: "DEX router contract address",
				Type:        TypeAddress,
				Required:    true,
			},
			{
				Name:         "slippageTolerance",
				Label:        "Slippage Tolerance",
				Description:  "Maximum slippage in basis points (100 = 1%)",
				Type:         TypeUint256,
				Required:     true,
				DefaultValue: "50",
				Validation: &FieldValidation{
					Max:     "1000", // 10% max
					Message: "Slippage tolerance cannot exceed 10% (1000 basis points)",
				},
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0x2f86f04c1D29Ac39752384B34167a42E6d1730F9"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// Staking Executor
// ============================================================================

// StakingExecutor is the staking executor module definition.
var StakingExecutor = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeExecutor,
		Name:        "Staking Executor",
		Description: "Stake tokens in DeFi protocols",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"executor", "staking", "defi", "yield"},
		DocsURL:     "https://docs.stablenet.io/modules/staking-executor",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "stakingContract",
				Label:       "Staking Contract",
				Description: "The staking contract address",
				Type:        TypeAddress,
				Required:    true,
			},
			{
				Name:        "token",
				Label:       "Token",
				Description: "Token to stake",
				Type:        TypeAddress,
				Required:    true,
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0x037d4ef9321dffb793b3df4adc723946776599e6"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// Lending Executor
// ============================================================================

// LendingExecutor is the lending executor module definition.
var LendingExecutor = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeExecutor,
		Name:        "Lending Executor",
		Description: "Supply and borrow assets from lending protocols",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"executor", "lending", "defi", "borrowing"},
		DocsURL:     "https://docs.stablenet.io/modules/lending-executor",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "lendingPool",
				Label:       "Lending Pool",
				Description: "The lending pool contract address",
				Type:        TypeAddress,
				Required:    true,
			},
			{
				Name:         "maxLTV",
				Label:        "Max Loan-to-Value",
				Description:  "Maximum LTV ratio in basis points",
				Type:         TypeUint256,
				Required:     true,
				DefaultValue: "7000", // 70%
				Validation: &FieldValidation{
					Max:     "9500", // 95%
					Message: "Max LTV cannot exceed 95%",
				},
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0xca65a420afc302a167021a503e80b97d4a22e43b"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// All Executors
// ============================================================================

// ExecutorModules contains all built-in executor modules.
var ExecutorModules = []ModuleRegistryEntry{
	SessionKeyExecutor,
	RecurringPaymentExecutor,
	SwapExecutor,
	StakingExecutor,
	LendingExecutor,
}
