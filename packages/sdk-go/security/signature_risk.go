// Package security provides security utilities for wallet operations.
package security

import (
	"math/big"
	"regexp"
	"strings"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Signature Risk Analyzer
// ============================================================================

// SignatureRiskLevel represents the risk level of a signature request.
type SignatureRiskLevel string

const (
	SignatureRiskSafe     SignatureRiskLevel = "safe"
	SignatureRiskLow      SignatureRiskLevel = "low"
	SignatureRiskMedium   SignatureRiskLevel = "medium"
	SignatureRiskHigh     SignatureRiskLevel = "high"
	SignatureRiskCritical SignatureRiskLevel = "critical"
)

// SignatureRiskType represents the type of signature risk.
type SignatureRiskType string

const (
	SignatureRiskTypePermit           SignatureRiskType = "permit"
	SignatureRiskTypePermit2          SignatureRiskType = "permit2"
	SignatureRiskTypeSeaport          SignatureRiskType = "seaport"
	SignatureRiskTypeDelegation       SignatureRiskType = "delegation"
	SignatureRiskTypeUnlimitedAmount  SignatureRiskType = "unlimited_amount"
	SignatureRiskTypeLongExpiry       SignatureRiskType = "long_expiry"
	SignatureRiskTypeUnknownDomain    SignatureRiskType = "unknown_domain"
	SignatureRiskTypeUnknownType      SignatureRiskType = "unknown_type"
	SignatureRiskTypeMalformedData    SignatureRiskType = "malformed_data"
	SignatureRiskTypeContractInteraction SignatureRiskType = "contract_interaction"
)

// SignatureRiskFactor represents a single risk factor found in analysis.
type SignatureRiskFactor struct {
	Type        SignatureRiskType `json:"type"`
	Level       SignatureRiskLevel `json:"level"`
	Description string             `json:"description"`
	Details     map[string]any     `json:"details,omitempty"`
}

// SignatureRiskResult contains the result of signature risk analysis.
type SignatureRiskResult struct {
	Level       SignatureRiskLevel    `json:"level"`
	Score       float64               `json:"score"`
	Factors     []SignatureRiskFactor `json:"factors"`
	Warnings    []string              `json:"warnings"`
	Suggestions []string              `json:"suggestions"`
}

// EIP712TypedData represents EIP-712 typed data for analysis.
type EIP712TypedData struct {
	Types       map[string][]EIP712Type `json:"types"`
	PrimaryType string                  `json:"primaryType"`
	Domain      EIP712Domain            `json:"domain"`
	Message     map[string]any          `json:"message"`
}

// EIP712Type represents a type definition in EIP-712.
type EIP712Type struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// EIP712Domain represents the domain separator for EIP-712.
type EIP712Domain struct {
	Name              string        `json:"name,omitempty"`
	Version           string        `json:"version,omitempty"`
	ChainId           *big.Int      `json:"chainId,omitempty"`
	VerifyingContract types.Address `json:"verifyingContract,omitempty"`
	Salt              types.Hash    `json:"salt,omitempty"`
}

// SignatureRiskAnalyzer analyzes signature requests for potential risks.
type SignatureRiskAnalyzer struct {
	knownPermitContracts map[types.Address]string
	knownSafeContracts   map[types.Address]bool
}

// NewSignatureRiskAnalyzer creates a new SignatureRiskAnalyzer.
func NewSignatureRiskAnalyzer() *SignatureRiskAnalyzer {
	return &SignatureRiskAnalyzer{
		knownPermitContracts: make(map[types.Address]string),
		knownSafeContracts:   make(map[types.Address]bool),
	}
}

// AnalyzeTypedData analyzes EIP-712 typed data for risks.
func (a *SignatureRiskAnalyzer) AnalyzeTypedData(data *EIP712TypedData) *SignatureRiskResult {
	factors := make([]SignatureRiskFactor, 0)
	warnings := make([]string, 0)
	suggestions := make([]string, 0)

	// Check for Permit signatures
	if isPermitSignature(data) {
		factor := a.analyzePermit(data)
		factors = append(factors, factor)
		warnings = append(warnings, "This is a token approval signature (Permit)")
		suggestions = append(suggestions, "Verify the spender address before signing")
	}

	// Check for Permit2 signatures
	if isPermit2Signature(data) {
		factor := a.analyzePermit2(data)
		factors = append(factors, factor)
		warnings = append(warnings, "This is a Permit2 signature - allows token transfers")
		suggestions = append(suggestions, "Check the permitted amount and expiration carefully")
	}

	// Check for Seaport/NFT marketplace signatures
	if isSeaportSignature(data) {
		factors = append(factors, SignatureRiskFactor{
			Type:        SignatureRiskTypeSeaport,
			Level:       SignatureRiskMedium,
			Description: "NFT marketplace order signature detected",
		})
		warnings = append(warnings, "This signature may list your NFT for sale")
	}

	// Check for delegation signatures
	if isDelegationSignature(data) {
		factors = append(factors, SignatureRiskFactor{
			Type:        SignatureRiskTypeDelegation,
			Level:       SignatureRiskHigh,
			Description: "Account delegation signature detected",
		})
		warnings = append(warnings, "This signature grants control to another address")
	}

	// Check domain validity
	domainFactor := a.analyzeDomain(&data.Domain)
	if domainFactor != nil {
		factors = append(factors, *domainFactor)
	}

	// Calculate overall risk
	result := &SignatureRiskResult{
		Level:       calculateSignatureRiskLevel(factors),
		Score:       calculateSignatureRiskScore(factors),
		Factors:     factors,
		Warnings:    warnings,
		Suggestions: suggestions,
	}

	return result
}

// AnalyzeMessage analyzes a personal sign message for risks.
func (a *SignatureRiskAnalyzer) AnalyzeMessage(message string) *SignatureRiskResult {
	factors := make([]SignatureRiskFactor, 0)
	warnings := make([]string, 0)

	// Check for hex-encoded transaction data
	if strings.HasPrefix(message, "0x") && len(message) > 10 {
		factors = append(factors, SignatureRiskFactor{
			Type:        SignatureRiskTypeContractInteraction,
			Level:       SignatureRiskMedium,
			Description: "Message appears to contain encoded data",
		})
		warnings = append(warnings, "This message may contain encoded contract interaction data")
	}

	// Check for suspicious patterns
	suspiciousPatterns := []string{
		"allow", "approve", "transfer", "delegate",
		"setApproval", "permit", "authorization",
	}

	messageLower := strings.ToLower(message)
	for _, pattern := range suspiciousPatterns {
		if strings.Contains(messageLower, pattern) {
			factors = append(factors, SignatureRiskFactor{
				Type:        SignatureRiskTypeUnknownType,
				Level:       SignatureRiskLow,
				Description: "Message contains potentially risky keywords",
				Details:     map[string]any{"pattern": pattern},
			})
			break
		}
	}

	return &SignatureRiskResult{
		Level:    calculateSignatureRiskLevel(factors),
		Score:    calculateSignatureRiskScore(factors),
		Factors:  factors,
		Warnings: warnings,
	}
}

// RegisterSafeContract registers a contract as known safe.
func (a *SignatureRiskAnalyzer) RegisterSafeContract(address types.Address) {
	a.knownSafeContracts[address] = true
}

// analyzePermit analyzes a Permit signature.
func (a *SignatureRiskAnalyzer) analyzePermit(data *EIP712TypedData) SignatureRiskFactor {
	level := SignatureRiskMedium
	details := make(map[string]any)

	// Check for unlimited approval
	if value, ok := data.Message["value"]; ok {
		if valueStr, ok := value.(string); ok {
			if isUnlimitedAmount(valueStr) {
				level = SignatureRiskHigh
				details["unlimited"] = true
			}
		}
	}

	// Check expiry
	if deadline, ok := data.Message["deadline"]; ok {
		details["deadline"] = deadline
		if isLongExpiry(deadline) {
			if level == SignatureRiskMedium {
				level = SignatureRiskHigh
			}
			details["longExpiry"] = true
		}
	}

	return SignatureRiskFactor{
		Type:        SignatureRiskTypePermit,
		Level:       level,
		Description: "ERC-20 Permit signature for token approval",
		Details:     details,
	}
}

// analyzePermit2 analyzes a Permit2 signature.
func (a *SignatureRiskAnalyzer) analyzePermit2(data *EIP712TypedData) SignatureRiskFactor {
	level := SignatureRiskMedium
	details := make(map[string]any)

	// Permit2 is inherently more risky as it handles transfers
	if details, ok := data.Message["permitted"]; ok {
		level = SignatureRiskHigh
		_ = details
	}

	return SignatureRiskFactor{
		Type:        SignatureRiskTypePermit2,
		Level:       level,
		Description: "Permit2 signature for token approval and transfer",
		Details:     details,
	}
}

// analyzeDomain analyzes the EIP-712 domain for risks.
func (a *SignatureRiskAnalyzer) analyzeDomain(domain *EIP712Domain) *SignatureRiskFactor {
	// Check if verifying contract is known
	if domain.VerifyingContract != (types.Address{}) {
		if !a.knownSafeContracts[domain.VerifyingContract] {
			return &SignatureRiskFactor{
				Type:        SignatureRiskTypeUnknownDomain,
				Level:       SignatureRiskLow,
				Description: "Signature request from unknown contract",
				Details: map[string]any{
					"contract": domain.VerifyingContract.Hex(),
					"name":     domain.Name,
				},
			}
		}
	}
	return nil
}

// Helper functions

func isPermitSignature(data *EIP712TypedData) bool {
	return data.PrimaryType == "Permit" || strings.Contains(data.PrimaryType, "Permit")
}

func isPermit2Signature(data *EIP712TypedData) bool {
	return strings.Contains(data.PrimaryType, "Permit2") ||
		strings.Contains(data.Domain.Name, "Permit2")
}

func isSeaportSignature(data *EIP712TypedData) bool {
	return data.PrimaryType == "OrderComponents" ||
		strings.Contains(data.Domain.Name, "Seaport") ||
		strings.Contains(data.Domain.Name, "OpenSea")
}

func isDelegationSignature(data *EIP712TypedData) bool {
	return strings.Contains(data.PrimaryType, "Delegation") ||
		strings.Contains(data.PrimaryType, "Authorization")
}

func isUnlimitedAmount(value string) bool {
	// Check for max uint256 or very large values
	maxUint256 := "115792089237316195423570985008687907853269984665640564039457584007913129639935"
	return value == maxUint256 || len(value) > 70
}

func isLongExpiry(deadline any) bool {
	// Check if deadline is more than 1 year from now
	switch d := deadline.(type) {
	case string:
		if d == "115792089237316195423570985008687907853269984665640564039457584007913129639935" {
			return true
		}
	case float64:
		// If deadline is more than 1 year from now (in seconds)
		oneYearFromNow := float64(365 * 24 * 60 * 60)
		return d > oneYearFromNow
	}
	return false
}

func calculateSignatureRiskLevel(factors []SignatureRiskFactor) SignatureRiskLevel {
	if len(factors) == 0 {
		return SignatureRiskSafe
	}

	maxLevel := SignatureRiskSafe
	for _, factor := range factors {
		if compareRiskLevel(factor.Level, maxLevel) > 0 {
			maxLevel = factor.Level
		}
	}
	return maxLevel
}

func calculateSignatureRiskScore(factors []SignatureRiskFactor) float64 {
	if len(factors) == 0 {
		return 0
	}

	score := 0.0
	for _, factor := range factors {
		switch factor.Level {
		case SignatureRiskCritical:
			score += 1.0
		case SignatureRiskHigh:
			score += 0.75
		case SignatureRiskMedium:
			score += 0.5
		case SignatureRiskLow:
			score += 0.25
		}
	}
	return score / float64(len(factors))
}

func compareRiskLevel(a, b SignatureRiskLevel) int {
	levels := map[SignatureRiskLevel]int{
		SignatureRiskSafe:     0,
		SignatureRiskLow:      1,
		SignatureRiskMedium:   2,
		SignatureRiskHigh:     3,
		SignatureRiskCritical: 4,
	}
	return levels[a] - levels[b]
}

// ============================================================================
// Simple Typed Data Validator (EIP-712)
// ============================================================================

// SimpleTypedDataValidator validates EIP-712 typed data structure.
// For comprehensive validation with phishing detection, use TypedDataValidator from typeddata.go.
type SimpleTypedDataValidator struct{}

// NewSimpleTypedDataValidator creates a new SimpleTypedDataValidator.
func NewSimpleTypedDataValidator() *SimpleTypedDataValidator {
	return &SimpleTypedDataValidator{}
}

// TypedDataValidationResult contains the result of typed data validation.
type TypedDataValidationResult struct {
	IsValid  bool     `json:"isValid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

// Validate validates EIP-712 typed data structure.
func (v *SimpleTypedDataValidator) Validate(data *EIP712TypedData) *TypedDataValidationResult {
	errors := make([]string, 0)
	warnings := make([]string, 0)

	// Check primary type exists
	if data.PrimaryType == "" {
		errors = append(errors, "Primary type is required")
	}

	// Check types definition exists
	if data.Types == nil || len(data.Types) == 0 {
		errors = append(errors, "Types definition is required")
	}

	// Check primary type is defined in types
	if data.Types != nil {
		if _, ok := data.Types[data.PrimaryType]; !ok {
			errors = append(errors, "Primary type not defined in types")
		}
	}

	// Check EIP712Domain type exists
	if data.Types != nil {
		if _, ok := data.Types["EIP712Domain"]; !ok {
			warnings = append(warnings, "EIP712Domain type not explicitly defined")
		}
	}

	// Validate domain
	domainErrors := v.validateDomain(&data.Domain)
	errors = append(errors, domainErrors...)

	// Validate message against types
	if data.Types != nil && data.PrimaryType != "" {
		msgErrors := v.validateMessage(data.Message, data.PrimaryType, data.Types)
		errors = append(errors, msgErrors...)
	}

	return &TypedDataValidationResult{
		IsValid:  len(errors) == 0,
		Errors:   errors,
		Warnings: warnings,
	}
}

// validateDomain validates the EIP-712 domain.
func (v *SimpleTypedDataValidator) validateDomain(domain *EIP712Domain) []string {
	errors := make([]string, 0)

	// At least one domain field should be present
	if domain.Name == "" && domain.Version == "" &&
		domain.ChainId == nil && domain.VerifyingContract == (types.Address{}) {
		errors = append(errors, "Domain must have at least one field")
	}

	// Validate chain ID if present
	if domain.ChainId != nil && domain.ChainId.Sign() <= 0 {
		errors = append(errors, "Chain ID must be positive")
	}

	return errors
}

// validateMessage validates a message against its type definition.
func (v *SimpleTypedDataValidator) validateMessage(message map[string]any, typeName string, types map[string][]EIP712Type) []string {
	errors := make([]string, 0)

	typeFields, ok := types[typeName]
	if !ok {
		errors = append(errors, "Type "+typeName+" not defined")
		return errors
	}

	// Check all required fields are present
	for _, field := range typeFields {
		if _, ok := message[field.Name]; !ok {
			errors = append(errors, "Missing field: "+field.Name)
		}
	}

	return errors
}

// ============================================================================
// Simple Phishing Detector
// ============================================================================

// SimplePhishingDetector detects potential phishing attempts.
// For comprehensive phishing detection, use PhishingDetector from phishing.go.
type SimplePhishingDetector struct {
	knownSafeDomains     map[string]bool
	knownPhishingDomains map[string]bool
	suspiciousPatterns   []*regexp.Regexp
}

// NewSimplePhishingDetector creates a new SimplePhishingDetector.
func NewSimplePhishingDetector() *SimplePhishingDetector {
	detector := &SimplePhishingDetector{
		knownSafeDomains:     make(map[string]bool),
		knownPhishingDomains: make(map[string]bool),
	}

	// Add known safe domains
	safeDomains := []string{
		"uniswap.org", "aave.com", "compound.finance",
		"opensea.io", "blur.io", "metamask.io",
		"etherscan.io", "arbiscan.io", "polygonscan.com",
	}
	for _, domain := range safeDomains {
		detector.knownSafeDomains[domain] = true
	}

	// Compile suspicious patterns
	patterns := []string{
		`(?i)metamask.*login`,
		`(?i)wallet.*connect.*claim`,
		`(?i)airdrop.*claim`,
		`(?i)free.*nft`,
		`(?i)urgent.*action`,
	}
	for _, p := range patterns {
		if re, err := regexp.Compile(p); err == nil {
			detector.suspiciousPatterns = append(detector.suspiciousPatterns, re)
		}
	}

	return detector
}

// SimplePhishingCheckResult contains the result of simple phishing detection.
type SimplePhishingCheckResult struct {
	IsPhishing      bool     `json:"isPhishing"`
	IsSuspicious    bool     `json:"isSuspicious"`
	Confidence      float64  `json:"confidence"`
	Reasons         []string `json:"reasons"`
	Recommendations []string `json:"recommendations"`
}

// CheckURL checks a URL for phishing indicators.
func (d *SimplePhishingDetector) CheckURL(url string) *SimplePhishingCheckResult {
	reasons := make([]string, 0)
	recommendations := make([]string, 0)
	confidence := 0.0

	urlLower := strings.ToLower(url)

	// Extract domain from URL
	domain := extractDomain(urlLower)

	// Check known phishing domains
	if d.knownPhishingDomains[domain] {
		return &SimplePhishingCheckResult{
			IsPhishing:   true,
			IsSuspicious: true,
			Confidence:   1.0,
			Reasons:      []string{"Known phishing domain"},
		}
	}

	// Check for typosquatting of known safe domains
	for safeDomain := range d.knownSafeDomains {
		if isSimilarDomain(domain, safeDomain) && domain != safeDomain {
			reasons = append(reasons, "Domain similar to known safe domain: "+safeDomain)
			confidence += 0.4
		}
	}

	// Check for suspicious patterns in URL
	for _, pattern := range d.suspiciousPatterns {
		if pattern.MatchString(urlLower) {
			reasons = append(reasons, "URL matches suspicious pattern")
			confidence += 0.3
		}
	}

	// Check for suspicious TLDs
	suspiciousTLDs := []string{".xyz", ".tk", ".ml", ".ga", ".cf"}
	for _, tld := range suspiciousTLDs {
		if strings.HasSuffix(domain, tld) {
			reasons = append(reasons, "Suspicious TLD: "+tld)
			confidence += 0.2
		}
	}

	// Check for IP address in URL
	if containsIPAddress(urlLower) {
		reasons = append(reasons, "URL contains IP address")
		confidence += 0.3
	}

	isSuspicious := confidence > 0.3
	isPhishing := confidence > 0.7

	if isSuspicious {
		recommendations = append(recommendations, "Verify the URL carefully before proceeding")
		recommendations = append(recommendations, "Check for official announcements on the project's social media")
	}

	return &SimplePhishingCheckResult{
		IsPhishing:     isPhishing,
		IsSuspicious:   isSuspicious,
		Confidence:     min(confidence, 1.0),
		Reasons:        reasons,
		Recommendations: recommendations,
	}
}

// CheckMessage checks a message for phishing indicators.
func (d *SimplePhishingDetector) CheckMessage(message string) *SimplePhishingCheckResult {
	reasons := make([]string, 0)
	confidence := 0.0

	messageLower := strings.ToLower(message)

	// Check for suspicious patterns
	for _, pattern := range d.suspiciousPatterns {
		if pattern.MatchString(messageLower) {
			reasons = append(reasons, "Message matches suspicious pattern")
			confidence += 0.3
		}
	}

	// Check for urgency indicators
	urgencyWords := []string{"urgent", "immediately", "act now", "limited time", "expires"}
	for _, word := range urgencyWords {
		if strings.Contains(messageLower, word) {
			reasons = append(reasons, "Message contains urgency indicator: "+word)
			confidence += 0.2
		}
	}

	// Check for suspicious requests
	suspiciousRequests := []string{
		"seed phrase", "private key", "secret recovery",
		"enter your wallet", "verify your wallet",
	}
	for _, req := range suspiciousRequests {
		if strings.Contains(messageLower, req) {
			reasons = append(reasons, "Message requests sensitive information")
			confidence += 0.5
		}
	}

	return &SimplePhishingCheckResult{
		IsPhishing:   confidence > 0.7,
		IsSuspicious: confidence > 0.3,
		Confidence:   min(confidence, 1.0),
		Reasons:      reasons,
	}
}

// RegisterSafeDomain adds a domain to the safe list.
func (d *SimplePhishingDetector) RegisterSafeDomain(domain string) {
	d.knownSafeDomains[strings.ToLower(domain)] = true
}

// RegisterPhishingDomain adds a domain to the phishing list.
func (d *SimplePhishingDetector) RegisterPhishingDomain(domain string) {
	d.knownPhishingDomains[strings.ToLower(domain)] = true
}

// Helper functions for PhishingDetector

func extractDomain(url string) string {
	// Remove protocol
	url = strings.TrimPrefix(url, "https://")
	url = strings.TrimPrefix(url, "http://")
	// Get domain part
	if idx := strings.Index(url, "/"); idx != -1 {
		url = url[:idx]
	}
	// Remove port
	if idx := strings.Index(url, ":"); idx != -1 {
		url = url[:idx]
	}
	return url
}

func isSimilarDomain(domain, safeDomain string) bool {
	// Simple check for common typosquatting patterns
	if len(domain) < 3 || len(safeDomain) < 3 {
		return false
	}
	// Check Levenshtein distance (simplified)
	return levenshteinDistance(domain, safeDomain) <= 2
}

func levenshteinDistance(s1, s2 string) int {
	if len(s1) == 0 {
		return len(s2)
	}
	if len(s2) == 0 {
		return len(s1)
	}

	m := make([][]int, len(s1)+1)
	for i := range m {
		m[i] = make([]int, len(s2)+1)
		m[i][0] = i
	}
	for j := range m[0] {
		m[0][j] = j
	}

	for i := 1; i <= len(s1); i++ {
		for j := 1; j <= len(s2); j++ {
			cost := 0
			if s1[i-1] != s2[j-1] {
				cost = 1
			}
			m[i][j] = minInt(
				m[i-1][j]+1,
				m[i][j-1]+1,
				m[i-1][j-1]+cost,
			)
		}
	}

	return m[len(s1)][len(s2)]
}

func minInt(a, b, c int) int {
	if a < b && a < c {
		return a
	}
	if b < c {
		return b
	}
	return c
}

func containsIPAddress(url string) bool {
	ipPattern := regexp.MustCompile(`\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}`)
	return ipPattern.MatchString(url)
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
