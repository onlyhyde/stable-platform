package constants

import "github.com/stablenet/sdk-go/types"

// Contract addresses for EIP-5564 Announcer and EIP-6538 Registry.
// These are the singleton addresses deployed across chains.

// DefaultAnnouncerAddress is the default EIP-5564 Announcer contract address.
// This is the singleton address deployed across EVM chains.
var DefaultAnnouncerAddress = types.MustAddressFromHex("0x55649E01B5Df198D18D95b5cc5051630cfD45564")

// DefaultRegistryAddress is the default EIP-6538 Registry contract address.
// This is the singleton address deployed across EVM chains.
var DefaultRegistryAddress = types.MustAddressFromHex("0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538")

// AnnouncerAddresses maps chain IDs to Announcer contract addresses.
var AnnouncerAddresses = map[uint64]types.Address{
	1:        DefaultAnnouncerAddress, // Ethereum Mainnet
	11155111: DefaultAnnouncerAddress, // Sepolia
	84532:    DefaultAnnouncerAddress, // Base Sepolia
	8453:     DefaultAnnouncerAddress, // Base
	10:       DefaultAnnouncerAddress, // Optimism
	42161:    DefaultAnnouncerAddress, // Arbitrum One
	137:      DefaultAnnouncerAddress, // Polygon
}

// RegistryAddresses maps chain IDs to Registry contract addresses.
var RegistryAddresses = map[uint64]types.Address{
	1:        DefaultRegistryAddress, // Ethereum Mainnet
	11155111: DefaultRegistryAddress, // Sepolia
	84532:    DefaultRegistryAddress, // Base Sepolia
	8453:     DefaultRegistryAddress, // Base
	10:       DefaultRegistryAddress, // Optimism
	42161:    DefaultRegistryAddress, // Arbitrum One
	137:      DefaultRegistryAddress, // Polygon
}

// GetAnnouncerAddress returns the Announcer address for a chain ID.
// Returns the default address if the chain is not in the mapping.
func GetAnnouncerAddress(chainID uint64) types.Address {
	if addr, ok := AnnouncerAddresses[chainID]; ok {
		return addr
	}
	return DefaultAnnouncerAddress
}

// GetRegistryAddress returns the Registry address for a chain ID.
// Returns the default address if the chain is not in the mapping.
func GetRegistryAddress(chainID uint64) types.Address {
	if addr, ok := RegistryAddresses[chainID]; ok {
		return addr
	}
	return DefaultRegistryAddress
}
