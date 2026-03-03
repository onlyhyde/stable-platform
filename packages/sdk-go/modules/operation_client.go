package modules

import (
	"context"
	"fmt"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/modules/config"
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Operation Client Types
// ============================================================================

// ConflictCheckResult contains the result of checking for module conflicts.
type ConflictCheckResult struct {
	// HasConflicts indicates if conflicts were found.
	HasConflicts bool `json:"hasConflicts"`
	// Conflicts describes the conflicts found.
	Conflicts []ModuleConflict `json:"conflicts,omitempty"`
	// Warnings contains non-blocking warnings.
	Warnings []string `json:"warnings,omitempty"`
}

// ModuleConflict describes a conflict between modules.
type ModuleConflict struct {
	// Type is the conflict type.
	Type string `json:"type"`
	// Message describes the conflict.
	Message string `json:"message"`
	// ExistingModule is the conflicting existing module.
	ExistingModule types.Address `json:"existingModule,omitempty"`
	// NewModule is the conflicting new module.
	NewModule types.Address `json:"newModule,omitempty"`
}

// InstallValidationResult contains the result of validating an install request.
type InstallValidationResult struct {
	// Valid indicates if the request is valid.
	Valid bool `json:"valid"`
	// Errors contains validation errors.
	Errors []string `json:"errors,omitempty"`
	// Warnings contains non-blocking warnings.
	Warnings []string `json:"warnings,omitempty"`
}

// ModuleCalldata contains encoded calldata for module operations.
type ModuleCalldata struct {
	// To is the target address.
	To types.Address `json:"to"`
	// Data is the encoded calldata.
	Data types.Hex `json:"data"`
	// Value is the ETH value to send (usually 0).
	Value uint64 `json:"value"`
}

// OperationClientConfig contains configuration for the operation client.
type OperationClientConfig struct {
	// Client is the Ethereum client.
	Client *ethclient.Client
	// ChainID is the target chain ID.
	ChainID uint64
	// Registry is the module registry for validation.
	Registry *Registry
}

// ============================================================================
// Operation Client
// ============================================================================

// OperationClient provides methods for preparing module install/uninstall operations.
type OperationClient struct {
	client     *ethclient.Client
	chainID    uint64
	registry   *Registry
	accountABI abi.ABI
}

// NewOperationClient creates a new module operation client.
func NewOperationClient(cfg OperationClientConfig) (*OperationClient, error) {
	parsedABI, err := abi.JSON(strings.NewReader(erc7579AccountABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse account ABI: %w", err)
	}

	return &OperationClient{
		client:     cfg.Client,
		chainID:    cfg.ChainID,
		registry:   cfg.Registry,
		accountABI: parsedABI,
	}, nil
}

// PrepareInstall prepares calldata for installing a module.
func (c *OperationClient) PrepareInstall(account types.Address, request types.ModuleInstallRequest) (*ModuleCalldata, error) {
	data, err := c.accountABI.Pack(
		"installModule",
		uint256(request.Type),
		common.Address(request.Address),
		request.InitData.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode installModule: %w", err)
	}

	return &ModuleCalldata{
		To:    account,
		Data:  types.Hex(data),
		Value: 0,
	}, nil
}

// PrepareUninstall prepares calldata for uninstalling a module.
func (c *OperationClient) PrepareUninstall(account types.Address, request types.ModuleUninstallRequest) (*ModuleCalldata, error) {
	data, err := c.accountABI.Pack(
		"uninstallModule",
		uint256(request.Type),
		common.Address(request.Address),
		request.DeInitData.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode uninstallModule: %w", err)
	}

	return &ModuleCalldata{
		To:    account,
		Data:  types.Hex(data),
		Value: 0,
	}, nil
}

// PrepareBatchInstall prepares calldata for installing multiple modules.
func (c *OperationClient) PrepareBatchInstall(account types.Address, requests []types.ModuleInstallRequest) ([]*ModuleCalldata, error) {
	results := make([]*ModuleCalldata, len(requests))
	for i, req := range requests {
		calldata, err := c.PrepareInstall(account, req)
		if err != nil {
			return nil, fmt.Errorf("failed to prepare install for module %d: %w", i, err)
		}
		results[i] = calldata
	}
	return results, nil
}

// PrepareBatchUninstall prepares calldata for uninstalling multiple modules.
func (c *OperationClient) PrepareBatchUninstall(account types.Address, requests []types.ModuleUninstallRequest) ([]*ModuleCalldata, error) {
	results := make([]*ModuleCalldata, len(requests))
	for i, req := range requests {
		calldata, err := c.PrepareUninstall(account, req)
		if err != nil {
			return nil, fmt.Errorf("failed to prepare uninstall for module %d: %w", i, err)
		}
		results[i] = calldata
	}
	return results, nil
}

// ValidateInstallRequest validates a module install request.
func (c *OperationClient) ValidateInstallRequest(request types.ModuleInstallRequest) InstallValidationResult {
	result := InstallValidationResult{Valid: true, Errors: []string{}, Warnings: []string{}}

	// Check if module address is valid
	if request.Address == (types.Address{}) {
		result.Errors = append(result.Errors, "Module address is required")
		result.Valid = false
	}

	// Check module type
	if request.Type < types.ModuleTypeValidator || request.Type > types.ModuleTypeSigner {
		result.Errors = append(result.Errors, "Invalid module type")
		result.Valid = false
	}

	// Check if module is in registry
	if c.registry != nil {
		entry := c.registry.GetByAddress(request.Address)
		if entry == nil {
			result.Warnings = append(result.Warnings, "Module not found in registry - ensure it's a trusted module")
		} else {
			// Validate type matches
			if entry.Metadata.Type != request.Type {
				result.Errors = append(result.Errors, fmt.Sprintf(
					"Module type mismatch: expected %s, got %s",
					entry.Metadata.Type.String(),
					request.Type.String(),
				))
				result.Valid = false
			}

			// Check if module supports the chain
			if !entry.SupportsChain(c.chainID) {
				result.Warnings = append(result.Warnings, fmt.Sprintf(
					"Module may not be deployed on chain %d",
					c.chainID,
				))
			}

			// Validate init data against schema if provided
			if len(request.InitData) > 0 && len(entry.ConfigSchema.Fields) > 0 {
				result.Warnings = append(result.Warnings, "Init data provided but not validated against schema")
			}
		}
	}

	return result
}

// CheckInstallConflicts checks for conflicts before installing a module.
func (c *OperationClient) CheckInstallConflicts(ctx context.Context, account types.Address, request types.ModuleInstallRequest) (*ConflictCheckResult, error) {
	result := &ConflictCheckResult{
		HasConflicts: false,
		Conflicts:    []ModuleConflict{},
		Warnings:     []string{},
	}

	// Create a query client to check existing modules
	queryClient, err := NewQueryClient(QueryClientConfig{
		Client:  c.client,
		ChainID: c.chainID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create query client: %w", err)
	}

	// Check if module is already installed
	installed, err := queryClient.IsModuleInstalled(ctx, account, request.Type, request.Address, nil)
	if err == nil && installed {
		result.HasConflicts = true
		result.Conflicts = append(result.Conflicts, ModuleConflict{
			Type:      "already_installed",
			Message:   "Module is already installed on this account",
			NewModule: request.Address,
		})
	}

	// For validators, check if there's already a primary validator
	if request.Type == types.ModuleTypeValidator {
		existingValidators, err := queryClient.GetInstalledModules(ctx, account, types.ModuleTypeValidator)
		if err == nil && len(existingValidators) > 0 {
			result.Warnings = append(result.Warnings, fmt.Sprintf(
				"Account already has %d validator(s) installed",
				len(existingValidators),
			))
		}
	}

	// For hooks, check for potential conflicts with execution flow
	if request.Type == types.ModuleTypeHook {
		existingHooks, err := queryClient.GetInstalledModules(ctx, account, types.ModuleTypeHook)
		if err == nil && len(existingHooks) > 2 {
			result.Warnings = append(result.Warnings, "Multiple hooks may impact transaction performance")
		}
	}

	return result, nil
}

// CreateInstallRequest creates an install request from a registry entry.
func (c *OperationClient) CreateInstallRequest(entry *config.ModuleRegistryEntry, initData types.Hex) (*types.ModuleInstallRequest, error) {
	address, ok := entry.GetAddress(c.chainID)
	if !ok {
		return nil, fmt.Errorf("module not deployed on chain %d", c.chainID)
	}

	return &types.ModuleInstallRequest{
		Type:     entry.Metadata.Type,
		Address:  address,
		InitData: initData,
	}, nil
}

// PrepareForceUninstall prepares calldata for force-uninstalling a module (ExcessivelySafeCall).
func (c *OperationClient) PrepareForceUninstall(account types.Address, request types.ModuleForceUninstallRequest) (*ModuleCalldata, error) {
	data, err := c.accountABI.Pack(
		"forceUninstallModule",
		uint256(request.Type),
		common.Address(request.Address),
		request.DeInitData.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode forceUninstallModule: %w", err)
	}

	return &ModuleCalldata{
		To:    account,
		Data:  types.Hex(data),
		Value: 0,
	}, nil
}

// PrepareReplaceModule prepares calldata for atomically replacing a module.
func (c *OperationClient) PrepareReplaceModule(account types.Address, request types.ModuleReplaceRequest) (*ModuleCalldata, error) {
	data, err := c.accountABI.Pack(
		"replaceModule",
		uint256(request.Type),
		common.Address(request.OldAddress),
		request.DeInitData.Bytes(),
		common.Address(request.NewAddress),
		request.InitData.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode replaceModule: %w", err)
	}

	return &ModuleCalldata{
		To:    account,
		Data:  types.Hex(data),
		Value: 0,
	}, nil
}

// PrepareSetHookGasLimit prepares calldata for setting hook gas limit.
func (c *OperationClient) PrepareSetHookGasLimit(account types.Address, request types.HookGasLimitRequest) (*ModuleCalldata, error) {
	data, err := c.accountABI.Pack(
		"setHookGasLimit",
		common.Address(request.HookAddress),
		request.GasLimit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode setHookGasLimit: %w", err)
	}

	return &ModuleCalldata{
		To:    account,
		Data:  types.Hex(data),
		Value: 0,
	}, nil
}

// PrepareSetDelegatecallWhitelist prepares calldata for setting delegatecall whitelist entry.
func (c *OperationClient) PrepareSetDelegatecallWhitelist(account types.Address, request types.DelegatecallWhitelistRequest) (*ModuleCalldata, error) {
	data, err := c.accountABI.Pack(
		"setDelegatecallWhitelist",
		common.Address(request.Target),
		request.Allowed,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode setDelegatecallWhitelist: %w", err)
	}

	return &ModuleCalldata{
		To:    account,
		Data:  types.Hex(data),
		Value: 0,
	}, nil
}

// PrepareEnforceDelegatecallWhitelist prepares calldata for enforcing delegatecall whitelist.
func (c *OperationClient) PrepareEnforceDelegatecallWhitelist(account types.Address, request types.DelegatecallWhitelistEnforceRequest) (*ModuleCalldata, error) {
	data, err := c.accountABI.Pack(
		"setEnforceDelegatecallWhitelist",
		request.Enforce,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode setEnforceDelegatecallWhitelist: %w", err)
	}

	return &ModuleCalldata{
		To:    account,
		Data:  types.Hex(data),
		Value: 0,
	}, nil
}

// CreateUninstallRequest creates an uninstall request from a registry entry.
func (c *OperationClient) CreateUninstallRequest(entry *config.ModuleRegistryEntry, deInitData types.Hex) (*types.ModuleUninstallRequest, error) {
	address, ok := entry.GetAddress(c.chainID)
	if !ok {
		return nil, fmt.Errorf("module not deployed on chain %d", c.chainID)
	}

	return &types.ModuleUninstallRequest{
		Type:       entry.Metadata.Type,
		Address:    address,
		DeInitData: deInitData,
	}, nil
}

// ============================================================================
// Install Builder
// ============================================================================

// InstallBuilder helps build module installation requests.
type InstallBuilder struct {
	requests []types.ModuleInstallRequest
	registry *Registry
	chainID  uint64
}

// NewInstallBuilder creates a new install builder.
func NewInstallBuilder(registry *Registry, chainID uint64) *InstallBuilder {
	return &InstallBuilder{
		requests: make([]types.ModuleInstallRequest, 0),
		registry: registry,
		chainID:  chainID,
	}
}

// Add adds a module installation request.
func (b *InstallBuilder) Add(moduleType types.ModuleType, address types.Address, initData types.Hex) *InstallBuilder {
	b.requests = append(b.requests, types.ModuleInstallRequest{
		Type:     moduleType,
		Address:  address,
		InitData: initData,
	})
	return b
}

// AddValidator adds a validator module installation.
func (b *InstallBuilder) AddValidator(address types.Address, initData types.Hex) *InstallBuilder {
	return b.Add(types.ModuleTypeValidator, address, initData)
}

// AddExecutor adds an executor module installation.
func (b *InstallBuilder) AddExecutor(address types.Address, initData types.Hex) *InstallBuilder {
	return b.Add(types.ModuleTypeExecutor, address, initData)
}

// AddHook adds a hook module installation.
func (b *InstallBuilder) AddHook(address types.Address, initData types.Hex) *InstallBuilder {
	return b.Add(types.ModuleTypeHook, address, initData)
}

// AddFallback adds a fallback module installation.
func (b *InstallBuilder) AddFallback(address types.Address, initData types.Hex) *InstallBuilder {
	return b.Add(types.ModuleTypeFallback, address, initData)
}

// AddFromRegistry adds a module from the registry by entry.
func (b *InstallBuilder) AddFromRegistry(entry *config.ModuleRegistryEntry, initData types.Hex) *InstallBuilder {
	address, ok := entry.GetAddress(b.chainID)
	if ok {
		b.Add(entry.Metadata.Type, address, initData)
	}
	return b
}

// Build returns the installation requests.
func (b *InstallBuilder) Build() []types.ModuleInstallRequest {
	return b.requests
}

// Validate validates all requests.
func (b *InstallBuilder) Validate(client *OperationClient) []InstallValidationResult {
	results := make([]InstallValidationResult, len(b.requests))
	for i, req := range b.requests {
		results[i] = client.ValidateInstallRequest(req)
	}
	return results
}

// Clear clears all requests.
func (b *InstallBuilder) Clear() *InstallBuilder {
	b.requests = make([]types.ModuleInstallRequest, 0)
	return b
}
