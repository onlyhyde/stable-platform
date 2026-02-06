// Package modules provides ERC-7579 module system functionality for StableNet smart accounts.
//
// The module system implements the ERC-7579 standard for modular smart accounts,
// supporting four primary module types:
//   - Validators (Type 1): Signature validation and authorization
//   - Executors (Type 2): Specialized transaction execution
//   - Fallbacks (Type 3): Handler for unknown function calls
//   - Hooks (Type 4): Pre/post execution hooks
//
// Additionally, the standard supports:
//   - Policies (Type 5): Transaction policies and permissions
//   - Signers (Type 6): Alternative signing methods
//
// # Components
//
// Registry: Discover and query available modules
//
//	registry := modules.NewRegistry(modules.RegistryConfig{
//	    ChainID: 1,
//	})
//	validators := registry.GetValidators()
//
// QueryClient: Query installed modules on accounts
//
//	queryClient, _ := modules.NewQueryClient(modules.QueryClientConfig{
//	    Client:  ethClient,
//	    ChainID: 1,
//	})
//	installed, _ := queryClient.IsModuleInstalled(ctx, account, types.ModuleTypeValidator, moduleAddr, nil)
//
// OperationClient: Prepare module operations
//
//	opClient, _ := modules.NewOperationClient(modules.OperationClientConfig{
//	    Client:   ethClient,
//	    ChainID:  1,
//	    Registry: registry,
//	})
//	calldata, _ := opClient.PrepareInstall(account, installRequest)
//
// # Module Configuration
//
// Module configurations are defined in the config subpackage:
//
//	import "github.com/stablenet/sdk-go/modules/config"
//
//	// Access built-in module definitions
//	ecdsaValidator := config.ECDSAValidator
//	sessionKeyExecutor := config.SessionKeyExecutor
//	spendingLimitHook := config.SpendingLimitHook
//
// # Module Utils
//
// Utility functions for encoding module initialization data are in the utils subpackage:
//
//	import "github.com/stablenet/sdk-go/modules/utils"
//
//	// Encode ECDSA validator init data
//	initData, _ := utils.EncodeECDSAValidatorInit(types.ECDSAValidatorConfig{
//	    Owner: ownerAddress,
//	})
//
//	// Encode session key executor init data
//	initData, _ := utils.EncodeSessionKeyInit(types.SessionKeyConfig{
//	    SessionKey: sessionKeyAddr,
//	    AllowedTargets: []types.Address{target1, target2},
//	    ValidAfter: 0,
//	    ValidUntil: uint64(time.Now().Add(24*time.Hour).Unix()),
//	})
package modules

// Re-export commonly used types from config package
import "github.com/stablenet/sdk-go/modules/config"

// Type aliases for convenient access
type (
	// ModuleRegistryEntry is an alias for config.ModuleRegistryEntry.
	ModuleRegistryEntry = config.ModuleRegistryEntry

	// ModuleConfigSchema is an alias for config.ModuleConfigSchema.
	ModuleConfigSchema = config.ModuleConfigSchema

	// ModuleConfigField is an alias for config.ModuleConfigField.
	ModuleConfigField = config.ModuleConfigField

	// ModuleMetadataExtended is an alias for config.ModuleMetadataExtended.
	ModuleMetadataExtended = config.ModuleMetadataExtended

	// SolidityType is an alias for config.SolidityType.
	SolidityType = config.SolidityType

	// FieldValidation is an alias for config.FieldValidation.
	FieldValidation = config.FieldValidation
)

// Chain ID constants
const (
	// ChainIDMainnet is the Ethereum mainnet chain ID.
	ChainIDMainnet = config.ChainIDMainnet
	// ChainIDSepolia is the Sepolia testnet chain ID.
	ChainIDSepolia = config.ChainIDSepolia
	// ChainIDLocal is the local development chain ID.
	ChainIDLocal = config.ChainIDLocal
)

// Solidity type constants
const (
	TypeAddress   = config.TypeAddress
	TypeAddressAr = config.TypeAddressAr
	TypeBytes     = config.TypeBytes
	TypeBytes4    = config.TypeBytes4
	TypeBytes4Arr = config.TypeBytes4Arr
	TypeUint8     = config.TypeUint8
	TypeUint32    = config.TypeUint32
	TypeUint48    = config.TypeUint48
	TypeUint64    = config.TypeUint64
	TypeUint256   = config.TypeUint256
	TypeString    = config.TypeString
	TypeBool      = config.TypeBool
)

// Built-in modules
var (
	// BuiltInModules contains all built-in modules.
	BuiltInModules = config.BuiltInModules

	// Validators
	ECDSAValidator    = config.ECDSAValidator
	WebAuthnValidator = config.WebAuthnValidator
	MultiSigValidator = config.MultiSigValidator
	ValidatorModules  = config.ValidatorModules

	// Executors
	SessionKeyExecutor       = config.SessionKeyExecutor
	RecurringPaymentExecutor = config.RecurringPaymentExecutor
	SwapExecutor             = config.SwapExecutor
	StakingExecutor          = config.StakingExecutor
	LendingExecutor          = config.LendingExecutor
	ExecutorModules          = config.ExecutorModules

	// Hooks
	SpendingLimitHook = config.SpendingLimitHook
	AuditHook         = config.AuditHook
	WhitelistHook     = config.WhitelistHook
	TimelockHook      = config.TimelockHook
	HookModules       = config.HookModules

	// Fallbacks
	TokenReceiverFallback     = config.TokenReceiverFallback
	FlashLoanReceiverFallback = config.FlashLoanReceiverFallback
	ERC777ReceiverFallback    = config.ERC777ReceiverFallback
	FallbackModules           = config.FallbackModules

	// DefaultSupportedChains lists the chains supported by default.
	DefaultSupportedChains = config.DefaultSupportedChains
)

// CreateModuleEntry creates a new module registry entry.
var CreateModuleEntry = config.CreateModuleEntry
