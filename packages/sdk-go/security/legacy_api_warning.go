// Package security provides legacy API warning system for deprecated or dangerous methods.
package security

import (
	"fmt"
	"strings"
	"sync"
)

// ============================================================================
// Deprecation Types
// ============================================================================

// DeprecationStatus represents the deprecation status of an API method.
type DeprecationStatus string

// DeprecationStatus constants.
const (
	DeprecationStatusDeprecated DeprecationStatus = "deprecated"
	DeprecationStatusDangerous  DeprecationStatus = "dangerous"
	DeprecationStatusLegacy     DeprecationStatus = "legacy"
	DeprecationStatusRemoved    DeprecationStatus = "removed"
)

// Note: RiskLevel and related constants are defined in transaction_risk.go

// ApiWarning contains warning information for a deprecated or dangerous API method.
type ApiWarning struct {
	// Method is the API method name.
	Method string `json:"method"`
	// Status is the deprecation status.
	Status DeprecationStatus `json:"status"`
	// Message describes the warning.
	Message string `json:"message"`
	// Alternative suggests a safer alternative method.
	Alternative string `json:"alternative,omitempty"`
	// DocumentationURL links to relevant documentation.
	DocumentationURL string `json:"documentationUrl,omitempty"`
	// ShouldBlock indicates if the method should be blocked entirely.
	ShouldBlock bool `json:"shouldBlock"`
	// RiskLevel indicates the risk level for UI display.
	RiskLevel RiskLevel `json:"riskLevel"`
}

// ============================================================================
// Legacy API Definitions
// ============================================================================

// legacyApis contains all legacy/deprecated API definitions.
var legacyApis = map[string]ApiWarning{
	// Dangerous methods
	"eth_sign": {
		Status: DeprecationStatusDangerous,
		Message: "eth_sign is dangerous! It signs arbitrary data that could authorize any transaction. " +
			"This method can be used by malicious dApps to steal your funds.",
		Alternative:      "Use personal_sign or eth_signTypedData_v4 instead",
		DocumentationURL: "https://docs.metamask.io/wallet/concepts/signing-methods/",
		ShouldBlock:      false, // Can be enabled via settings
		RiskLevel:        RiskLevelCritical,
	},

	// Legacy typed data methods
	"eth_signTypedData": {
		Status: DeprecationStatusLegacy,
		Message: "eth_signTypedData (v1) is a legacy format with known security issues. " +
			"Consider upgrading to eth_signTypedData_v4.",
		Alternative:      "Use eth_signTypedData_v4 instead",
		DocumentationURL: "https://eips.ethereum.org/EIPS/eip-712",
		ShouldBlock:      false,
		RiskLevel:        RiskLevelMedium,
	},

	"eth_signTypedData_v3": {
		Status: DeprecationStatusLegacy,
		Message: "eth_signTypedData_v3 is a legacy version. " +
			"eth_signTypedData_v4 is the recommended standard.",
		Alternative:      "Use eth_signTypedData_v4 instead",
		DocumentationURL: "https://eips.ethereum.org/EIPS/eip-712",
		ShouldBlock:      false,
		RiskLevel:        RiskLevelLow,
	},

	// Deprecated account methods
	"eth_accounts": {
		Status: DeprecationStatusDeprecated,
		Message: "eth_accounts is deprecated in favor of eth_requestAccounts. " +
			"It may return empty array if not previously connected.",
		Alternative:      "Use eth_requestAccounts for initial connection",
		DocumentationURL: "https://eips.ethereum.org/EIPS/eip-1102",
		ShouldBlock:      false,
		RiskLevel:        RiskLevelLow,
	},

	// Legacy network methods
	"net_version": {
		Status:           DeprecationStatusDeprecated,
		Message:          "net_version is deprecated. Use eth_chainId instead for reliable chain identification.",
		Alternative:      "Use eth_chainId instead",
		DocumentationURL: "https://eips.ethereum.org/EIPS/eip-695",
		ShouldBlock:      false,
		RiskLevel:        RiskLevelLow,
	},

	// Removed methods (will error)
	"eth_decrypt": {
		Status: DeprecationStatusRemoved,
		Message: "eth_decrypt has been removed due to security concerns. " +
			"Use application-level encryption instead.",
		ShouldBlock: true,
		RiskLevel:   RiskLevelHigh,
	},

	"eth_getEncryptionPublicKey": {
		Status: DeprecationStatusRemoved,
		Message: "eth_getEncryptionPublicKey has been removed due to security concerns. " +
			"Use application-level encryption instead.",
		ShouldBlock: true,
		RiskLevel:   RiskLevelHigh,
	},

	// Wallet-specific deprecated methods
	"wallet_registerOnboarding": {
		Status:      DeprecationStatusRemoved,
		Message:     "wallet_registerOnboarding is not supported.",
		ShouldBlock: true,
		RiskLevel:   RiskLevelLow,
	},

	// Personal methods
	"personal_ecRecover": {
		Status: DeprecationStatusLegacy,
		Message: "personal_ecRecover is a legacy method. " +
			"Consider using eth_call with ecrecover precompile for on-chain verification.",
		ShouldBlock: false,
		RiskLevel:   RiskLevelLow,
	},
}

