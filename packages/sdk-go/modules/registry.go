// Package modules provides ERC-7579 module system functionality.
package modules

import (
	"math/big"
	"slices"
	"strings"

	"github.com/stablenet/sdk-go/modules/config"
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Types
// ============================================================================

// ModuleSearchFilters contains filters for searching modules.
type ModuleSearchFilters struct {
	// Type filters by module type.
	Type *types.ModuleType `json:"type,omitempty"`
	// Tags filters by tags (any match).
	Tags []string `json:"tags,omitempty"`
	// Verified filters by verified status.
	Verified *bool `json:"verified,omitempty"`
	// ChainID filters by chain support.
	ChainID *uint64 `json:"chainId,omitempty"`
	// Query searches name/description.
	Query string `json:"query,omitempty"`
}

// ValidationResult contains the result of config validation.
type ValidationResult struct {
	// Valid indicates if validation passed.
	Valid bool `json:"valid"`
	// Errors contains validation errors.
	Errors []string `json:"errors,omitempty"`
}

// ModulesByType contains modules grouped by type.
type ModulesByType struct {
	Validators []config.ModuleRegistryEntry `json:"validators"`
	Executors  []config.ModuleRegistryEntry `json:"executors"`
	Hooks      []config.ModuleRegistryEntry `json:"hooks"`
	Fallbacks  []config.ModuleRegistryEntry `json:"fallbacks"`
	Policies   []config.ModuleRegistryEntry `json:"policies"`
	Signers    []config.ModuleRegistryEntry `json:"signers"`
}

// RegistryConfig contains configuration for the module registry.
type RegistryConfig struct {
	// ChainID is the target chain ID.
	ChainID uint64
	// CustomModules are additional custom modules.
	CustomModules []config.ModuleRegistryEntry
}

// ============================================================================
// Module Registry
// ============================================================================

// Registry provides methods for discovering and querying ERC-7579 modules.
type Registry struct {
	chainID uint64
	modules []config.ModuleRegistryEntry
}

// NewRegistry creates a new module registry.
func NewRegistry(cfg RegistryConfig) *Registry {
	// Combine built-in and custom modules
	allModules := make([]config.ModuleRegistryEntry, 0, len(config.BuiltInModules)+len(cfg.CustomModules))
	allModules = append(allModules, config.BuiltInModules...)
	allModules = append(allModules, cfg.CustomModules...)

	return &Registry{
		chainID: cfg.ChainID,
		modules: allModules,
	}
}

// GetAll returns all registered modules for the current chain.
func (r *Registry) GetAll() []config.ModuleRegistryEntry {
	result := make([]config.ModuleRegistryEntry, 0)
	for _, m := range r.modules {
		if r.supportsChain(m) {
			result = append(result, m)
		}
	}
	return result
}

// GetByAddress returns a module by its address on the current chain.
func (r *Registry) GetByAddress(address types.Address) *config.ModuleRegistryEntry {
	normalizedAddr := strings.ToLower(address.Hex())
	for i := range r.modules {
		m := &r.modules[i]
		if chainAddr, ok := m.Addresses[r.chainID]; ok {
			if strings.ToLower(chainAddr.Hex()) == normalizedAddr {
				return m
			}
		}
	}
	return nil
}

// GetByType returns all modules of a specific type.
func (r *Registry) GetByType(moduleType types.ModuleType) []config.ModuleRegistryEntry {
	result := make([]config.ModuleRegistryEntry, 0)
	for _, m := range r.GetAll() {
		if m.Metadata.Type == moduleType {
			result = append(result, m)
		}
	}
	return result
}

// GetByTags returns all modules matching any of the given tags.
func (r *Registry) GetByTags(tags []string) []config.ModuleRegistryEntry {
	result := make([]config.ModuleRegistryEntry, 0)
	for _, m := range r.GetAll() {
		for _, tag := range tags {
			if m.HasTag(tag) {
				result = append(result, m)
				break
			}
		}
	}
	return result
}

// Search searches modules with the given filters.
func (r *Registry) Search(filters ModuleSearchFilters) []config.ModuleRegistryEntry {
	results := r.GetAll()

	// Filter by type
	if filters.Type != nil {
		filtered := make([]config.ModuleRegistryEntry, 0)
		for _, m := range results {
			if m.Metadata.Type == *filters.Type {
				filtered = append(filtered, m)
			}
		}
		results = filtered
	}

	// Filter by tags
	if len(filters.Tags) > 0 {
		filtered := make([]config.ModuleRegistryEntry, 0)
		for _, m := range results {
			for _, tag := range filters.Tags {
				if m.HasTag(tag) {
					filtered = append(filtered, m)
					break
				}
			}
		}
		results = filtered
	}

	// Filter by verified
	if filters.Verified != nil {
		filtered := make([]config.ModuleRegistryEntry, 0)
		for _, m := range results {
			if m.Metadata.IsVerified == *filters.Verified {
				filtered = append(filtered, m)
			}
		}
		results = filtered
	}

	// Filter by chain support
	if filters.ChainID != nil {
		filtered := make([]config.ModuleRegistryEntry, 0)
		for _, m := range results {
			if m.SupportsChain(*filters.ChainID) {
				filtered = append(filtered, m)
			}
		}
		results = filtered
	}

	// Filter by query
	if filters.Query != "" {
		query := strings.ToLower(filters.Query)
		filtered := make([]config.ModuleRegistryEntry, 0)
		for _, m := range results {
			nameLower := strings.ToLower(m.Metadata.Name)
			descLower := strings.ToLower(m.Metadata.Description)
			if strings.Contains(nameLower, query) || strings.Contains(descLower, query) {
				filtered = append(filtered, m)
			}
		}
		results = filtered
	}

	return results
}

// GetModuleAddress returns the module address for the current chain.
func (r *Registry) GetModuleAddress(entry *config.ModuleRegistryEntry) (types.Address, bool) {
	return entry.GetAddress(r.chainID)
}

// ValidateConfig validates configuration against a module's schema.
func (r *Registry) ValidateConfig(entry *config.ModuleRegistryEntry, configData map[string]interface{}) ValidationResult {
	result := ValidationResult{Valid: true, Errors: []string{}}
	schema := entry.ConfigSchema

	for _, field := range schema.Fields {
		value, exists := configData[field.Name]

		// Check required fields
		if field.Required {
			if !exists || value == nil || value == "" {
				result.Errors = append(result.Errors, field.Label+" is required")
				result.Valid = false
				continue
			}
		}

		// Skip validation for optional empty fields
		if !field.Required && (!exists || value == nil) {
			continue
		}

		// Type-specific validation
		if field.Validation != nil {
			if err := validateFieldValue(&field, value); err != "" {
				result.Errors = append(result.Errors, err)
				result.Valid = false
			}
		}
	}

	return result
}

// GetGroupedByType returns modules grouped by type.
func (r *Registry) GetGroupedByType() ModulesByType {
	grouped := ModulesByType{
		Validators: []config.ModuleRegistryEntry{},
		Executors:  []config.ModuleRegistryEntry{},
		Hooks:      []config.ModuleRegistryEntry{},
		Fallbacks:  []config.ModuleRegistryEntry{},
		Policies:   []config.ModuleRegistryEntry{},
		Signers:    []config.ModuleRegistryEntry{},
	}

	for _, m := range r.GetAll() {
		switch m.Metadata.Type {
		case types.ModuleTypeValidator:
			grouped.Validators = append(grouped.Validators, m)
		case types.ModuleTypeExecutor:
			grouped.Executors = append(grouped.Executors, m)
		case types.ModuleTypeHook:
			grouped.Hooks = append(grouped.Hooks, m)
		case types.ModuleTypeFallback:
			grouped.Fallbacks = append(grouped.Fallbacks, m)
		case types.ModuleTypePolicy:
			grouped.Policies = append(grouped.Policies, m)
		case types.ModuleTypeSigner:
			grouped.Signers = append(grouped.Signers, m)
		}
	}

	return grouped
}

// GetValidators returns all validator modules.
func (r *Registry) GetValidators() []config.ModuleRegistryEntry {
	return r.GetByType(types.ModuleTypeValidator)
}

// GetExecutors returns all executor modules.
func (r *Registry) GetExecutors() []config.ModuleRegistryEntry {
	return r.GetByType(types.ModuleTypeExecutor)
}

// GetHooks returns all hook modules.
func (r *Registry) GetHooks() []config.ModuleRegistryEntry {
	return r.GetByType(types.ModuleTypeHook)
}

// GetFallbacks returns all fallback modules.
func (r *Registry) GetFallbacks() []config.ModuleRegistryEntry {
	return r.GetByType(types.ModuleTypeFallback)
}

// GetVerified returns all verified modules.
func (r *Registry) GetVerified() []config.ModuleRegistryEntry {
	verified := true
	return r.Search(ModuleSearchFilters{Verified: &verified})
}

// Register adds a custom module to the registry.
func (r *Registry) Register(module config.ModuleRegistryEntry) {
	r.modules = append(r.modules, module)
}

// ============================================================================
// Helper Functions
// ============================================================================

// supportsChain checks if a module supports the registry's chain.
func (r *Registry) supportsChain(m config.ModuleRegistryEntry) bool {
	return slices.Contains(m.SupportedChains, r.chainID)
}

// validateFieldValue validates a field value against its validation rules.
func validateFieldValue(field *config.ModuleConfigField, value interface{}) string {
	validation := field.Validation
	if validation == nil {
		return ""
	}

	// Numeric validation
	if isNumericType(field.Type) {
		var numValue *big.Int
		switch v := value.(type) {
		case string:
			numValue, _ = new(big.Int).SetString(v, 10)
		case int64:
			numValue = big.NewInt(v)
		case *big.Int:
			numValue = v
		}

		if numValue == nil {
			return field.Label + " must be a valid number"
		}

		if validation.Min != "" {
			minVal, _ := new(big.Int).SetString(validation.Min, 10)
			if minVal != nil && numValue.Cmp(minVal) < 0 {
				if validation.Message != "" {
					return validation.Message
				}
				return field.Label + " must be at least " + validation.Min
			}
		}

		if validation.Max != "" {
			maxVal, _ := new(big.Int).SetString(validation.Max, 10)
			if maxVal != nil && numValue.Cmp(maxVal) > 0 {
				if validation.Message != "" {
					return validation.Message
				}
				return field.Label + " must be at most " + validation.Max
			}
		}
	}

	return ""
}

// isNumericType checks if a type is numeric.
func isNumericType(t config.SolidityType) bool {
	return strings.HasPrefix(string(t), "uint") || strings.HasPrefix(string(t), "int")
}
