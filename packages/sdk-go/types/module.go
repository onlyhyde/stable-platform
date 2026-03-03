package types

import (
	"fmt"
	"math/big"
)

// ModuleType represents the ERC-7579 module type.
type ModuleType uint8

// ERC-7579 Module Types
const (
	ModuleTypeValidator ModuleType = 1
	ModuleTypeExecutor  ModuleType = 2
	ModuleTypeFallback  ModuleType = 3
	ModuleTypeHook      ModuleType = 4
	ModuleTypePolicy    ModuleType = 5
	ModuleTypeSigner    ModuleType = 6
)

// String returns the string name of the module type.
func (m ModuleType) String() string {
	switch m {
	case ModuleTypeValidator:
		return "Validator"
	case ModuleTypeExecutor:
		return "Executor"
	case ModuleTypeFallback:
		return "Fallback"
	case ModuleTypeHook:
		return "Hook"
	case ModuleTypePolicy:
		return "Policy"
	case ModuleTypeSigner:
		return "Signer"
	default:
		return "Unknown"
	}
}

// ModuleStatus represents the installation status of a module.
type ModuleStatus uint8

const (
	ModuleStatusNotInstalled ModuleStatus = iota
	ModuleStatusInstalling
	ModuleStatusInstalled
	ModuleStatusUninstalling
	ModuleStatusFailed
)

// String returns the string name of the module status.
func (s ModuleStatus) String() string {
	switch s {
	case ModuleStatusNotInstalled:
		return "not_installed"
	case ModuleStatusInstalling:
		return "installing"
	case ModuleStatusInstalled:
		return "installed"
	case ModuleStatusUninstalling:
		return "uninstalling"
	case ModuleStatusFailed:
		return "failed"
	default:
		return "unknown"
	}
}

// MarshalJSON serializes ModuleStatus as a JSON string for API compatibility with sdk-ts.
func (s ModuleStatus) MarshalJSON() ([]byte, error) {
	return []byte(`"` + s.String() + `"`), nil
}

// UnmarshalJSON deserializes ModuleStatus from a JSON string.
func (s *ModuleStatus) UnmarshalJSON(data []byte) error {
	str := string(data)
	// Strip quotes
	if len(str) >= 2 && str[0] == '"' && str[len(str)-1] == '"' {
		str = str[1 : len(str)-1]
	}
	switch str {
	case "not_installed":
		*s = ModuleStatusNotInstalled
	case "installing":
		*s = ModuleStatusInstalling
	case "installed":
		*s = ModuleStatusInstalled
	case "uninstalling":
		*s = ModuleStatusUninstalling
	case "failed":
		*s = ModuleStatusFailed
	default:
		return fmt.Errorf("unknown ModuleStatus: %s", str)
	}
	return nil
}

// InstalledModule represents an installed module on a smart account.
type InstalledModule struct {
	Type       ModuleType   `json:"type"`
	Address    Address      `json:"address"`
	InitData   Hex          `json:"initData,omitempty"`
	Status     ModuleStatus `json:"status"`
	InstalledAt *big.Int    `json:"installedAt,omitempty"`
}

// ModuleMetadata provides metadata about a module.
type ModuleMetadata struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Version     string     `json:"version"`
	Author      string     `json:"author,omitempty"`
	Type        ModuleType `json:"type"`
	Tags        []string   `json:"tags,omitempty"`
	IsAudited   bool       `json:"isAudited"`
	AuditUrl    string     `json:"auditUrl,omitempty"`
}

// ModuleInstallRequest represents a request to install a module.
type ModuleInstallRequest struct {
	Type     ModuleType `json:"type"`
	Address  Address    `json:"address"`
	InitData Hex        `json:"initData,omitempty"`
}

// ModuleUninstallRequest represents a request to uninstall a module.
type ModuleUninstallRequest struct {
	Type       ModuleType `json:"type"`
	Address    Address    `json:"address"`
	DeInitData Hex        `json:"deInitData,omitempty"`
}