// ============================================================================
// Warning Functions
// ============================================================================

// HasApiWarning checks if a method has warnings.
func HasApiWarning(method string) bool {
	_, exists := legacyApis[method]
	return exists
}

// GetApiWarning gets warning info for a method.
func GetApiWarning(method string) *ApiWarning {
	warning, exists := legacyApis[method]
	if !exists {
		return nil
	}
	warning.Method = method
	return &warning
}

// ShouldBlockMethod checks if a method should be blocked.
func ShouldBlockMethod(method string) bool {
	warning, exists := legacyApis[method]
	if !exists {
		return false
	}
	return warning.ShouldBlock
}

// GetAllApiWarnings returns all legacy API warnings.
func GetAllApiWarnings() []ApiWarning {
	warnings := make([]ApiWarning, 0, len(legacyApis))
	for method, warning := range legacyApis {
		warning.Method = method
		warnings = append(warnings, warning)
	}
	return warnings
}

// GetWarningsByStatus returns warnings filtered by status.
func GetWarningsByStatus(status DeprecationStatus) []ApiWarning {
	var warnings []ApiWarning
	for method, warning := range legacyApis {
		if warning.Status == status {
			warning.Method = method
			warnings = append(warnings, warning)
		}
	}
	return warnings
}

// ============================================================================
// UI Formatting
// ============================================================================

// UISeverity represents the severity level for UI display.
type UISeverity string

// UISeverity constants.
const (
	UISeverityInfo    UISeverity = "info"
	UISeverityWarning UISeverity = "warning"
	UISeverityDanger  UISeverity = "danger"
)

// UIWarning represents a formatted warning for UI display.
type UIWarning struct {
	// Title is the warning title.
	Title string `json:"title"`
	// Description is the warning description.
	Description string `json:"description"`
	// Severity is the UI severity level.
	Severity UISeverity `json:"severity"`
	// Action suggests a corrective action.
	Action string `json:"action,omitempty"`
}

// FormatWarningForUI formats a warning for display in approval UI.
func FormatWarningForUI(warning *ApiWarning) *UIWarning {
	if warning == nil {
		return nil
	}

	severityMap := map[RiskLevel]UISeverity{
		RiskLevelLow:      UISeverityInfo,
		RiskLevelMedium:   UISeverityWarning,
		RiskLevelHigh:     UISeverityDanger,
		RiskLevelCritical: UISeverityDanger,
	}

	titles := map[DeprecationStatus]string{
		DeprecationStatusDeprecated: "Deprecated Method",
		DeprecationStatusDangerous:  "⚠️ Dangerous Method",
		DeprecationStatusLegacy:     "Legacy Method",
		DeprecationStatusRemoved:    "Unsupported Method",
	}

	return &UIWarning{
		Title:       titles[warning.Status],
		Description: warning.Message,
		Severity:    severityMap[warning.RiskLevel],
		Action:      warning.Alternative,
	}
}

