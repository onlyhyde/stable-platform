package paymaster

import (
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

const (
	PaymasterDomainName    = "StableNetPaymaster"
	PaymasterDomainVersion = "1"
)

// domainTypeHash is keccak256 of the EIP-712 domain type string.
var domainTypeHash = crypto.Keccak256Hash(
	[]byte("EIP712Domain(string name,string version,uint256 chainId,address entryPoint,address paymaster)"),
)

// ABI types used for encoding.
var (
	bytes32Type, _ = abi.NewType("bytes32", "", nil)
	uint256Type, _ = abi.NewType("uint256", "", nil)
	addressType, _ = abi.NewType("address", "", nil)
)

// ComputeDomainSeparator computes the EIP-712-like domain separator.
// Matches BasePaymaster._computeDomainSeparator() in Solidity.
func ComputeDomainSeparator(chainID *big.Int, entryPoint, paymasterAddr common.Address) common.Hash {
	nameHash := crypto.Keccak256Hash([]byte(PaymasterDomainName))
	versionHash := crypto.Keccak256Hash([]byte(PaymasterDomainVersion))

	// abi.encode(typeHash, nameHash, versionHash, chainId, entryPoint, paymaster)
	arguments := abi.Arguments{
		{Type: bytes32Type},
		{Type: bytes32Type},
		{Type: bytes32Type},
		{Type: uint256Type},
		{Type: addressType},
		{Type: addressType},
	}

	data, err := arguments.Pack(
		domainTypeHash,
		nameHash,
		versionHash,
		chainID,
		entryPoint,
		paymasterAddr,
	)
	if err != nil {
		// This should never happen with valid inputs; panic indicates a programming error.
		panic("failed to pack domain separator: " + err.Error())
	}

	return crypto.Keccak256Hash(data)
}

// UserOpCoreFields contains the fields needed to compute the core hash.
type UserOpCoreFields struct {
	Sender             common.Address
	Nonce              *big.Int
	InitCode           []byte
	CallData           []byte
	AccountGasLimits   [32]byte
	PreVerificationGas *big.Int
	GasFees            [32]byte
}

// ComputeUserOpCoreHash computes the hash of UserOp core fields.
// Matches BasePaymaster._computeUserOpCoreHash() in Solidity.
func ComputeUserOpCoreHash(op *UserOpCoreFields) common.Hash {
	initCodeHash := crypto.Keccak256Hash(op.InitCode)
	callDataHash := crypto.Keccak256Hash(op.CallData)

	// abi.encode(sender, nonce, keccak256(initCode), keccak256(callData), accountGasLimits, preVerificationGas, gasFees)
	arguments := abi.Arguments{
		{Type: addressType},
		{Type: uint256Type},
		{Type: bytes32Type},
		{Type: bytes32Type},
		{Type: bytes32Type},
		{Type: uint256Type},
		{Type: bytes32Type},
	}

	data, err := arguments.Pack(
		op.Sender,
		op.Nonce,
		initCodeHash,
		callDataHash,
		op.AccountGasLimits,
		op.PreVerificationGas,
		op.GasFees,
	)
	if err != nil {
		panic("failed to pack user op core hash: " + err.Error())
	}

	return crypto.Keccak256Hash(data)
}

// ComputePaymasterHash computes the hash to be signed by the paymaster signer.
// Matches PaymasterDataLib.hashForSignature() in Solidity:
//
//	keccak256(abi.encode(domainSeparator, userOpCoreHash, keccak256(envelope)))
func ComputePaymasterHash(domainSeparator, userOpCoreHash common.Hash, envelope []byte) common.Hash {
	envelopeHash := crypto.Keccak256Hash(envelope)

	arguments := abi.Arguments{
		{Type: bytes32Type},
		{Type: bytes32Type},
		{Type: bytes32Type},
	}

	data, err := arguments.Pack(
		domainSeparator,
		userOpCoreHash,
		envelopeHash,
	)
	if err != nil {
		panic("failed to pack paymaster hash: " + err.Error())
	}

	return crypto.Keccak256Hash(data)
}

// PackGasLimits packs two uint128 gas values into a single bytes32.
// The first value occupies the high 128 bits, the second occupies the low 128 bits.
func PackGasLimits(a, b *big.Int) [32]byte {
	var result [32]byte

	if a != nil {
		aBytes := make([]byte, 16)
		a.FillBytes(aBytes)
		copy(result[0:16], aBytes)
	}

	if b != nil {
		bBytes := make([]byte, 16)
		b.FillBytes(bBytes)
		copy(result[16:32], bBytes)
	}

	return result
}
