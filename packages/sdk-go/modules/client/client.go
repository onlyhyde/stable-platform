// Package client provides module query and operation clients for ERC-7579 smart accounts.
package client

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
// Module Query Client
// ============================================================================

// QueryClient provides methods for querying installed modules on a smart account.
type QueryClient struct {
	client     *ethclient.Client
	accountABI abi.ABI
}

// NewQueryClient creates a new module query client.
func NewQueryClient(client *ethclient.Client) (*QueryClient, error) {
	// Parse the ERC-7579 account ABI for module queries
	parsedABI, err := abi.JSON(strings.NewReader(erc7579AccountABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse account ABI: %w", err)
	}

	return &QueryClient{
		client:     client,
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
		return false, fmt.Errorf("failed to unpack isModuleInstalled result: %w", err)
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

// GetInstalledModules returns all installed modules of a specific type by paginating
// through the account's module list via getModulesPaginated.
func (c *QueryClient) GetInstalledModules(ctx context.Context, account types.Address, moduleType types.ModuleType) ([]types.InstalledModule, error) {
	var modules []types.InstalledModule
	sentinel := types.Address(common.HexToAddress("0x0000000000000000000000000000000000000001"))
	cursor := sentinel
	const pageSize uint64 = 100

	for {
		addrs, next, err := c.GetModulesPaginated(ctx, account, moduleType, cursor, pageSize)
		if err != nil {
			// If paginated query fails (e.g., method not supported), return empty
			return modules, nil
		}

		for _, addr := range addrs {
			if addr == (types.Address{}) || addr == sentinel {
				continue
			}
			modules = append(modules, types.InstalledModule{
				Type:    moduleType,
				Address: addr,
				Status:  types.ModuleStatusInstalled,
			})
		}

		// Stop if no next cursor or sentinel reached (end of list)
		if next == (types.Address{}) || next == sentinel || len(addrs) == 0 {
			break
		}
		cursor = next
	}

	return modules, nil
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
		// If call fails, return empty list (method may not be supported)
		return []types.Address{}, types.Address{}, nil
	}

	outputs, err := c.accountABI.Unpack("getModulesPaginated", result)
	if err != nil {
		return nil, types.Address{}, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) < 2 {
		return []types.Address{}, types.Address{}, nil
	}

	// Parse addresses and next cursor
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

// SupportsModule checks if the account supports a specific module interface.
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
		return false, nil // Assume not supported if call fails
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

// ============================================================================
// Module Operation Client
// ============================================================================

// OperationClient provides methods for installing and uninstalling modules.
type OperationClient struct {
	accountABI abi.ABI
}

// NewOperationClient creates a new module operation client.
func NewOperationClient() (*OperationClient, error) {
	parsedABI, err := abi.JSON(strings.NewReader(erc7579AccountABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse account ABI: %w", err)
	}

	return &OperationClient{
		accountABI: parsedABI,
	}, nil
}

// EncodeInstallModule encodes the calldata for installing a module.
func (c *OperationClient) EncodeInstallModule(request types.ModuleInstallRequest) (types.Hex, error) {
	data, err := c.accountABI.Pack(
		"installModule",
		uint256(request.Type),
		common.Address(request.Address),
		request.InitData.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode installModule: %w", err)
	}

	return types.Hex(data), nil
}

// EncodeUninstallModule encodes the calldata for uninstalling a module.
func (c *OperationClient) EncodeUninstallModule(request types.ModuleUninstallRequest) (types.Hex, error) {
	data, err := c.accountABI.Pack(
		"uninstallModule",
		uint256(request.Type),
		common.Address(request.Address),
		request.DeInitData.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode uninstallModule: %w", err)
	}

	return types.Hex(data), nil
}

// EncodeBatchInstallModules encodes calldata for installing multiple modules.
func (c *OperationClient) EncodeBatchInstallModules(requests []types.ModuleInstallRequest) ([]types.Hex, error) {
	results := make([]types.Hex, len(requests))
	for i, req := range requests {
		data, err := c.EncodeInstallModule(req)
		if err != nil {
			return nil, fmt.Errorf("failed to encode module %d: %w", i, err)
		}
		results[i] = data
	}
	return results, nil
}

// EncodeBatchUninstallModules encodes calldata for uninstalling multiple modules.
func (c *OperationClient) EncodeBatchUninstallModules(requests []types.ModuleUninstallRequest) ([]types.Hex, error) {
	results := make([]types.Hex, len(requests))
	for i, req := range requests {
		data, err := c.EncodeUninstallModule(req)
		if err != nil {
			return nil, fmt.Errorf("failed to encode module %d: %w", i, err)
		}
		results[i] = data
	}
	return results, nil
}

// ============================================================================
// Module Installation Builder
// ============================================================================

// InstallBuilder helps build module installation requests.
type InstallBuilder struct {
	requests []types.ModuleInstallRequest
}

// NewInstallBuilder creates a new install builder.
func NewInstallBuilder() *InstallBuilder {
	return &InstallBuilder{
		requests: make([]types.ModuleInstallRequest, 0),
	}
}

// AddValidator adds a validator module installation.
func (b *InstallBuilder) AddValidator(address types.Address, initData types.Hex) *InstallBuilder {
	b.requests = append(b.requests, types.ModuleInstallRequest{
		Type:     types.ModuleTypeValidator,
		Address:  address,
		InitData: initData,
	})
	return b
}

// AddExecutor adds an executor module installation.
func (b *InstallBuilder) AddExecutor(address types.Address, initData types.Hex) *InstallBuilder {
	b.requests = append(b.requests, types.ModuleInstallRequest{
		Type:     types.ModuleTypeExecutor,
		Address:  address,
		InitData: initData,
	})
	return b
}

// AddHook adds a hook module installation.
func (b *InstallBuilder) AddHook(address types.Address, initData types.Hex) *InstallBuilder {
	b.requests = append(b.requests, types.ModuleInstallRequest{
		Type:     types.ModuleTypeHook,
		Address:  address,
		InitData: initData,
	})
	return b
}

// AddFallback adds a fallback module installation.
func (b *InstallBuilder) AddFallback(address types.Address, initData types.Hex) *InstallBuilder {
	b.requests = append(b.requests, types.ModuleInstallRequest{
		Type:     types.ModuleTypeFallback,
		Address:  address,
		InitData: initData,
	})
	return b
}

// Build returns the installation requests.
func (b *InstallBuilder) Build() []types.ModuleInstallRequest {
	return b.requests
}

// ============================================================================
// Module Registry
// ============================================================================

// ModuleRegistry maintains a registry of known modules and their metadata.
type ModuleRegistry struct {
	modules map[types.Address]*types.ModuleMetadata
}

// NewModuleRegistry creates a new module registry.
func NewModuleRegistry() *ModuleRegistry {
	registry := &ModuleRegistry{
		modules: make(map[types.Address]*types.ModuleMetadata),
	}
	// Register known modules
	registry.registerKnownModules()
	return registry
}

// Register registers a module with its metadata.
func (r *ModuleRegistry) Register(address types.Address, metadata *types.ModuleMetadata) {
	r.modules[address] = metadata
}

// Get returns the metadata for a module.
func (r *ModuleRegistry) Get(address types.Address) (*types.ModuleMetadata, bool) {
	metadata, ok := r.modules[address]
	return metadata, ok
}

// GetByType returns all modules of a specific type.
func (r *ModuleRegistry) GetByType(moduleType types.ModuleType) []*ModuleEntry {
	entries := make([]*ModuleEntry, 0)
	for addr, meta := range r.modules {
		if meta.Type == moduleType {
			entries = append(entries, &ModuleEntry{
				Address:  addr,
				Metadata: meta,
			})
		}
	}
	return entries
}

// GetAudited returns all audited modules.
func (r *ModuleRegistry) GetAudited() []*ModuleEntry {
	entries := make([]*ModuleEntry, 0)
	for addr, meta := range r.modules {
		if meta.IsAudited {
			entries = append(entries, &ModuleEntry{
				Address:  addr,
				Metadata: meta,
			})
		}
	}
	return entries
}

// Search searches modules by name or tag.
func (r *ModuleRegistry) Search(query string) []*ModuleEntry {
	entries := make([]*ModuleEntry, 0)
	queryLower := strings.ToLower(query)

	for addr, meta := range r.modules {
		// Check name
		if strings.Contains(strings.ToLower(meta.Name), queryLower) {
			entries = append(entries, &ModuleEntry{
				Address:  addr,
				Metadata: meta,
			})
			continue
		}
		// Check tags
		for _, tag := range meta.Tags {
			if strings.Contains(strings.ToLower(tag), queryLower) {
				entries = append(entries, &ModuleEntry{
					Address:  addr,
					Metadata: meta,
				})
				break
			}
		}
	}
	return entries
}

// ModuleEntry represents a module entry in the registry.
type ModuleEntry struct {
	Address  types.Address
	Metadata *types.ModuleMetadata
}

// registerKnownModules registers the known ERC-7579 modules with their metadata.
func (r *ModuleRegistry) registerKnownModules() {
	// ECDSA Validator — standard EOA ownership validation
	r.Register(types.Address(common.HexToAddress("0x0000000000000000000000000000000000000001")), &types.ModuleMetadata{
		Name:        "ECDSA Validator",
		Description: "Standard ECDSA signature validation for EOA owners",
		Version:     "1.0.0",
		Type:        types.ModuleTypeValidator,
		Tags:        []string{"validator", "ecdsa", "core"},
		IsAudited:   true,
	})

	// WebAuthn Validator — passkey-based authentication
	r.Register(types.Address(common.HexToAddress("0x0000000000000000000000000000000000000002")), &types.ModuleMetadata{
		Name:        "WebAuthn Validator",
		Description: "WebAuthn/passkey-based transaction validation",
		Version:     "1.0.0",
		Type:        types.ModuleTypeValidator,
		Tags:        []string{"validator", "webauthn", "passkey"},
		IsAudited:   true,
	})

	// Session Key Executor — time-limited delegated execution
	r.Register(types.Address(common.HexToAddress("0x0000000000000000000000000000000000000003")), &types.ModuleMetadata{
		Name:        "Session Key Executor",
		Description: "Time-limited delegated transaction execution with spending limits",
		Version:     "1.0.0",
		Type:        types.ModuleTypeExecutor,
		Tags:        []string{"executor", "session-key", "delegation"},
		IsAudited:   true,
	})

	// Spending Limit Hook — per-token spending caps
	r.Register(types.Address(common.HexToAddress("0x0000000000000000000000000000000000000004")), &types.ModuleMetadata{
		Name:        "Spending Limit Hook",
		Description: "Enforces per-token spending limits over configurable time periods",
		Version:     "1.0.0",
		Type:        types.ModuleTypeHook,
		Tags:        []string{"hook", "spending-limit", "security"},
		IsAudited:   true,
	})

	// Social Recovery — guardian-based account recovery
	r.Register(types.Address(common.HexToAddress("0x0000000000000000000000000000000000000005")), &types.ModuleMetadata{
		Name:        "Social Recovery",
		Description: "Guardian-based social recovery for lost account access",
		Version:     "1.0.0",
		Type:        types.ModuleTypeValidator,
		Tags:        []string{"validator", "recovery", "social"},
		IsAudited:   false,
	})

	// Recurring Payment Executor — automated subscription payments
	r.Register(types.Address(common.HexToAddress("0x0000000000000000000000000000000000000006")), &types.ModuleMetadata{
		Name:        "Recurring Payment Executor",
		Description: "Automated recurring payment execution for subscriptions",
		Version:     "1.0.0",
		Type:        types.ModuleTypeExecutor,
		Tags:        []string{"executor", "recurring", "subscription", "payment"},
		IsAudited:   true,
	})
}

// ============================================================================
// Helper Types and Functions
// ============================================================================

// uint256 converts a ModuleType to *big.Int for ABI encoding.
func uint256(t types.ModuleType) *big.Int {
	return big.NewInt(int64(t))
}

// ============================================================================
// ABI Definitions
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
