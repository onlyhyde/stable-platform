// Package security provides phishing detection utilities for wallet protection.
package security

import (
	"net"
	"net/url"
	"strings"
	"unicode"
)

// ============================================================================
// Risk Level Types
// ============================================================================

// PhishingRiskLevel represents the risk level of a URL or domain.
type PhishingRiskLevel string

// PhishingRiskLevel constants.
const (
	RiskSafe     PhishingRiskLevel = "safe"
	RiskLow      PhishingRiskLevel = "low"
	RiskMedium   PhishingRiskLevel = "medium"
	RiskHigh     PhishingRiskLevel = "high"
	RiskCritical PhishingRiskLevel = "critical"
)

// PhishingPatternType represents the type of phishing pattern detected.
type PhishingPatternType string

// PhishingPatternType constants.
const (
	PatternBlocklisted        PhishingPatternType = "blocklisted"
	PatternTyposquatting      PhishingPatternType = "typosquatting"
	PatternHomograph          PhishingPatternType = "homograph"
	PatternSuspiciousSubdomain PhishingPatternType = "suspicious_subdomain"
	PatternIPAddress          PhishingPatternType = "ip_address"
	PatternInvalidURL         PhishingPatternType = "invalid_url"
	PatternSuspiciousTLD      PhishingPatternType = "suspicious_tld"
)

// ============================================================================
// Result Types
// ============================================================================

// PhishingResult contains the result of a URL phishing check.
type PhishingResult struct {
	// URL is the checked URL.
	URL string `json:"url"`
	// Domain is the domain of the URL.
	Domain string `json:"domain"`
	// BaseDomain is the base domain (without subdomains).
	BaseDomain string `json:"baseDomain,omitempty"`
	// IsSafe indicates if the URL is considered safe.
	IsSafe bool `json:"isSafe"`
	// RiskLevel indicates the risk level.
	RiskLevel PhishingRiskLevel `json:"riskLevel"`
	// PatternType indicates the type of phishing pattern detected.
	PatternType PhishingPatternType `json:"patternType,omitempty"`
	// Warnings contains warning messages.
	Warnings []string `json:"warnings"`
	// Details provides additional details.
	Details string `json:"details,omitempty"`
}

// DomainResult contains the result of a domain phishing check.
type DomainResult struct {
	// Domain is the checked domain.
	Domain string `json:"domain"`
	// BaseDomain is the base domain.
	BaseDomain string `json:"baseDomain,omitempty"`
	// IsSafe indicates if the domain is considered safe.
	IsSafe bool `json:"isSafe"`
	// RiskLevel indicates the risk level.
	RiskLevel PhishingRiskLevel `json:"riskLevel"`
	// Warnings contains warning messages.
	Warnings []string `json:"warnings"`
}

// PhishingDetectorConfig contains configuration for the phishing detector.
type PhishingDetectorConfig struct {
	// Blocklist is a list of blocked domains.
	Blocklist []string `json:"blocklist,omitempty"`
	// Allowlist is a list of allowed domains.
	Allowlist []string `json:"allowlist,omitempty"`
	// TrustedDomains is a list of known trusted domains.
	TrustedDomains []string `json:"trustedDomains,omitempty"`
}

// ============================================================================
// Default Lists
// ============================================================================

// DefaultTrustedDomains contains known trusted Web3 domains.
var DefaultTrustedDomains = []string{
	"uniswap.org",
	"opensea.io",
	"metamask.io",
	"etherscan.io",
	"aave.com",
	"compound.finance",
	"curve.fi",
	"sushiswap.com",
	"balancer.fi",
	"1inch.io",
}

// SuspiciousTLDs contains TLDs commonly used in phishing.
var SuspiciousTLDs = []string{
	".xyz",
	".top",
	".work",
	".click",
	".tk",
	".ml",
	".ga",
	".cf",
	".gq",
	".buzz",
	".monster",
}

// ConfusableChars maps characters that look similar to ASCII.
var ConfusableChars = map[rune]rune{
	'а': 'a', // Cyrillic
	'е': 'e', // Cyrillic
	'і': 'i', // Cyrillic
	'о': 'o', // Cyrillic
	'р': 'p', // Cyrillic
	'с': 'c', // Cyrillic
	'ѕ': 's', // Cyrillic
	'х': 'x', // Cyrillic
	'у': 'y', // Cyrillic
	'ω': 'w', // Greek
	'ν': 'v', // Greek
	'α': 'a', // Greek
	'0': 'o',
	'1': 'l',
}

