package constants

import (
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

// ERC5564AnnouncerABIJSON is the ABI for the EIP-5564 Announcer contract.
const ERC5564AnnouncerABIJSON = `[
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "name": "schemeId", "type": "uint256"},
			{"indexed": true, "name": "stealthAddress", "type": "address"},
			{"indexed": true, "name": "caller", "type": "address"},
			{"indexed": false, "name": "ephemeralPubKey", "type": "bytes"},
			{"indexed": false, "name": "metadata", "type": "bytes"}
		],
		"name": "Announcement",
		"type": "event"
	},
	{
		"inputs": [
			{"name": "schemeId", "type": "uint256"},
			{"name": "stealthAddress", "type": "address"},
			{"name": "ephemeralPubKey", "type": "bytes"},
			{"name": "metadata", "type": "bytes"}
		],
		"name": "announce",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`

// ERC6538RegistryABIJSON is the ABI for the EIP-6538 Registry contract.
const ERC6538RegistryABIJSON = `[
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "name": "registrant", "type": "address"},
			{"indexed": true, "name": "schemeId", "type": "uint256"},
			{"indexed": false, "name": "stealthMetaAddress", "type": "bytes"}
		],
		"name": "StealthMetaAddressSet",
		"type": "event"
	},
	{
		"inputs": [
			{"name": "registrant", "type": "address"},
			{"name": "schemeId", "type": "uint256"}
		],
		"name": "stealthMetaAddressOf",
		"outputs": [{"name": "", "type": "bytes"}],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{"name": "schemeId", "type": "uint256"},
			{"name": "stealthMetaAddress", "type": "bytes"}
		],
		"name": "registerKeys",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{"name": "registrant", "type": "address"},
			{"name": "schemeId", "type": "uint256"},
			{"name": "signature", "type": "bytes"},
			{"name": "stealthMetaAddress", "type": "bytes"}
		],
		"name": "registerKeysOnBehalf",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "incrementNonce",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [{"name": "registrant", "type": "address"}],
		"name": "nonceOf",
		"outputs": [{"name": "", "type": "uint256"}],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "DOMAIN_SEPARATOR",
		"outputs": [{"name": "", "type": "bytes32"}],
		"stateMutability": "view",
		"type": "function"
	}
]`

// ERC5564AnnouncerABI is the parsed ABI for the Announcer contract.
var ERC5564AnnouncerABI abi.ABI

// ERC6538RegistryABI is the parsed ABI for the Registry contract.
var ERC6538RegistryABI abi.ABI

func init() {
	var err error

	ERC5564AnnouncerABI, err = abi.JSON(strings.NewReader(ERC5564AnnouncerABIJSON))
	if err != nil {
		panic("failed to parse ERC5564 Announcer ABI: " + err.Error())
	}

	ERC6538RegistryABI, err = abi.JSON(strings.NewReader(ERC6538RegistryABIJSON))
	if err != nil {
		panic("failed to parse ERC6538 Registry ABI: " + err.Error())
	}
}

// Event signatures for log filtering.
var (
	// AnnouncementEventSig is the event signature for Announcement events.
	// keccak256("Announcement(uint256,address,address,bytes,bytes)")
	AnnouncementEventSig = "0x5f0eab8057630ba7676c49b4f21a0231414e79c3a02b2d13a46d95895c5b9536"

	// StealthMetaAddressSetEventSig is the event signature for StealthMetaAddressSet events.
	// keccak256("StealthMetaAddressSet(address,uint256,bytes)")
	StealthMetaAddressSetEventSig = "0x4e739efc91c39b763dadf5d42ae1c8754e9ebb0de4c591d6da7c7f2cb6824db7"
)
