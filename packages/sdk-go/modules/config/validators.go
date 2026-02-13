package config

import (
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// ECDSA Validator
// ============================================================================

// ECDSAValidator is the ECDSA validator module definition.
var ECDSAValidator = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeValidator,
		Name:        "ECDSA Validator",
		Description: "Standard ECDSA signature validation for EOA-like security",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"validator", "ecdsa", "default"},
		DocsURL:     "https://docs.stablenet.io/modules/ecdsa-validator",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "owner",
				Label:       "Owner Address",
				Description: "The address that can sign transactions",
				Type:        TypeAddress,
				Required:    true,
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet:   common.HexToAddress("0xd9AB5096a832b9ce79914329DAEE236f8Eea0390"),
		ChainIDSepolia:   common.HexToAddress("0xd9AB5096a832b9ce79914329DAEE236f8Eea0390"),
		ChainIDLocal:     common.HexToAddress("0xd9AB5096a832b9ce79914329DAEE236f8Eea0390"),
		ChainIDStableNet: common.HexToAddress("0x7186e5C27Cb08eAF041005D193268006889083f6"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// WebAuthn Validator
// ============================================================================

// WebAuthnValidator is the WebAuthn validator module definition.
var WebAuthnValidator = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeValidator,
		Name:        "WebAuthn Validator",
		Description: "Passkey authentication using WebAuthn/FIDO2",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"validator", "webauthn", "passkey", "biometric"},
		DocsURL:     "https://docs.stablenet.io/modules/webauthn-validator",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "pubKeyX",
				Label:       "Public Key X",
				Description: "X coordinate of the WebAuthn public key",
				Type:        TypeUint256,
				Required:    true,
			},
			{
				Name:        "pubKeyY",
				Label:       "Public Key Y",
				Description: "Y coordinate of the WebAuthn public key",
				Type:        TypeUint256,
				Required:    true,
			},
			{
				Name:        "credentialId",
				Label:       "Credential ID",
				Description: "WebAuthn credential identifier",
				Type:        TypeBytes,
				Required:    true,
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0xEf6817fe73741A8F10088f9511c64b666a338A14"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// MultiSig Validator
// ============================================================================

// MultiSigValidator is the MultiSig validator module definition.
var MultiSigValidator = CreateModuleEntry(
	ModuleMetadataExtended{
		Type:        types.ModuleTypeValidator,
		Name:        "MultiSig Validator",
		Description: "Multi-signature validation requiring M-of-N signatures",
		Version:     "1.0.0",
		Author:      "StableNet",
		IsVerified:  true,
		Tags:        []string{"validator", "multisig", "security"},
		DocsURL:     "https://docs.stablenet.io/modules/multisig-validator",
	},
	ModuleConfigSchema{
		Version: "1.0.0",
		Fields: []ModuleConfigField{
			{
				Name:        "signers",
				Label:       "Signers",
				Description: "List of authorized signer addresses",
				Type:        TypeAddressAr,
				Required:    true,
			},
			{
				Name:        "threshold",
				Label:       "Threshold",
				Description: "Number of required signatures",
				Type:        TypeUint8,
				Required:    true,
				Validation: &FieldValidation{
					Min:     "1",
					Message: "Threshold must be at least 1",
				},
			},
		},
	},
	map[uint64]types.Address{
		ChainIDMainnet: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDSepolia: common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDLocal:     common.HexToAddress("0x0000000000000000000000000000000000000000"),
		ChainIDStableNet: common.HexToAddress("0xD23Ee0D8E8DfabE76AA52a872Ce015B0BcAED6Ce"),
	},
	DefaultSupportedChains,
)

// ============================================================================
// All Validators
// ============================================================================

// ValidatorModules contains all built-in validator modules.
var ValidatorModules = []ModuleRegistryEntry{
	ECDSAValidator,
	WebAuthnValidator,
	MultiSigValidator,
}
