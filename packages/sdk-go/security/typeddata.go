// Package security provides EIP-712 typed data validation utilities.
package security

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

// ============================================================================
// Typed Data Types
// ============================================================================

// TypedDataDomain represents an EIP-712 typed data domain.
type TypedDataDomain struct {
	// Name is the domain name.
	Name string `json:"name,omitempty"`
	// Version is the domain version.
	Version string `json:"version,omitempty"`
	// ChainID is the chain ID.
	ChainID interface{} `json:"chainId,omitempty"`
	// VerifyingContract is the verifying contract address.
	VerifyingContract string `json:"verifyingContract,omitempty"`
	// Salt is an optional salt value.
	Salt string `json:"salt,omitempty"`
}

// TypedDataField represents a field in a typed data type.
type TypedDataField struct {
	// Name is the field name.
	Name string `json:"name"`
	// Type is the field type.
	Type string `json:"type"`
}

// TypedData represents EIP-712 typed data.
type TypedData struct {
	// Types contains the type definitions.
	Types map[string][]TypedDataField `json:"types"`
	// PrimaryType is the primary type name.
	PrimaryType string `json:"primaryType"`
	// Domain contains the domain information.
	Domain TypedDataDomain `json:"domain"`
	// Message contains the message data.
	Message map[string]interface{} `json:"message"`
}

// ============================================================================
// Validation Result Types
// ============================================================================

// DomainValidationResult contains the result of domain validation.
type DomainValidationResult struct {
	// IsValid indicates if the typed data is valid.
	IsValid bool `json:"isValid"`
	// Warnings contains warning messages.
	Warnings []DomainWarning `json:"warnings"`
	// Errors contains error messages.
	Errors []string `json:"errors"`
}

// DomainWarning represents a warning about the typed data domain.
type DomainWarning struct {
	// Type indicates the warning type.
	Type DomainWarningType `json:"type"`
	// Message is the warning message.
	Message string `json:"message"`
	// Severity indicates the warning severity.
	Severity WarningSeverity `json:"severity"`
}

// DomainWarningType represents the type of domain warning.
type DomainWarningType string

// DomainWarningType constants.
const (
	WarningChainMismatch           DomainWarningType = "chain_mismatch"
	WarningDomainOriginMismatch    DomainWarningType = "domain_origin_mismatch"
	WarningMissingChainID          DomainWarningType = "missing_chain_id"
	WarningMissingVerifyingContract DomainWarningType = "missing_verifying_contract"
	WarningInvalidVerifyingContract DomainWarningType = "invalid_verifying_contract"
	WarningSuspiciousDomainName    DomainWarningType = "suspicious_domain_name"
	WarningEmptyDomain             DomainWarningType = "empty_domain"
	WarningPermitSignature         DomainWarningType = "permit_signature"
	WarningHighValueApproval       DomainWarningType = "high_value_approval"
)

// WarningSeverity represents the severity of a warning.
type WarningSeverity string

// WarningSeverity constants.
const (
	SeverityLow      WarningSeverity = "low"
	SeverityMedium   WarningSeverity = "medium"
	SeverityHigh     WarningSeverity = "high"
	SeverityCritical WarningSeverity = "critical"
)

// ============================================================================
// Known Protocol Domains
// ============================================================================

// KnownProtocolDomains contains legitimate domain names for common protocols.
var KnownProtocolDomains = map[string][]string{
	"uniswap":   {"app.uniswap.org", "uniswap.org"},
	"opensea":   {"opensea.io"},
	"aave":      {"app.aave.com", "aave.com"},
	"compound":  {"app.compound.finance", "compound.finance"},
	"1inch":     {"app.1inch.io", "1inch.io"},
	"sushiswap": {"app.sushi.com", "sushi.com"},
	"curve":     {"curve.fi"},
	"balancer":  {"app.balancer.fi", "balancer.fi"},
	"lido":      {"stake.lido.fi", "lido.fi"},
}

