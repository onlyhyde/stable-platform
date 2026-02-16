// Code generated - DO NOT EDIT.
// This file is generated from the TypeScript SDK addresses.
// To regenerate, run the address generation script.

package addresses

import (
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// chainAddresses contains contract addresses by chain ID.
var chainAddresses = map[types.ChainID]ChainAddresses{
	// Devnet (Anvil)
	types.ChainIDLocal: {
		ChainID: types.ChainIDLocal,
		Core: CoreAddresses{
			EntryPoint:    common.HexToAddress("0x0000000000000000000000000000000000000000"),
			Kernel:        common.HexToAddress("0x0000000000000000000000000000000000000000"),
			KernelFactory: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Validators: ValidatorAddresses{
			ECDSAValidator:      common.HexToAddress("0x0000000000000000000000000000000000000000"),
			WebAuthnValidator:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
			MultiECDSAValidator: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Executors: ExecutorAddresses{
			OwnableExecutor: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Hooks: HookAddresses{
			SpendingLimitHook: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Paymasters: PaymasterAddresses{
			VerifyingPaymaster: common.HexToAddress("0x0000000000000000000000000000000000000000"),
			TokenPaymaster:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Privacy: PrivacyAddresses{
			StealthAnnouncer: common.HexToAddress("0x0000000000000000000000000000000000000000"),
			StealthRegistry:  common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Compliance: ComplianceAddresses{
			KYCRegistry:         common.HexToAddress("0x0000000000000000000000000000000000000000"),
			ComplianceValidator: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Subscriptions: SubscriptionAddresses{
			SubscriptionManager:       common.HexToAddress("0x9d4454B023096f34B160D6B654540c56A1F81688"),
			RecurringPaymentExecutor: common.HexToAddress("0x998abeb3E57409262aE5b751f60747921B33613E"),
			PermissionManager:         common.HexToAddress("0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf"),
		},
		DelegatePresets: []DelegatePreset{},
	},

	// Sepolia Testnet
	types.ChainIDSepolia: {
		ChainID: types.ChainIDSepolia,
		Core: CoreAddresses{
			EntryPoint:    common.HexToAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032"),
			Kernel:        common.HexToAddress("0x0000000000000000000000000000000000000000"),
			KernelFactory: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Validators: ValidatorAddresses{
			ECDSAValidator:      common.HexToAddress("0x0000000000000000000000000000000000000000"),
			WebAuthnValidator:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
			MultiECDSAValidator: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Executors: ExecutorAddresses{
			OwnableExecutor: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Hooks: HookAddresses{
			SpendingLimitHook: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Paymasters: PaymasterAddresses{
			VerifyingPaymaster: common.HexToAddress("0x0000000000000000000000000000000000000000"),
			TokenPaymaster:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Privacy: PrivacyAddresses{
			StealthAnnouncer: common.HexToAddress("0x0000000000000000000000000000000000000000"),
			StealthRegistry:  common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Compliance: ComplianceAddresses{
			KYCRegistry:         common.HexToAddress("0x0000000000000000000000000000000000000000"),
			ComplianceValidator: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Subscriptions: SubscriptionAddresses{
			SubscriptionManager:       common.HexToAddress("0x0000000000000000000000000000000000000000"),
			RecurringPaymentExecutor: common.HexToAddress("0x0000000000000000000000000000000000000000"),
			PermissionManager:         common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		DelegatePresets: []DelegatePreset{},
	},

	// StableNet (Chain ID 8283)
	types.ChainIDStableNet: {
		ChainID: types.ChainIDStableNet,
		Core: CoreAddresses{
			EntryPoint:    common.HexToAddress("0xef6817fe73741a8f10088f9511c64b666a338a14"),
			Kernel:        common.HexToAddress("0xa61b944dd427a85495b685d93237cb73087e0035"),
			KernelFactory: common.HexToAddress("0xbebb0338503f9e28ffdc84c3548f8454f12dd1d3"),
		},
		Validators: ValidatorAddresses{
			ECDSAValidator:      common.HexToAddress("0xb33dc2d82eaee723ca7687d70209ed9a861b3b46"),
			WebAuthnValidator:   common.HexToAddress("0x169844994bd5b64c3a264c54d6b0863bb7df0487"),
			MultiECDSAValidator: common.HexToAddress("0x284d8e1d4864bfab4ea1dfe283f7f849c075bfa5"),
		},
		Executors: ExecutorAddresses{
			OwnableExecutor: common.HexToAddress("0x621b0872c00f6328bd9001a121af09dd18b193e0"),
		},
		Hooks: HookAddresses{
			SpendingLimitHook: common.HexToAddress("0x304cb9f3725e8b807c2fe951c8db7fea4176f1c5"),
		},
		Paymasters: PaymasterAddresses{
			VerifyingPaymaster: common.HexToAddress("0xfed3fc34af59a30c5a19ff8caf260604ddf39fc0"),
			TokenPaymaster:     common.HexToAddress("0xaf420bfe67697a5724235e4676136f264023d099"),
		},
		Privacy: PrivacyAddresses{
			StealthAnnouncer: common.HexToAddress("0x7706eeaacd036c8c981147991913419e3fc33abc"),
			StealthRegistry:  common.HexToAddress("0xfb8b3fce6fd358b6f13a05a216bdc1deb46c7cd9"),
		},
		Compliance: ComplianceAddresses{
			KYCRegistry:         common.HexToAddress("0xcb23f218447bebb4e0244b40fba5ae0d0e749649"),
			ComplianceValidator: common.HexToAddress("0xce4959e3a3d4ae3a92d6c9b6b4c570b4ff501346"),
		},
		Subscriptions: SubscriptionAddresses{
			SubscriptionManager:      common.HexToAddress("0x3157c4a86d07a223e3b46f20633f5486e96b8f3c"),
			RecurringPaymentExecutor: common.HexToAddress("0x3157c4a86d07a223e3b46f20633f5486e96b8f3c"),
			PermissionManager:        common.HexToAddress("0x38fb544beee122a2ea593e7d9c8f019751273287"),
		},
		DelegatePresets: []DelegatePreset{},
	},

	// Polygon Amoy Testnet
	types.ChainIDPolygonAmoy: {
		ChainID: types.ChainIDPolygonAmoy,
		Core: CoreAddresses{
			EntryPoint:    common.HexToAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032"),
			Kernel:        common.HexToAddress("0x0000000000000000000000000000000000000000"),
			KernelFactory: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Validators: ValidatorAddresses{
			ECDSAValidator:      common.HexToAddress("0x0000000000000000000000000000000000000000"),
			WebAuthnValidator:   common.HexToAddress("0x0000000000000000000000000000000000000000"),
			MultiECDSAValidator: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Executors: ExecutorAddresses{
			OwnableExecutor: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Hooks: HookAddresses{
			SpendingLimitHook: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Paymasters: PaymasterAddresses{
			VerifyingPaymaster: common.HexToAddress("0x0000000000000000000000000000000000000000"),
			TokenPaymaster:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Privacy: PrivacyAddresses{
			StealthAnnouncer: common.HexToAddress("0x0000000000000000000000000000000000000000"),
			StealthRegistry:  common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Compliance: ComplianceAddresses{
			KYCRegistry:         common.HexToAddress("0x0000000000000000000000000000000000000000"),
			ComplianceValidator: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		Subscriptions: SubscriptionAddresses{
			SubscriptionManager:       common.HexToAddress("0x0000000000000000000000000000000000000000"),
			RecurringPaymentExecutor: common.HexToAddress("0x0000000000000000000000000000000000000000"),
			PermissionManager:         common.HexToAddress("0x0000000000000000000000000000000000000000"),
		},
		DelegatePresets: []DelegatePreset{},
	},
}

// serviceURLs contains service endpoints by chain ID.
var serviceURLs = map[types.ChainID]ServiceURLs{
	types.ChainIDLocal: {
		Bundler:       "http://localhost:4337",
		Paymaster:     "http://localhost:4338",
		StealthServer: "http://localhost:4339",
	},
	types.ChainIDStableNet: {
		Bundler:       "http://localhost:4337",
		Paymaster:     "http://localhost:4338",
		StealthServer: "http://localhost:4339",
	},
	types.ChainIDSepolia: {
		Bundler:       "https://bundler.sepolia.stablenet.io",
		Paymaster:     "https://paymaster.sepolia.stablenet.io",
		StealthServer: "https://stealth.sepolia.stablenet.io",
	},
	types.ChainIDPolygonAmoy: {
		Bundler:       "https://bundler.amoy.stablenet.io",
		Paymaster:     "https://paymaster.amoy.stablenet.io",
		StealthServer: "https://stealth.amoy.stablenet.io",
	},
}

// defaultTokens contains default token definitions by chain ID.
var defaultTokens = map[types.ChainID][]TokenDefinition{
	types.ChainIDLocal: {
		{
			Address:  common.HexToAddress("0x0000000000000000000000000000000000000000"),
			Name:     "Ether",
			Symbol:   "ETH",
			Decimals: 18,
		},
		{
			Address:  common.HexToAddress("0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"),
			Name:     "USD Coin",
			Symbol:   "USDC",
			Decimals: 6,
		},
		{
			Address:  common.HexToAddress("0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"),
			Name:     "Dai Stablecoin",
			Symbol:   "DAI",
			Decimals: 18,
		},
	},
	types.ChainIDStableNet: {
		{
			Address:  common.HexToAddress("0x7186e5c27cb08eaf041005d193268006889083f6"),
			Name:     "WKRC",
			Symbol:   "WKRC",
			Decimals: 18,
		},
		{
			Address:  common.HexToAddress("0x085ee10cc10be8fb2ce51feb13e809a0c3f98699"),
			Name:     "USD Coin",
			Symbol:   "USDC",
			Decimals: 6,
		},
	},
	types.ChainIDSepolia: {
		{
			Address:  common.HexToAddress("0x0000000000000000000000000000000000000000"),
			Name:     "Sepolia Ether",
			Symbol:   "ETH",
			Decimals: 18,
		},
	},
	types.ChainIDPolygonAmoy: {
		{
			Address:  common.HexToAddress("0x0000000000000000000000000000000000000000"),
			Name:     "Amoy MATIC",
			Symbol:   "MATIC",
			Decimals: 18,
		},
	},
}
