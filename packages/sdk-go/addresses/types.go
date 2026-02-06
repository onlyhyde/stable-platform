// Package addresses provides contract address resolution for different chains.
package addresses

import (
	"github.com/stablenet/sdk-go/types"
)

// CoreAddresses contains core protocol contract addresses.
type CoreAddresses struct {
	EntryPoint    types.Address `json:"entryPoint"`
	Kernel        types.Address `json:"kernel"`
	KernelFactory types.Address `json:"kernelFactory"`
}

// ValidatorAddresses contains validator module addresses.
type ValidatorAddresses struct {
	ECDSAValidator     types.Address `json:"ecdsaValidator"`
	WebAuthnValidator  types.Address `json:"webAuthnValidator"`
	MultiECDSAValidator types.Address `json:"multiEcdsaValidator"`
}

// ExecutorAddresses contains executor module addresses.
type ExecutorAddresses struct {
	OwnableExecutor types.Address `json:"ownableExecutor"`
}

// HookAddresses contains hook module addresses.
type HookAddresses struct {
	SpendingLimitHook types.Address `json:"spendingLimitHook"`
}

// PaymasterAddresses contains paymaster contract addresses.
type PaymasterAddresses struct {
	VerifyingPaymaster types.Address `json:"verifyingPaymaster"`
	TokenPaymaster     types.Address `json:"tokenPaymaster"`
}

// PrivacyAddresses contains privacy/stealth module addresses.
type PrivacyAddresses struct {
	StealthAnnouncer types.Address `json:"stealthAnnouncer"`
	StealthRegistry  types.Address `json:"stealthRegistry"`
}

// ComplianceAddresses contains compliance module addresses.
type ComplianceAddresses struct {
	KYCRegistry         types.Address `json:"kycRegistry"`
	ComplianceValidator types.Address `json:"complianceValidator"`
}

// SubscriptionAddresses contains subscription contract addresses.
type SubscriptionAddresses struct {
	SubscriptionManager       types.Address `json:"subscriptionManager"`
	RecurringPaymentExecutor types.Address `json:"recurringPaymentExecutor"`
	PermissionManager         types.Address `json:"permissionManager"`
}

// DelegatePreset represents an EIP-7702 delegate preset.
type DelegatePreset struct {
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Address     types.Address `json:"address"`
	Features    []string      `json:"features"`
}

// ChainAddresses contains all contract addresses for a specific chain.
type ChainAddresses struct {
	ChainID         types.ChainID         `json:"chainId"`
	Core            CoreAddresses         `json:"core"`
	Validators      ValidatorAddresses    `json:"validators"`
	Executors       ExecutorAddresses     `json:"executors"`
	Hooks           HookAddresses         `json:"hooks"`
	Paymasters      PaymasterAddresses    `json:"paymasters"`
	Privacy         PrivacyAddresses      `json:"privacy"`
	Compliance      ComplianceAddresses   `json:"compliance"`
	Subscriptions   SubscriptionAddresses `json:"subscriptions"`
	DelegatePresets []DelegatePreset      `json:"delegatePresets"`
}

// ServiceURLs contains service endpoints for a chain.
type ServiceURLs struct {
	Bundler       string `json:"bundler"`
	Paymaster     string `json:"paymaster"`
	StealthServer string `json:"stealthServer"`
}

// TokenDefinition represents a token on a chain.
type TokenDefinition struct {
	Address  types.Address `json:"address"`
	Name     string        `json:"name"`
	Symbol   string        `json:"symbol"`
	Decimals uint8         `json:"decimals"`
	LogoURL  string        `json:"logoUrl,omitempty"`
}

// ChainConfig contains complete configuration for a chain.
type ChainConfig struct {
	Addresses ChainAddresses    `json:"addresses"`
	Services  ServiceURLs       `json:"services"`
	Tokens    []TokenDefinition `json:"tokens"`
}