// ModuleForceUninstallRequest represents a request to force-uninstall a module.
// Uses ExcessivelySafeCall - module revert is ignored.
type ModuleForceUninstallRequest struct {
	Type       ModuleType `json:"type"`
	Address    Address    `json:"address"`
	DeInitData Hex        `json:"deInitData,omitempty"`
}

// ModuleReplaceRequest represents a request to atomically replace a module.
// Supported for VALIDATOR, EXECUTOR, FALLBACK types.
type ModuleReplaceRequest struct {
	Type       ModuleType `json:"type"`
	OldAddress Address    `json:"oldAddress"`
	DeInitData Hex        `json:"deInitData,omitempty"`
	NewAddress Address    `json:"newAddress"`
	InitData   Hex        `json:"initData,omitempty"`
}

// HookGasLimitRequest represents a request to set per-hook gas limit.
// GasLimit of 0 means unlimited (backward compatible).
type HookGasLimitRequest struct {
	HookAddress Address  `json:"hookAddress"`
	GasLimit    *big.Int `json:"gasLimit"`
}

// DelegatecallWhitelistRequest represents a request to set delegatecall whitelist entry.
type DelegatecallWhitelistRequest struct {
	Target  Address `json:"target"`
	Allowed bool    `json:"allowed"`
}

// DelegatecallWhitelistEnforceRequest represents a request to enable/disable delegatecall whitelist enforcement.
type DelegatecallWhitelistEnforceRequest struct {
	Enforce bool `json:"enforce"`
}

// Module operation error constants matching Kernel.sol errors.
const (
	ErrDelegatecallTargetNotWhitelisted = "DelegatecallTargetNotWhitelisted"
	ErrReentrancy                       = "Reentrancy"
)

// ECDSAValidatorConfig represents ECDSA validator initialization config.
type ECDSAValidatorConfig struct {
	Owner Address `json:"owner"`
}

// WebAuthnValidatorConfig represents WebAuthn validator initialization config.
type WebAuthnValidatorConfig struct {
	PubKeyX      *big.Int `json:"pubKeyX"`
	PubKeyY      *big.Int `json:"pubKeyY"`
	CredentialId Hex      `json:"credentialId"`
}

// MultiSigValidatorConfig represents multi-sig validator initialization config.
type MultiSigValidatorConfig struct {
	Signers   []Address `json:"signers"`
	Threshold uint8     `json:"threshold"`
}

// SessionKeyConfig represents session key executor initialization config.
type SessionKeyConfig struct {
	SessionKey      Address   `json:"sessionKey"`
	AllowedTargets  []Address `json:"allowedTargets"`
	AllowedSelectors []Hex    `json:"allowedSelectors,omitempty"`
	SpendLimit      *big.Int  `json:"spendLimit,omitempty"`
	ValidAfter      uint64    `json:"validAfter"`
	ValidUntil      uint64    `json:"validUntil"`
}

// RecurringPaymentConfig represents recurring payment executor config.
type RecurringPaymentConfig struct {
	Recipient     Address  `json:"recipient"`
	Token         Address  `json:"token"`
	Amount        *big.Int `json:"amount"`
	Interval      uint64   `json:"interval"` // seconds
	MaxExecutions uint64   `json:"maxExecutions"`
}

// SpendingLimitConfig represents spending limit hook config.
type SpendingLimitConfig struct {
	Token     Address  `json:"token"`
	Limit     *big.Int `json:"limit"`
	Period    uint64   `json:"period"` // seconds
	Recipient *Address `json:"recipient,omitempty"`
}

// AuditHookConfig represents audit hook configuration.
type AuditHookConfig struct {
	AuditAddress Address `json:"auditAddress"`
	EventFlags   uint32  `json:"eventFlags"`
}

// TokenReceiverConfig represents token receiver fallback configuration.
type TokenReceiverConfig struct {
	SupportedInterfaces []Hex `json:"supportedInterfaces"`
}

// FlashLoanConfig represents flash loan fallback configuration.
type FlashLoanConfig struct {
	AuthorizedBorrower Address            `json:"authorizedBorrower"`
	AllowedTokens      []Address          `json:"allowedTokens"`
	MaxLoanAmounts     map[Address]*big.Int `json:"maxLoanAmounts,omitempty"`
}
