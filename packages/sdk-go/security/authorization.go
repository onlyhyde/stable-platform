// Package security provides security utilities for EIP-7702 authorization risk analysis.
package security

import (
	"strings"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Authorization Risk Types
// ============================================================================

// AuthorizationRiskLevel represents the risk level of an authorization.
type AuthorizationRiskLevel string

// AuthorizationRiskLevel constants.
const (
	AuthRiskLow      AuthorizationRiskLevel = "low"
	AuthRiskMedium   AuthorizationRiskLevel = "medium"
	AuthRiskHigh     AuthorizationRiskLevel = "high"
	AuthRiskCritical AuthorizationRiskLevel = "critical"
)

// AuthorizationRiskResult contains the result of authorization risk analysis.
type AuthorizationRiskResult struct {
	// RiskLevel indicates the overall risk level.
	RiskLevel AuthorizationRiskLevel `json:"riskLevel"`
	// Warnings contains warning messages.
	Warnings []string `json:"warnings"`
	// IsKnownContract indicates if the contract is in the known list.
	IsKnownContract bool `json:"isKnownContract"`
	// ContractInfo contains information about known contracts.
	ContractInfo *AuthorizationContractInfo `json:"contractInfo,omitempty"`
}

// AuthorizationContractInfo contains information about a known contract.
type AuthorizationContractInfo struct {
	// Name is the contract name.
	Name string `json:"name"`
	// Description is the contract description.
	Description string `json:"description"`
	// Features lists the contract's features.
	Features []string `json:"features"`
}

// AuthorizationRiskParams contains parameters for authorization risk analysis.
type AuthorizationRiskParams struct {
	// Account is the account address.
	Account types.Address `json:"account"`
	// ContractAddress is the delegate contract address.
	ContractAddress types.Address `json:"contractAddress"`
	// ChainID is the chain ID.
	ChainID uint64 `json:"chainId"`
	// Origin is the request origin (e.g., dApp domain).
	Origin string `json:"origin"`
}

// ============================================================================
// Known Contract Presets
// ============================================================================

// DelegatePreset represents a known delegate contract.
type DelegatePreset struct {
	// Address is the contract address.
	Address types.Address
	// Name is the contract name.
	Name string
	// Description is the contract description.
	Description string
	// Features lists the contract's features.
	Features []string
}

// DelegatePresets contains known delegate contracts by chain ID.
var DelegatePresets = map[uint64][]DelegatePreset{
	// Ethereum Mainnet
	1: {
		{
			Address:     types.MustAddressFromHex("0x0000000000000000000000000000000000000000"),
			Name:        "Revocation",
			Description: "Revoke smart account delegation",
			Features:    []string{"Return to EOA"},
		},
	},
	// Sepolia Testnet
	11155111: {
		{
			Address:     types.MustAddressFromHex("0x0000000000000000000000000000000000000000"),
			Name:        "Revocation",
			Description: "Revoke smart account delegation",
			Features:    []string{"Return to EOA"},
		},
	},
}

// ZeroAddress is the zero address used for revocation.
var ZeroAddress = types.Address{}

// ============================================================================
// Authorization Risk Analyzer
// ============================================================================

// AuthorizationRiskAnalyzer analyzes EIP-7702 authorization requests for risks.
type AuthorizationRiskAnalyzer struct {
	// customPresets allows adding custom known contracts.
	customPresets map[uint64][]DelegatePreset
}

// NewAuthorizationRiskAnalyzer creates a new AuthorizationRiskAnalyzer.
func NewAuthorizationRiskAnalyzer() *AuthorizationRiskAnalyzer {
	return &AuthorizationRiskAnalyzer{
		customPresets: make(map[uint64][]DelegatePreset),
	}
}

// AddPreset adds a custom delegate preset for a chain.
func (a *AuthorizationRiskAnalyzer) AddPreset(chainID uint64, preset DelegatePreset) {
	a.customPresets[chainID] = append(a.customPresets[chainID], preset)
}

// AnalyzeRisk analyzes an EIP-7702 authorization request for risks.
func (a *AuthorizationRiskAnalyzer) AnalyzeRisk(params AuthorizationRiskParams) *AuthorizationRiskResult {
	warnings := []string{}
	riskLevel := AuthRiskLow
	isKnownContract := false
	var contractInfo *AuthorizationContractInfo

	// Check if this is a revocation
	if isRevocationAddress(params.ContractAddress) {
		return &AuthorizationRiskResult{
			RiskLevel:       AuthRiskLow,
			Warnings:        []string{"This will revoke your smart account delegation and return to a regular EOA."},
			IsKnownContract: true,
			ContractInfo: &AuthorizationContractInfo{
				Name:        "Revocation",
				Description: "Remove smart account delegation",
				Features:    []string{"Return to EOA"},
			},
		}
	}

	// Check if contract is in known presets
	preset := a.findPreset(params.ChainID, params.ContractAddress)
	if preset != nil {
		isKnownContract = true
		contractInfo = &AuthorizationContractInfo{
			Name:        preset.Name,
			Description: preset.Description,
			Features:    preset.Features,
		}
	} else {
		// Unknown contract - higher risk
		riskLevel = AuthRiskHigh
		warnings = append(warnings,
			"This contract is not recognized. Delegating to an unknown contract may put your funds at risk.")
	}

	// Check for suspicious patterns in origin
	if params.Origin != "" && !strings.Contains(params.Origin, "localhost") && !strings.Contains(params.Origin, "stablenet") {
		if !isKnownContract {
			warnings = append(warnings,
				"Request from "+params.Origin+". Verify this is a trusted application before proceeding.")
		}
	}

	// Warn about implications of delegation
	warnings = append(warnings,
		"By signing this authorization, your account will be able to execute smart contract logic. "+
			"This enables features like gas sponsorship and batch transactions, but also means "+
			"the delegate contract controls how your account behaves.")

	// Check for mainnet (extra caution)
	if params.ChainID == 1 {
		if riskLevel == AuthRiskLow {
			riskLevel = AuthRiskMedium
		}
		warnings = append(warnings,
			"This is a mainnet authorization. Proceed with extra caution as real funds are involved.")
	}

	return &AuthorizationRiskResult{
		RiskLevel:       riskLevel,
		Warnings:        warnings,
		IsKnownContract: isKnownContract,
		ContractInfo:    contractInfo,
	}
}

// findPreset finds a known preset for a chain and address.
func (a *AuthorizationRiskAnalyzer) findPreset(chainID uint64, address types.Address) *DelegatePreset {
	// Check custom presets first
	if presets, ok := a.customPresets[chainID]; ok {
		for i := range presets {
			if strings.EqualFold(presets[i].Address.Hex(), address.Hex()) {
				return &presets[i]
			}
		}
	}

	// Check default presets
	if presets, ok := DelegatePresets[chainID]; ok {
		for i := range presets {
			if strings.EqualFold(presets[i].Address.Hex(), address.Hex()) {
				return &presets[i]
			}
		}
	}

	return nil
}

// isRevocationAddress checks if an address is the zero address (revocation).
func isRevocationAddress(address types.Address) bool {
	return address == ZeroAddress
}

// ============================================================================
// Helper Functions
// ============================================================================

// GetAuthorizationSummary returns a human-readable summary of the authorization.
func GetAuthorizationSummary(contractAddress types.Address, chainID uint64, isKnownContract bool, contractName string) string {
	if isRevocationAddress(contractAddress) {
		return "Revoke Smart Account"
	}

	if isKnownContract && contractName != "" {
		return "Upgrade to " + contractName
	}

	shortAddress := contractAddress.Hex()[:10] + "..." + contractAddress.Hex()[len(contractAddress.Hex())-6:]
	return "Delegate to " + shortAddress + " (Chain " + string(rune(chainID)) + ")"
}

// RiskWarningForUI represents a formatted warning for UI display.
type RiskWarningForUI struct {
	// Type indicates the warning type (info, warning, danger).
	Type string `json:"type"`
	// Message is the warning message.
	Message string `json:"message"`
}

// FormatRiskWarningsForUI formats risk warnings for UI display.
func FormatRiskWarningsForUI(result *AuthorizationRiskResult) []RiskWarningForUI {
	warnings := make([]RiskWarningForUI, len(result.Warnings))

	for i, warning := range result.Warnings {
		wType := "info"

		if strings.Contains(warning, "not recognized") ||
			strings.Contains(warning, "unknown") ||
			strings.Contains(warning, "risk") {
			wType = "danger"
		} else if strings.Contains(warning, "caution") ||
			strings.Contains(warning, "verify") ||
			strings.Contains(warning, "mainnet") {
			wType = "warning"
		}

		warnings[i] = RiskWarningForUI{
			Type:    wType,
			Message: warning,
		}
	}

	return warnings
}

// ============================================================================
// Convenience Functions
// ============================================================================

// AnalyzeAuthorizationRisk is a convenience function for quick risk analysis.
func AnalyzeAuthorizationRisk(params AuthorizationRiskParams) *AuthorizationRiskResult {
	analyzer := NewAuthorizationRiskAnalyzer()
	return analyzer.AnalyzeRisk(params)
}