// SuspiciousKeywords contains keywords commonly used in phishing subdomains.
var SuspiciousKeywords = []string{
	"metamask",
	"uniswap",
	"opensea",
	"ledger",
	"trezor",
	"coinbase",
	"binance",
	"wallet",
	"connect",
	"claim",
	"airdrop",
}

// ============================================================================
// Phishing Detector
// ============================================================================

// PhishingDetector checks URLs and domains for potential phishing threats.
type PhishingDetector struct {
	blocklist      map[string]bool
	allowlist      map[string]bool
	trustedDomains map[string]bool
}

// NewPhishingDetector creates a new PhishingDetector.
func NewPhishingDetector(config *PhishingDetectorConfig) *PhishingDetector {
	d := &PhishingDetector{
		blocklist:      make(map[string]bool),
		allowlist:      make(map[string]bool),
		trustedDomains: make(map[string]bool),
	}

	if config != nil {
		for _, domain := range config.Blocklist {
			d.blocklist[strings.ToLower(domain)] = true
		}
		for _, domain := range config.Allowlist {
			d.allowlist[strings.ToLower(domain)] = true
		}
		for _, domain := range config.TrustedDomains {
			d.trustedDomains[strings.ToLower(domain)] = true
		}
	}

	// Add default trusted domains
	for _, domain := range DefaultTrustedDomains {
		d.trustedDomains[strings.ToLower(domain)] = true
	}

	return d
}

// CheckURL checks a URL for phishing threats.
func (d *PhishingDetector) CheckURL(urlStr string) *PhishingResult {
	warnings := []string{}

	// Try to parse the URL
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return &PhishingResult{
			URL:         urlStr,
			Domain:      "",
			IsSafe:      false,
			RiskLevel:   RiskMedium,
			PatternType: PatternInvalidURL,
			Warnings:    []string{"Unable to parse URL"},
			Details:     "The URL format is invalid",
		}
	}

	domain := strings.ToLower(parsedURL.Hostname())
	baseDomain := d.getBaseDomain(domain)

	// Check for HTTP (non-secure) connection
	if parsedURL.Scheme == "http" {
		warnings = append(warnings, "Connection is not secure (HTTP)")
	}

	// Check if allowlisted (highest priority)
	if d.isAllowlisted(domain) || d.isAllowlisted(baseDomain) {
		return &PhishingResult{
			URL:        urlStr,
			Domain:     domain,
			BaseDomain: baseDomain,
			IsSafe:     true,
			RiskLevel:  RiskSafe,
			Warnings:   warnings,
		}
	}

	// Check if blocklisted
	if d.isBlocklisted(domain) || d.isBlocklisted(baseDomain) {
		return &PhishingResult{
			URL:         urlStr,
			Domain:      domain,
			BaseDomain:  baseDomain,
			IsSafe:      false,
			RiskLevel:   RiskCritical,
			PatternType: PatternBlocklisted,
			Warnings:    append(warnings, "Domain is blocklisted"),
			Details:     "This domain has been reported for phishing",
		}
	}

	// Check for IP address
	if d.isIPAddress(domain) {
		return &PhishingResult{
			URL:         urlStr,
			Domain:      domain,
			BaseDomain:  baseDomain,
			IsSafe:      false,
			RiskLevel:   RiskMedium,
			PatternType: PatternIPAddress,
			Warnings:    append(warnings, "Direct IP address access detected"),
			Details:     "Legitimate dApps rarely use IP addresses",
		}
	}

	// Check for homograph attacks
	if d.isPunycodeDomain(domain) || d.hasHomographCharacters(domain) {
		return &PhishingResult{
			URL:         urlStr,
			Domain:      domain,
			BaseDomain:  baseDomain,
			IsSafe:      false,
			RiskLevel:   RiskCritical,
			PatternType: PatternHomograph,
			Warnings:    append(warnings, "Potential homograph attack detected"),
			Details:     "Domain contains non-ASCII characters that may look similar to ASCII letters",
		}
	}

	// Check for typosquatting
	if target := d.detectTyposquatting(baseDomain); target != "" {
		return &PhishingResult{
			URL:         urlStr,
			Domain:      domain,
			BaseDomain:  baseDomain,
			IsSafe:      false,
			RiskLevel:   RiskHigh,
			PatternType: PatternTyposquatting,
			Warnings:    append(warnings, "Possible typosquatting of "+target),
			Details:     "This domain is suspiciously similar to " + target,
		}
	}

	// Check for suspicious subdomain patterns
	if d.hasSuspiciousSubdomain(domain) {
		return &PhishingResult{
			URL:         urlStr,
			Domain:      domain,
			BaseDomain:  baseDomain,
			IsSafe:      false,
			RiskLevel:   RiskHigh,
			PatternType: PatternSuspiciousSubdomain,
			Warnings:    append(warnings, "Suspicious subdomain pattern detected"),
			Details:     "Subdomain contains known wallet/dApp names to mislead users",
		}
	}

	// Check for suspicious TLD
	if d.hasSuspiciousTLD(domain) {
		warnings = append(warnings, "Domain uses suspicious TLD")
	}

	// Check if it's a known trusted domain
	if d.trustedDomains[baseDomain] {
		return &PhishingResult{
			URL:        urlStr,
			Domain:     domain,
			BaseDomain: baseDomain,
			IsSafe:     true,
			RiskLevel:  RiskSafe,
			Warnings:   warnings,
		}
	}

	// Default: unknown domain - treat with caution
	riskLevel := RiskLow
	if len(warnings) > 0 {
		riskLevel = RiskMedium
	}
	if len(warnings) == 0 {
		warnings = append(warnings, "Unknown domain - proceed with caution")
	}

	return &PhishingResult{
		URL:        urlStr,
		Domain:     domain,
		BaseDomain: baseDomain,
		IsSafe:     false,
		RiskLevel:  riskLevel,
		Warnings:   warnings,
	}
}

