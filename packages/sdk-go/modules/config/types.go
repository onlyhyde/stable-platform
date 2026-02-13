// Package config provides module configuration types and definitions.
package config

import (
	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Chain IDs
// ============================================================================

// Chain IDs for module deployment.
const (
	ChainIDMainnet    = 1
	ChainIDSepolia    = 11155111
	ChainIDLocal      = 31337
	ChainIDStableNet  = 8283
)

// DefaultSupportedChains are the chains supported by default.
var DefaultSupportedChains = []uint64{ChainIDMainnet, ChainIDSepolia, ChainIDLocal, ChainIDStableNet}

// ============================================================================
// Module Configuration Schema
// ============================================================================

// SolidityType represents a Solidity type for configuration fields.
type SolidityType string

// Common Solidity types.
const (
	TypeAddress   SolidityType = "address"
	TypeAddressAr SolidityType = "address[]"
	TypeBytes     SolidityType = "bytes"
	TypeBytes4    SolidityType = "bytes4"
	TypeBytes4Arr SolidityType = "bytes4[]"
	TypeUint8     SolidityType = "uint8"
	TypeUint32    SolidityType = "uint32"
	TypeUint48    SolidityType = "uint48"
	TypeUint64    SolidityType = "uint64"
	TypeUint256   SolidityType = "uint256"
	TypeString    SolidityType = "string"
	TypeBool      SolidityType = "bool"
)

// FieldValidation contains validation rules for a config field.
type FieldValidation struct {
	// Min is the minimum value (for numeric types).
	Min string `json:"min,omitempty"`
	// Max is the maximum value (for numeric types).
	Max string `json:"max,omitempty"`
	// Pattern is a regex pattern (for string types).
	Pattern string `json:"pattern,omitempty"`
	// Message is a custom validation error message.
	Message string `json:"message,omitempty"`
}

// ModuleConfigField represents a single configuration field.
type ModuleConfigField struct {
	// Name is the field identifier.
	Name string `json:"name"`
	// Label is the human-readable name.
	Label string `json:"label"`
	// Description explains the field's purpose.
	Description string `json:"description"`
	// Type is the Solidity type.
	Type SolidityType `json:"type"`
	// Required indicates if the field is mandatory.
	Required bool `json:"required"`
	// DefaultValue is the default value (as string).
	DefaultValue string `json:"defaultValue,omitempty"`
	// Validation contains validation rules.
	Validation *FieldValidation `json:"validation,omitempty"`
}

// ModuleConfigSchema defines the configuration schema for a module.
type ModuleConfigSchema struct {
	// Version is the schema version.
	Version string `json:"version"`
	// Fields are the configuration fields.
	Fields []ModuleConfigField `json:"fields"`
}

// ============================================================================
// Module Registry Entry
// ============================================================================

// ModuleMetadataExtended extends ModuleMetadata with additional fields.
type ModuleMetadataExtended struct {
	// Type is the module type.
	Type types.ModuleType `json:"type"`
	// Name is the module name.
	Name string `json:"name"`
	// Description explains the module.
	Description string `json:"description"`
	// Version is the module version.
	Version string `json:"version"`
	// Author is the module author.
	Author string `json:"author,omitempty"`
	// IsVerified indicates if the module is verified.
	IsVerified bool `json:"isVerified"`
	// Tags are searchable tags.
	Tags []string `json:"tags,omitempty"`
	// DocsURL is the documentation URL.
	DocsURL string `json:"docsUrl,omitempty"`
}

// ModuleRegistryEntry is a complete module entry in the registry.
type ModuleRegistryEntry struct {
	// Metadata contains module information.
	Metadata ModuleMetadataExtended `json:"metadata"`
	// ConfigSchema defines the configuration schema.
	ConfigSchema ModuleConfigSchema `json:"configSchema"`
	// Addresses contains chain-specific addresses.
	Addresses map[uint64]types.Address `json:"addresses"`
	// SupportedChains lists supported chain IDs.
	SupportedChains []uint64 `json:"supportedChains"`
}

// ============================================================================
// Helper Functions
// ============================================================================

// CreateModuleEntry creates a new module registry entry.
func CreateModuleEntry(
	metadata ModuleMetadataExtended,
	configSchema ModuleConfigSchema,
	addresses map[uint64]types.Address,
	supportedChains []uint64,
) ModuleRegistryEntry {
	if len(supportedChains) == 0 {
		supportedChains = DefaultSupportedChains
	}
	return ModuleRegistryEntry{
		Metadata:        metadata,
		ConfigSchema:    configSchema,
		Addresses:       addresses,
		SupportedChains: supportedChains,
	}
}

// GetAddress returns the module address for a specific chain.
func (e *ModuleRegistryEntry) GetAddress(chainID uint64) (types.Address, bool) {
	addr, ok := e.Addresses[chainID]
	return addr, ok
}

// SupportsChain checks if the module supports a chain.
func (e *ModuleRegistryEntry) SupportsChain(chainID uint64) bool {
	for _, id := range e.SupportedChains {
		if id == chainID {
			return true
		}
	}
	return false
}

// HasTag checks if the module has a specific tag.
func (e *ModuleRegistryEntry) HasTag(tag string) bool {
	for _, t := range e.Metadata.Tags {
		if t == tag {
			return true
		}
	}
	return false
}
