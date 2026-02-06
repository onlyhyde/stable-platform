package addresses

import (
	"fmt"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ZeroAddress is the zero address constant for validation.
var ZeroAddress = common.HexToAddress("0x0000000000000000000000000000000000000000")

// IsZeroAddress checks if an address is the zero address.
func IsZeroAddress(address types.Address) bool {
	return address == ZeroAddress
}

// AssertNotZeroAddress validates that an address is not the zero address.
func AssertNotZeroAddress(address types.Address, context string) error {
	if IsZeroAddress(address) {
		if context != "" {
			return fmt.Errorf("%s: address cannot be zero address", context)
		}
		return fmt.Errorf("address cannot be zero address")
	}
	return nil
}

// SupportedChainIDs returns all supported chain IDs.
func SupportedChainIDs() []types.ChainID {
	ids := make([]types.ChainID, 0, len(chainAddresses))
	for id := range chainAddresses {
		ids = append(ids, id)
	}
	return ids
}

// IsChainSupported checks if a chain is supported.
func IsChainSupported(chainID types.ChainID) bool {
	_, ok := chainAddresses[chainID]
	return ok
}

// GetChainAddresses returns all contract addresses for a chain.
func GetChainAddresses(chainID types.ChainID) (*ChainAddresses, error) {
	addresses, ok := chainAddresses[chainID]
	if !ok {
		return nil, fmt.Errorf("chain %d is not supported", chainID)
	}
	return &addresses, nil
}

// GetServiceURLs returns service URLs for a chain.
func GetServiceURLs(chainID types.ChainID) (*ServiceURLs, error) {
	urls, ok := serviceURLs[chainID]
	if !ok {
		return nil, fmt.Errorf("service URLs for chain %d are not configured", chainID)
	}
	return &urls, nil
}

// GetDefaultTokens returns default tokens for a chain.
func GetDefaultTokens(chainID types.ChainID) []TokenDefinition {
	tokens, ok := defaultTokens[chainID]
	if !ok {
		return []TokenDefinition{}
	}
	return tokens
}

// GetChainConfig returns complete configuration for a chain.
func GetChainConfig(chainID types.ChainID) (*ChainConfig, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return nil, err
	}

	services, err := GetServiceURLs(chainID)
	if err != nil {
		return nil, err
	}

	return &ChainConfig{
		Addresses: *addresses,
		Services:  *services,
		Tokens:    GetDefaultTokens(chainID),
	}, nil
}

// GetEntryPoint returns the EntryPoint address for a chain.
func GetEntryPoint(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Core.EntryPoint, nil
}

// GetKernel returns the Kernel implementation address for a chain.
func GetKernel(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Core.Kernel, nil
}

// GetKernelFactory returns the KernelFactory address for a chain.
func GetKernelFactory(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Core.KernelFactory, nil
}

// GetVerifyingPaymaster returns the VerifyingPaymaster address for a chain.
func GetVerifyingPaymaster(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Paymasters.VerifyingPaymaster, nil
}

// GetECDSAValidator returns the ECDSAValidator address for a chain.
func GetECDSAValidator(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Validators.ECDSAValidator, nil
}

// GetStealthAnnouncer returns the StealthAnnouncer address for a chain.
func GetStealthAnnouncer(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Privacy.StealthAnnouncer, nil
}

// GetStealthRegistry returns the StealthRegistry address for a chain.
func GetStealthRegistry(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Privacy.StealthRegistry, nil
}

// GetSubscriptionManager returns the SubscriptionManager address for a chain.
func GetSubscriptionManager(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Subscriptions.SubscriptionManager, nil
}

// GetRecurringPaymentExecutor returns the RecurringPaymentExecutor address for a chain.
func GetRecurringPaymentExecutor(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Subscriptions.RecurringPaymentExecutor, nil
}

// GetPermissionManager returns the ERC7715 PermissionManager address for a chain.
func GetPermissionManager(chainID types.ChainID) (types.Address, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return types.Address{}, err
	}
	return addresses.Subscriptions.PermissionManager, nil
}

// GetDelegatePresets returns EIP-7702 delegate presets for a chain.
func GetDelegatePresets(chainID types.ChainID) ([]DelegatePreset, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return nil, err
	}
	return addresses.DelegatePresets, nil
}

// GetDefaultDelegatePreset returns the default EIP-7702 delegate preset for a chain.
func GetDefaultDelegatePreset(chainID types.ChainID) (*DelegatePreset, error) {
	presets, err := GetDelegatePresets(chainID)
	if err != nil {
		return nil, err
	}
	if len(presets) == 0 {
		return nil, nil
	}
	return &presets[0], nil
}

// LegacyContractAddresses represents the old CONTRACT_ADDRESSES structure
// for gradual migration compatibility.
type LegacyContractAddresses struct {
	EntryPoint       types.Address `json:"entryPoint"`
	AccountFactory   types.Address `json:"accountFactory"`
	Paymaster        types.Address `json:"paymaster"`
	StealthAnnouncer types.Address `json:"stealthAnnouncer"`
	StealthRegistry  types.Address `json:"stealthRegistry"`
}

// GetLegacyContractAddresses returns addresses in the legacy format.
func GetLegacyContractAddresses(chainID types.ChainID) (*LegacyContractAddresses, error) {
	addresses, err := GetChainAddresses(chainID)
	if err != nil {
		return nil, err
	}

	return &LegacyContractAddresses{
		EntryPoint:       addresses.Core.EntryPoint,
		AccountFactory:   addresses.Core.KernelFactory,
		Paymaster:        addresses.Paymasters.VerifyingPaymaster,
		StealthAnnouncer: addresses.Privacy.StealthAnnouncer,
		StealthRegistry:  addresses.Privacy.StealthRegistry,
	}, nil
}