// CheckDomain checks a domain for phishing threats.
func (d *PhishingDetector) CheckDomain(domain string) *DomainResult {
	domain = strings.ToLower(domain)
	warnings := []string{}
	baseDomain := d.getBaseDomain(domain)

	// Check for suspicious TLD
	if d.hasSuspiciousTLD(domain) {
		warnings = append(warnings, "Domain uses suspicious TLD")
	}

	// Check if allowlisted
	if d.isAllowlisted(domain) || d.isAllowlisted(baseDomain) {
		return &DomainResult{
			Domain:     domain,
			BaseDomain: baseDomain,
			IsSafe:     true,
			RiskLevel:  RiskSafe,
			Warnings:   warnings,
		}
	}

	// Check if blocklisted
	if d.isBlocklisted(domain) || d.isBlocklisted(baseDomain) {
		return &DomainResult{
			Domain:     domain,
			BaseDomain: baseDomain,
			IsSafe:     false,
			RiskLevel:  RiskCritical,
			Warnings:   append(warnings, "Domain is blocklisted"),
		}
	}

	// Check if it's a known trusted domain
	if d.trustedDomains[baseDomain] || d.trustedDomains[domain] {
		return &DomainResult{
			Domain:     domain,
			BaseDomain: baseDomain,
			IsSafe:     true,
			RiskLevel:  RiskSafe,
			Warnings:   warnings,
		}
	}

	// Unknown domains should not be considered safe by default
	riskLevel := RiskLow
	if len(warnings) > 0 {
		riskLevel = RiskMedium
	}
	if len(warnings) == 0 {
		warnings = append(warnings, "Unknown domain - proceed with caution")
	}

	return &DomainResult{
		Domain:     domain,
		BaseDomain: baseDomain,
		IsSafe:     false,
		RiskLevel:  riskLevel,
		Warnings:   warnings,
	}
}

// GetSimilarityScore calculates Levenshtein distance similarity between two strings.
// Returns a score between 0 and 1.
func (d *PhishingDetector) GetSimilarityScore(str1, str2 string) float64 {
	s1 := strings.ToLower(str1)
	s2 := strings.ToLower(str2)

	if s1 == s2 {
		return 1.0
	}

	len1 := len(s1)
	len2 := len(s2)

	// Create distance matrix
	matrix := make([][]int, len1+1)
	for i := range matrix {
		matrix[i] = make([]int, len2+1)
	}

	// Initialize first column
	for i := 0; i <= len1; i++ {
		matrix[i][0] = i
	}

	// Initialize first row
	for j := 0; j <= len2; j++ {
		matrix[0][j] = j
	}

	// Fill in the rest of the matrix
	for i := 1; i <= len1; i++ {
		for j := 1; j <= len2; j++ {
			cost := 1
			if s1[i-1] == s2[j-1] {
				cost = 0
			}
			matrix[i][j] = minInt3(
				matrix[i-1][j]+1,      // deletion
				matrix[i][j-1]+1,      // insertion
				matrix[i-1][j-1]+cost, // substitution
			)
		}
	}

	distance := matrix[len1][len2]
	maxLen := maxInt2(len1, len2)

	if maxLen == 0 {
		return 1.0
	}

	return 1.0 - float64(distance)/float64(maxLen)
}