// SuspiciousPatterns contains patterns in domain names that indicate potential phishing.
var SuspiciousPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)uniswap[^.]`),
	regexp.MustCompile(`(?i)opensea[^.]`),
	regexp.MustCompile(`(?i)metamask`),
	regexp.MustCompile(`(?i)wallet.*connect`),
	regexp.MustCompile(`(?i)airdrop`),
	regexp.MustCompile(`(?i)claim.*reward`),
	regexp.MustCompile(`(?i)free.*nft`),
	regexp.MustCompile(`(?i)urgent`),
}

// MaxUint256Hex is the maximum uint256 value in hex.
const MaxUint256Hex = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

// MaxUint256Dec is the maximum uint256 value in decimal.
const MaxUint256Dec = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

// ============================================================================
// Typed Data Validator
// ============================================================================

// TypedDataValidator validates EIP-712 typed data domains.
type TypedDataValidator struct{}

// NewTypedDataValidator creates a new TypedDataValidator.
func NewTypedDataValidator() *TypedDataValidator {
	return &TypedDataValidator{}
}

// ValidateTypedData validates typed data structure and domain.
func (v *TypedDataValidator) ValidateTypedData(typedData *TypedData, currentChainID uint64, requestOrigin string) *DomainValidationResult {
	errors := []string{}
	warnings := []DomainWarning{}

	// Basic structure validation
	if typedData == nil {
		errors = append(errors, "Typed data must not be nil")
		return &DomainValidationResult{IsValid: false, Warnings: warnings, Errors: errors}
	}

	// Validate required fields
	if typedData.Types == nil || len(typedData.Types) == 0 {
		errors = append(errors, "Typed data must have 'types' field")
	}

	if typedData.PrimaryType == "" {
		errors = append(errors, "Typed data must have 'primaryType' field")
	}

	if typedData.Message == nil || len(typedData.Message) == 0 {
		errors = append(errors, "Typed data must have 'message' field")
	}

	// Validate domain fields
	domainWarnings := v.validateDomain(&typedData.Domain, currentChainID, requestOrigin)
	warnings = append(warnings, domainWarnings...)

	// Check for permit signatures (high risk)
	if v.isPermitSignature(typedData) {
		warnings = append(warnings, DomainWarning{
			Type:     WarningPermitSignature,
			Message:  "This is a token permit signature that grants spending approval",
			Severity: SeverityHigh,
		})
	}

	// Check for high value approvals
	if warning := v.checkHighValueApproval(typedData); warning != nil {
		warnings = append(warnings, *warning)
	}

	return &DomainValidationResult{
		IsValid:  len(errors) == 0,
		Warnings: warnings,
		Errors:   errors,
	}
}

// validateDomain validates the domain fields.
func (v *TypedDataValidator) validateDomain(domain *TypedDataDomain, currentChainID uint64, requestOrigin string) []DomainWarning {
	warnings := []DomainWarning{}

	// Check for empty domain
	if domain.Name == "" && domain.Version == "" && domain.ChainID == nil && domain.VerifyingContract == "" && domain.Salt == "" {
		warnings = append(warnings, DomainWarning{
			Type:     WarningEmptyDomain,
			Message:  "Domain is empty - signature may be replayable across different contexts",
			Severity: SeverityMedium,
		})
		return warnings
	}

	// Validate chain ID
	if domain.ChainID != nil {
		domainChainID := v.parseChainID(domain.ChainID)
		if domainChainID != currentChainID {
			warnings = append(warnings, DomainWarning{
				Type:     WarningChainMismatch,
				Message:  "Domain chain ID (" + strconv.FormatUint(domainChainID, 10) + ") does not match current network (" + strconv.FormatUint(currentChainID, 10) + ")",
				Severity: SeverityCritical,
			})
		}
	} else {
		warnings = append(warnings, DomainWarning{
			Type:     WarningMissingChainID,
			Message:  "Domain does not specify chain ID - signature may be valid on multiple chains",
			Severity: SeverityMedium,
		})
	}

	// Validate verifying contract
	if domain.VerifyingContract != "" {
		if !common.IsHexAddress(domain.VerifyingContract) {
			warnings = append(warnings, DomainWarning{
				Type:     WarningInvalidVerifyingContract,
				Message:  "Verifying contract is not a valid address",
				Severity: SeverityHigh,
			})
		}
	} else {
		warnings = append(warnings, DomainWarning{
			Type:     WarningMissingVerifyingContract,
			Message:  "Domain does not specify verifying contract",
			Severity: SeverityLow,
		})
	}

	// Check domain name against origin
	if domain.Name != "" {
		if warning := v.checkDomainOriginMismatch(domain.Name, requestOrigin); warning != nil {
			warnings = append(warnings, *warning)
		}

		// Check for suspicious patterns
		if warning := v.checkSuspiciousDomainName(domain.Name); warning != nil {
			warnings = append(warnings, *warning)
		}
	}

	return warnings
}

// parseChainID parses a chain ID from various formats.
func (v *TypedDataValidator) parseChainID(chainID interface{}) uint64 {
	switch val := chainID.(type) {
	case int:
		return uint64(val)
	case int64:
		return uint64(val)
	case uint64:
		return val
	case float64:
		return uint64(val)
	case string:
		if strings.HasPrefix(val, "0x") {
			parsed, _ := strconv.ParseUint(val[2:], 16, 64)
			return parsed
		}
		parsed, _ := strconv.ParseUint(val, 10, 64)
		return parsed
	default:
		return 0
	}
}

// checkDomainOriginMismatch checks if domain name matches the requesting origin.
func (v *TypedDataValidator) checkDomainOriginMismatch(domainName, requestOrigin string) *DomainWarning {
	normalizedDomainName := strings.ToLower(domainName)
	normalizedOrigin := strings.ToLower(requestOrigin)

	// Extract hostname from origin
	var originHost string
	if parsedURL, err := url.Parse(normalizedOrigin); err == nil && parsedURL.Hostname() != "" {
		originHost = parsedURL.Hostname()
	} else {
		originHost = normalizedOrigin
	}

	// Check for known protocols
	for protocol, domains := range KnownProtocolDomains {
		if strings.Contains(normalizedDomainName, protocol) {
			isFromLegitimateOrigin := false
			for _, d := range domains {
				if strings.Contains(originHost, d) || strings.HasSuffix(originHost, d) {
					isFromLegitimateOrigin = true
					break
				}
			}
			if !isFromLegitimateOrigin {
				return &DomainWarning{
					Type:     WarningDomainOriginMismatch,
					Message:  "Domain claims to be \"" + domainName + "\" but request is from " + originHost + ". This may be a phishing attempt.",
					Severity: SeverityCritical,
				}
			}
		}
	}

	// Generic mismatch check
	domainNameParts := strings.FieldsFunc(normalizedDomainName, func(r rune) bool {
		return r == ' ' || r == '-' || r == '_'
	})
	originParts := strings.Split(originHost, ".")

	hasMatchingPart := false
	for _, part := range domainNameParts {
		for _, originPart := range originParts {
			if strings.Contains(originPart, part) || strings.Contains(part, originPart) {
				hasMatchingPart = true
				break
			}
		}
		if hasMatchingPart {
			break
		}
	}

	if !hasMatchingPart && len(domainName) > 3 {
		return &DomainWarning{
			Type:     WarningDomainOriginMismatch,
			Message:  "Domain name \"" + domainName + "\" does not match the requesting site (" + originHost + ")",
			Severity: SeverityMedium,
		}
	}

	return nil
}

// checkSuspiciousDomainName checks for suspicious patterns in domain name.
func (v *TypedDataValidator) checkSuspiciousDomainName(domainName string) *DomainWarning {
	for _, pattern := range SuspiciousPatterns {
		if pattern.MatchString(domainName) {
			return &DomainWarning{
				Type:     WarningSuspiciousDomainName,
				Message:  "Domain name \"" + domainName + "\" contains suspicious patterns commonly used in phishing",
				Severity: SeverityHigh,
			}
		}
	}
	return nil
}

// isPermitSignature checks if this is a permit signature (EIP-2612).
func (v *TypedDataValidator) isPermitSignature(data *TypedData) bool {
	if data.PrimaryType == "" || data.Types == nil {
		return false
	}

	primaryType := strings.ToLower(data.PrimaryType)

	// Common permit type names
	if primaryType == "permit" || primaryType == "permit2" {
		return true
	}

	// Check message fields for permit-like structure
	if data.Message != nil {
		permitIndicators := []string{"spender", "value", "nonce", "deadline", "allowed"}
		matchCount := 0

		for key := range data.Message {
			keyLower := strings.ToLower(key)
			for _, indicator := range permitIndicators {
				if keyLower == indicator {
					matchCount++
					break
				}
			}
		}

		if matchCount >= 3 {
			return true
		}
	}

	return false
}

// checkHighValueApproval checks for high value approval in message.
func (v *TypedDataValidator) checkHighValueApproval(data *TypedData) *DomainWarning {
	if data.Message == nil {
		return nil
	}

	valueFields := []string{"value", "amount", "allowed", "allowance"}

	for _, field := range valueFields {
		if value, exists := data.Message[field]; exists {
			strValue := strings.ToLower(strings.TrimSpace(valueToString(value)))
			if strValue == strings.ToLower(MaxUint256Hex) || strValue == MaxUint256Dec {
				return &DomainWarning{
					Type:     WarningHighValueApproval,
					Message:  "This signature grants unlimited token spending approval",
					Severity: SeverityCritical,
				}
			}
		}
	}

	return nil
}

// GetRiskLevel returns the overall risk level from warnings.
func (v *TypedDataValidator) GetRiskLevel(warnings []DomainWarning) WarningSeverity {
	for _, w := range warnings {
		if w.Severity == SeverityCritical {
			return SeverityCritical
		}
	}
	for _, w := range warnings {
		if w.Severity == SeverityHigh {
			return SeverityHigh
		}
	}
	for _, w := range warnings {
		if w.Severity == SeverityMedium {
			return SeverityMedium
		}
	}
	return SeverityLow
}

// FormatWarningsForDisplay formats warnings for user display.
func (v *TypedDataValidator) FormatWarningsForDisplay(warnings []DomainWarning) []string {
	// Sort by severity
	sorted := make([]DomainWarning, len(warnings))
	copy(sorted, warnings)

	severityOrder := map[WarningSeverity]int{
		SeverityCritical: 0,
		SeverityHigh:     1,
		SeverityMedium:   2,
		SeverityLow:      3,
	}

	// Simple bubble sort for small arrays
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if severityOrder[sorted[j].Severity] < severityOrder[sorted[i].Severity] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	result := make([]string, len(sorted))
	for i, w := range sorted {
		prefix := "ℹ️"
		switch w.Severity {
		case SeverityCritical:
			prefix = "🚨"
		case SeverityHigh:
			prefix = "⚠️"
		case SeverityMedium:
			prefix = "⚡"
		}
		result[i] = prefix + " " + w.Message
	}

	return result
}

// ============================================================================
// Helper Functions
// ============================================================================

// valueToString converts an interface{} value to string.
func valueToString(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	case uint64:
		return strconv.FormatUint(val, 10)
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	default:
		return ""
	}
}

// ============================================================================
// Convenience Functions
// ============================================================================

// CreateTypedDataValidator creates a new TypedDataValidator.
func CreateTypedDataValidator() *TypedDataValidator {
	return NewTypedDataValidator()
}