// CreateConsoleDeprecationNotice creates a deprecation notice for console output.
func CreateConsoleDeprecationNotice(method string) string {
	warning := GetApiWarning(method)
	if warning == nil {
		return ""
	}

	var lines []string
	lines = append(lines, fmt.Sprintf("[Deprecated] %s: %s", strings.ToUpper(string(warning.Status)), method))
	lines = append(lines, warning.Message)

	if warning.Alternative != "" {
		lines = append(lines, fmt.Sprintf("Suggested alternative: %s", warning.Alternative))
	}

	if warning.DocumentationURL != "" {
		lines = append(lines, fmt.Sprintf("Documentation: %s", warning.DocumentationURL))
	}

	return strings.Join(lines, "\n")
}

// ============================================================================
// eth_sign Settings
// ============================================================================

// EthSignSettings contains settings for eth_sign method handling.
type EthSignSettings struct {
	// AllowEthSign indicates whether to allow eth_sign method (dangerous).
	AllowEthSign bool `json:"allowEthSign"`
	// ShowEthSignWarning indicates whether to show warning before eth_sign.
	ShowEthSignWarning bool `json:"showEthSignWarning"`
}

// DefaultEthSignSettings returns the default eth_sign settings.
func DefaultEthSignSettings() EthSignSettings {
	return EthSignSettings{
		AllowEthSign:       false,
		ShowEthSignWarning: true,
	}
}

// ethSignSettingsMutex protects ethSignSettings.
var ethSignSettingsMutex sync.RWMutex

// ethSignSettings holds the current eth_sign settings.
var ethSignSettings = DefaultEthSignSettings()

// UpdateEthSignSettings updates eth_sign settings.
func UpdateEthSignSettings(settings EthSignSettings) {
	ethSignSettingsMutex.Lock()
	defer ethSignSettingsMutex.Unlock()
	ethSignSettings = settings
}

// GetEthSignSettings returns the current eth_sign settings.
func GetEthSignSettings() EthSignSettings {
	ethSignSettingsMutex.RLock()
	defer ethSignSettingsMutex.RUnlock()
	return ethSignSettings
}

// IsEthSignAllowed checks if eth_sign is allowed.
func IsEthSignAllowed() bool {
	ethSignSettingsMutex.RLock()
	defer ethSignSettingsMutex.RUnlock()
	return ethSignSettings.AllowEthSign
}

// ShouldShowEthSignWarning checks if eth_sign warning should be shown.
func ShouldShowEthSignWarning() bool {
	ethSignSettingsMutex.RLock()
	defer ethSignSettingsMutex.RUnlock()
	return ethSignSettings.ShowEthSignWarning
}

// ResetEthSignSettings resets eth_sign settings to defaults.
func ResetEthSignSettings() {
	ethSignSettingsMutex.Lock()
	defer ethSignSettingsMutex.Unlock()
	ethSignSettings = DefaultEthSignSettings()
}

// ============================================================================
// Convenience Functions
// ============================================================================

// CheckMethodAndGetWarning checks a method and returns its warning if any.
// Returns nil if the method is safe to use.
func CheckMethodAndGetWarning(method string) *ApiWarning {
	return GetApiWarning(method)
}

// IsMethodDangerous checks if a method is classified as dangerous.
func IsMethodDangerous(method string) bool {
	warning := GetApiWarning(method)
	return warning != nil && warning.Status == DeprecationStatusDangerous
}

// IsMethodRemoved checks if a method has been removed.
func IsMethodRemoved(method string) bool {
	warning := GetApiWarning(method)
	return warning != nil && warning.Status == DeprecationStatusRemoved
}

// GetMethodRiskLevel returns the risk level of a method.
// Returns RiskLevelLow if the method has no warnings.
func GetMethodRiskLevel(method string) RiskLevel {
	warning := GetApiWarning(method)
	if warning == nil {
		return RiskLevelLow
	}
	return warning.RiskLevel
}