// AddToBlocklist adds a domain to the blocklist.
func (d *PhishingDetector) AddToBlocklist(domain string) {
	d.blocklist[strings.ToLower(domain)] = true
}

// AddToAllowlist adds a domain to the allowlist.
func (d *PhishingDetector) AddToAllowlist(domain string) {
	d.allowlist[strings.ToLower(domain)] = true
}

// RemoveFromBlocklist removes a domain from the blocklist.
func (d *PhishingDetector) RemoveFromBlocklist(domain string) {
	delete(d.blocklist, strings.ToLower(domain))
}

// RemoveFromAllowlist removes a domain from the allowlist.
func (d *PhishingDetector) RemoveFromAllowlist(domain string) {
	delete(d.allowlist, strings.ToLower(domain))
}

// AddTrustedDomains adds trusted domains.
func (d *PhishingDetector) AddTrustedDomains(domains []string) {
	for _, domain := range domains {
		d.trustedDomains[strings.ToLower(domain)] = true
	}
}

// ============================================================================
// Private Helper Methods
// ============================================================================

func (d *PhishingDetector) isBlocklisted(domain string) bool {
	return d.blocklist[strings.ToLower(domain)]
}

func (d *PhishingDetector) isAllowlisted(domain string) bool {
	return d.allowlist[strings.ToLower(domain)]
}

func (d *PhishingDetector) getBaseDomain(domain string) string {
	parts := strings.Split(domain, ".")
	if len(parts) <= 2 {
		return domain
	}
	return strings.Join(parts[len(parts)-2:], ".")
}

func (d *PhishingDetector) isIPAddress(domain string) bool {
	return net.ParseIP(domain) != nil
}

func (d *PhishingDetector) hasHomographCharacters(domain string) bool {
	for _, char := range domain {
		if _, exists := ConfusableChars[char]; exists {
			return true
		}
		// Check for non-ASCII characters
		if char > unicode.MaxASCII {
			return true
		}
	}
	return false
}

func (d *PhishingDetector) detectTyposquatting(domain string) string {
	parts := strings.Split(domain, ".")
	if len(parts) == 0 {
		return ""
	}
	domainWithoutTLD := parts[0]

	for trustedDomain := range d.trustedDomains {
		trustedParts := strings.Split(trustedDomain, ".")
		if len(trustedParts) == 0 {
			continue
		}
		trustedWithoutTLD := trustedParts[0]

		// Skip if it's the exact same name
		if domainWithoutTLD == trustedWithoutTLD {
			continue
		}

		similarity := d.GetSimilarityScore(domainWithoutTLD, trustedWithoutTLD)

		// High similarity but not exact match suggests typosquatting
		// Threshold 0.7 catches common typos like swapped letters
		if similarity > 0.7 && similarity < 1.0 {
			return trustedDomain
		}
	}

	return ""
}

func (d *PhishingDetector) hasSuspiciousSubdomain(domain string) bool {
	parts := strings.Split(domain, ".")

	// Only check subdomains, not the base domain
	if len(parts) <= 2 {
		return false
	}
	subdomains := parts[:len(parts)-2]

	for _, subdomain := range subdomains {
		subdomain = strings.ToLower(subdomain)
		for _, keyword := range SuspiciousKeywords {
			if strings.Contains(subdomain, keyword) {
				// Check if base domain is not the legitimate one
				baseDomain := d.getBaseDomain(domain)
				if !d.trustedDomains[baseDomain] {
					return true
				}
			}
		}
	}

	return false
}

func (d *PhishingDetector) hasSuspiciousTLD(domain string) bool {
	domain = strings.ToLower(domain)
	for _, tld := range SuspiciousTLDs {
		if strings.HasSuffix(domain, tld) {
			return true
		}
	}
	return false
}

func (d *PhishingDetector) isPunycodeDomain(domain string) bool {
	// Punycode domains start with 'xn--' which indicates IDN encoding
	parts := strings.Split(domain, ".")
	for _, part := range parts {
		if strings.HasPrefix(part, "xn--") {
			return true
		}
	}
	return false
}

// ============================================================================
// Helper Functions
// ============================================================================

// minInt3 returns the minimum of three integers.
func minInt3(a, b, c int) int {
	if a <= b && a <= c {
		return a
	}
	if b <= c {
		return b
	}
	return c
}

// maxInt2 returns the maximum of two integers.
func maxInt2(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// ============================================================================
// Convenience Functions
// ============================================================================

// CreatePhishingDetector creates a new PhishingDetector with the given configuration.
func CreatePhishingDetector(config *PhishingDetectorConfig) *PhishingDetector {
	return NewPhishingDetector(config)
}
