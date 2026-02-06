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
