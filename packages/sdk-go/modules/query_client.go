package modules

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Query Client Types
// ============================================================================

// InstalledModuleInfo contains detailed information about an installed module.
type InstalledModuleInfo struct {
	types.InstalledModule
	// ChainID is the chain ID where the module is installed.
	ChainID uint64 `json:"chainId"`
}

// QueryClientConfig contains configuration for the query client.
type QueryClientConfig struct {
	// Client is the Ethereum client.
	Client *ethclient.Client
	// ChainID is the target chain ID.
	ChainID uint64
}

// ============================================================================
// Query Client
// ============================================================================

// QueryClient provides methods for querying installed modules on smart accounts.
type QueryClient struct {
	client     *ethclient.Client
	chainID    uint64
	accountABI abi.ABI
}

// NewQueryClient creates a new module query client.
func NewQueryClient(cfg QueryClientConfig) (*QueryClient, error) {
	parsedABI, err := abi.JSON(strings.NewReader(erc7579AccountABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse account ABI: %w", err)
	}

	return &QueryClient{
		client:     cfg.Client,
		chainID:    cfg.ChainID,
		accountABI: parsedABI,
	}, nil
}

// IsModuleInstalled checks if a module is installed on the account.
func (c *QueryClient) IsModuleInstalled(ctx context.Context, account types.Address, moduleType types.ModuleType, module types.Address, additionalContext []byte) (bool, error) {
	data, err := c.accountABI.Pack("isModuleInstalled", uint256(moduleType), common.Address(module), additionalContext)
	if err != nil {
		return false, fmt.Errorf("failed to pack isModuleInstalled: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&account),
		Data: data,
	}, nil)
	if err != nil {
		return false, fmt.Errorf("failed to call isModuleInstalled: %w", err)
	}

	outputs, err := c.accountABI.Unpack("isModuleInstalled", result)
	if err != nil {
		return false, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) == 0 {
		return false, nil
	}

	installed, ok := outputs[0].(bool)
	if !ok {
		return false, fmt.Errorf("unexpected result type")
	}

	return installed, nil
}

// GetInstalledModules returns all installed modules of a specific type.
func (c *QueryClient) GetInstalledModules(ctx context.Context, account types.Address, moduleType types.ModuleType) ([]types.InstalledModule, error) {
	// Get modules paginated
	modules, err := c.GetAllModulesByType(ctx, account, moduleType)
	if err != nil {
		return nil, err
	}

	result := make([]types.InstalledModule, 0, len(modules))
	for _, addr := range modules {
		result = append(result, types.InstalledModule{
			Type:    moduleType,
			Address: addr,
			Status:  types.ModuleStatusInstalled,
		})
	}

	return result, nil
}

// GetAllModulesByType returns all module addresses of a type using pagination.
func (c *QueryClient) GetAllModulesByType(ctx context.Context, account types.Address, moduleType types.ModuleType) ([]types.Address, error) {
	var allModules []types.Address
	var cursor types.Address
	pageSize := uint64(100)
	sentinel := common.HexToAddress("0x0000000000000000000000000000000000000001")

	for {
		modules, next, err := c.GetModulesPaginated(ctx, account, moduleType, cursor, pageSize)
		if err != nil {
			// If the method doesn't exist, return empty
			return []types.Address{}, nil
		}

		allModules = append(allModules, modules...)

		// Check if we've reached the end
		if next == sentinel || next == (types.Address{}) || len(modules) == 0 {
			break
		}

		cursor = next
	}

	return allModules, nil
}

// GetModulesPaginated returns modules with pagination.
func (c *QueryClient) GetModulesPaginated(ctx context.Context, account types.Address, moduleType types.ModuleType, start types.Address, pageSize uint64) ([]types.Address, types.Address, error) {
	data, err := c.accountABI.Pack("getModulesPaginated", common.Address(start), big.NewInt(int64(pageSize)))
	if err != nil {
		return nil, types.Address{}, fmt.Errorf("failed to pack getModulesPaginated: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&account),
		Data: data,
	}, nil)
	if err != nil {
		return []types.Address{}, types.Address{}, nil
	}

	outputs, err := c.accountABI.Unpack("getModulesPaginated", result)
	if err != nil {
		return nil, types.Address{}, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) < 2 {
		return []types.Address{}, types.Address{}, nil
	}

	addrs, ok := outputs[0].([]common.Address)
	if !ok {
		return nil, types.Address{}, fmt.Errorf("unexpected addresses type")
	}

	next, ok := outputs[1].(common.Address)
	if !ok {
		return nil, types.Address{}, fmt.Errorf("unexpected next type")
	}

	modules := make([]types.Address, len(addrs))
	for i, addr := range addrs {
		modules[i] = types.Address(addr)
	}

	return modules, types.Address(next), nil
}

// GetInstalledModulesByType returns all installed modules of a specific type.
func (c *QueryClient) GetInstalledModulesByType(ctx context.Context, account types.Address, moduleType types.ModuleType) ([]types.InstalledModule, error) {
	return c.GetInstalledModules(ctx, account, moduleType)
}

// GetPrimaryValidator returns the primary validator module (first installed).
func (c *QueryClient) GetPrimaryValidator(ctx context.Context, account types.Address) (*types.InstalledModule, error) {
	modules, err := c.GetInstalledModules(ctx, account, types.ModuleTypeValidator)
	if err != nil {
		return nil, err
	}

	if len(modules) == 0 {
		return nil, nil
	}

	return &modules[0], nil
}

// HasValidator checks if the account has any validator installed.
func (c *QueryClient) HasValidator(ctx context.Context, account types.Address) (bool, error) {
	modules, err := c.GetInstalledModules(ctx, account, types.ModuleTypeValidator)
	if err != nil {
		return false, err
	}
	return len(modules) > 0, nil
}

// HasHooks checks if the account has any hooks installed.
func (c *QueryClient) HasHooks(ctx context.Context, account types.Address) (bool, error) {
	modules, err := c.GetInstalledModules(ctx, account, types.ModuleTypeHook)
	if err != nil {
		return false, err
	}
	return len(modules) > 0, nil
}

// HasExecutor checks if the account has any executors installed.
func (c *QueryClient) HasExecutor(ctx context.Context, account types.Address) (bool, error) {
	modules, err := c.GetInstalledModules(ctx, account, types.ModuleTypeExecutor)
	if err != nil {
		return false, err
	}
	return len(modules) > 0, nil
}

// SupportsModule checks if the account supports a specific module type.
func (c *QueryClient) SupportsModule(ctx context.Context, account types.Address, moduleTypeId *big.Int) (bool, error) {
	data, err := c.accountABI.Pack("supportsModule", moduleTypeId)
	if err != nil {
		return false, fmt.Errorf("failed to pack supportsModule: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&account),
		Data: data,
	}, nil)
	if err != nil {
		return false, nil
	}

	outputs, err := c.accountABI.Unpack("supportsModule", result)
	if err != nil {
		return false, nil
	}

	if len(outputs) == 0 {
		return false, nil
	}

	supported, ok := outputs[0].(bool)
	if !ok {
		return false, nil
	}

	return supported, nil
}

// GetModuleCount returns the number of installed modules by type.
func (c *QueryClient) GetModuleCount(ctx context.Context, account types.Address, moduleType types.ModuleType) (int, error) {
	modules, err := c.GetInstalledModules(ctx, account, moduleType)
	if err != nil {
		return 0, err
	}
	return len(modules), nil
}

// AccountModuleSummary contains a summary of installed modules.
type AccountModuleSummary struct {
	ValidatorCount int                      `json:"validatorCount"`
	ExecutorCount  int                      `json:"executorCount"`
	HookCount      int                      `json:"hookCount"`
	FallbackCount  int                      `json:"fallbackCount"`
	Validators     []types.InstalledModule  `json:"validators"`
	Executors      []types.InstalledModule  `json:"executors"`
	Hooks          []types.InstalledModule  `json:"hooks"`
	Fallbacks      []types.InstalledModule  `json:"fallbacks"`
}

// GetAccountModuleSummary returns a summary of all installed modules on an account.
func (c *QueryClient) GetAccountModuleSummary(ctx context.Context, account types.Address) (*AccountModuleSummary, error) {
	validators, err := c.GetInstalledModules(ctx, account, types.ModuleTypeValidator)
	if err != nil {
		validators = []types.InstalledModule{}
	}

	executors, err := c.GetInstalledModules(ctx, account, types.ModuleTypeExecutor)
	if err != nil {
		executors = []types.InstalledModule{}
	}

	hooks, err := c.GetInstalledModules(ctx, account, types.ModuleTypeHook)
	if err != nil {
		hooks = []types.InstalledModule{}
	}

	fallbacks, err := c.GetInstalledModules(ctx, account, types.ModuleTypeFallback)
	if err != nil {
		fallbacks = []types.InstalledModule{}
	}

	return &AccountModuleSummary{
		ValidatorCount: len(validators),
		ExecutorCount:  len(executors),
		HookCount:      len(hooks),
		FallbackCount:  len(fallbacks),
		Validators:     validators,
		Executors:      executors,
		Hooks:          hooks,
		Fallbacks:      fallbacks,
	}, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// uint256 converts a ModuleType to *big.Int for ABI encoding.
func uint256(t types.ModuleType) *big.Int {
	return big.NewInt(int64(t))
}

// ============================================================================
// ABI Definition
// ============================================================================

// erc7579AccountABI is the minimal ABI for ERC-7579 module operations.
const erc7579AccountABI = `[
	{
		"name": "installModule",
		"type": "function",
		"inputs": [
			{"name": "moduleTypeId", "type": "uint256"},
			{"name": "module", "type": "address"},
			{"name": "initData", "type": "bytes"}
		],
		"outputs": []
	},
	{
		"name": "uninstallModule",
		"type": "function",
		"inputs": [
			{"name": "moduleTypeId", "type": "uint256"},
			{"name": "module", "type": "address"},
			{"name": "deInitData", "type": "bytes"}
		],
		"outputs": []
	},
	{
		"name": "isModuleInstalled",
		"type": "function",
		"inputs": [
			{"name": "moduleTypeId", "type": "uint256"},
			{"name": "module", "type": "address"},
			{"name": "additionalContext", "type": "bytes"}
		],
		"outputs": [{"name": "", "type": "bool"}]
	},
	{
		"name": "supportsModule",
		"type": "function",
		"inputs": [{"name": "moduleTypeId", "type": "uint256"}],
		"outputs": [{"name": "", "type": "bool"}]
	},
	{
		"name": "getModulesPaginated",
		"type": "function",
		"inputs": [
			{"name": "start", "type": "address"},
			{"name": "pageSize", "type": "uint256"}
		],
		"outputs": [
			{"name": "array", "type": "address[]"},
			{"name": "next", "type": "address"}
		]
	},
	{
		"name": "forceUninstallModule",
		"type": "function",
		"inputs": [
			{"name": "moduleType", "type": "uint256"},
			{"name": "module", "type": "address"},
			{"name": "deInitData", "type": "bytes"}
		],
		"outputs": []
	},
	{
		"name": "replaceModule",
		"type": "function",
		"inputs": [
			{"name": "moduleType", "type": "uint256"},
			{"name": "oldModule", "type": "address"},
			{"name": "deInitData", "type": "bytes"},
			{"name": "newModule", "type": "address"},
			{"name": "initData", "type": "bytes"}
		],
		"outputs": []
	},
	{
		"name": "setHookGasLimit",
		"type": "function",
		"inputs": [
			{"name": "hook", "type": "address"},
			{"name": "gasLimit", "type": "uint256"}
		],
		"outputs": []
	},
	{
		"name": "setDelegatecallWhitelist",
		"type": "function",
		"inputs": [
			{"name": "target", "type": "address"},
			{"name": "allowed", "type": "bool"}
		],
		"outputs": []
	},
	{
		"name": "setEnforceDelegatecallWhitelist",
		"type": "function",
		"inputs": [
			{"name": "enforce", "type": "bool"}
		],
		"outputs": []
	}
]`
