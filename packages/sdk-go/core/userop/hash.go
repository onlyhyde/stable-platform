package userop

import (
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/types"
)

// EIP-712 / ERC-4337 v0.9 hash constants
var (
	// PACKED_USEROP_TYPEHASH = keccak256("PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)")
	packedUserOpTypehash = ethcrypto.Keccak256Hash([]byte("PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)"))

	// EIP712_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
	eip712DomainTypehash = ethcrypto.Keccak256Hash([]byte("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"))

	// keccak256("ERC4337")
	eip712DomainNameHash = ethcrypto.Keccak256Hash([]byte("ERC4337"))

	// keccak256("1")
	eip712DomainVersionHash = ethcrypto.Keccak256Hash([]byte("1"))
)

// ComputeDomainSeparator computes the EIP-712 domain separator for EntryPoint v0.9.
// domain = { name: "ERC4337", version: "1", chainId, verifyingContract: entryPoint }
func ComputeDomainSeparator(entryPoint common.Address, chainID *big.Int) common.Hash {
	bytes32Type, _ := abi.NewType("bytes32", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	addressType, _ := abi.NewType("address", "", nil)

	args := abi.Arguments{
		{Type: bytes32Type},  // DOMAIN_TYPEHASH
		{Type: bytes32Type},  // nameHash
		{Type: bytes32Type},  // versionHash
		{Type: uint256Type},  // chainId
		{Type: addressType},  // verifyingContract
	}

	encoded, _ := args.Pack(
		eip712DomainTypehash,
		eip712DomainNameHash,
		eip712DomainVersionHash,
		chainID,
		entryPoint,
	)

	return ethcrypto.Keccak256Hash(encoded)
}

// GetUserOperationHash calculates the EIP-712 hash of a UserOperation (EntryPoint v0.9).
//
// This matches the EntryPoint v0.9 contract's getUserOpHash():
//
//	MessageHashUtils.toTypedDataHash(domainSeparatorV4, userOp.hash())
//
// Where userOp.hash() = keccak256(abi.encode(PACKED_USEROP_TYPEHASH, fields...))
// and toTypedDataHash = keccak256("\x19\x01" + domainSeparator + structHash)
func GetUserOperationHash(userOp *types.UserOperation, entryPoint types.Address, chainID *big.Int) (types.Hash, error) {
	packed := Pack(userOp)

	// Hash initCode
	initCodeBytes, _ := types.HexFromString(packed.InitCode)
	hashInitCode := ethcrypto.Keccak256Hash(initCodeBytes.Bytes())

	// Hash callData
	callDataBytes, _ := types.HexFromString(packed.CallData)
	hashCallData := ethcrypto.Keccak256Hash(callDataBytes.Bytes())

	// Hash paymasterAndData
	paymasterAndDataBytes, _ := types.HexFromString(packed.PaymasterAndData)
	hashPaymasterAndData := ethcrypto.Keccak256Hash(paymasterAndDataBytes.Bytes())

	// Parse accountGasLimits as bytes32
	accountGasLimitsBytes, _ := types.HexFromString(packed.AccountGasLimits)
	var accountGasLimits [32]byte
	copy(accountGasLimits[:], padLeft(accountGasLimitsBytes.Bytes(), 32))

	// Parse gasFees as bytes32
	gasFeesBytes, _ := types.HexFromString(packed.GasFees)
	var gasFees [32]byte
	copy(gasFees[:], padLeft(gasFeesBytes.Bytes(), 32))

	// Encode the struct hash: keccak256(abi.encode(TYPEHASH, sender, nonce, ...))
	bytes32Type, _ := abi.NewType("bytes32", "", nil)
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)

	structArgs := abi.Arguments{
		{Type: bytes32Type},  // PACKED_USEROP_TYPEHASH
		{Type: addressType},  // sender
		{Type: uint256Type},  // nonce
		{Type: bytes32Type},  // hashInitCode
		{Type: bytes32Type},  // hashCallData
		{Type: bytes32Type},  // accountGasLimits
		{Type: uint256Type},  // preVerificationGas
		{Type: bytes32Type},  // gasFees
		{Type: bytes32Type},  // hashPaymasterAndData
	}

	structEncoded, err := structArgs.Pack(
		packedUserOpTypehash,
		userOp.Sender,
		userOp.Nonce,
		hashInitCode,
		hashCallData,
		accountGasLimits,
		userOp.PreVerificationGas,
		gasFees,
		hashPaymasterAndData,
	)
	if err != nil {
		return types.Hash{}, err
	}

	structHash := ethcrypto.Keccak256Hash(structEncoded)

	// Compute domain separator
	domainSeparator := ComputeDomainSeparator(common.Address(entryPoint), chainID)

	// EIP-712: keccak256("\x19\x01" + domainSeparator + structHash)
	var eip712Data []byte
	eip712Data = append(eip712Data, 0x19, 0x01)
	eip712Data = append(eip712Data, domainSeparator.Bytes()...)
	eip712Data = append(eip712Data, structHash.Bytes()...)

	return ethcrypto.Keccak256Hash(eip712Data), nil
}

// SignUserOpForKernel wraps a raw ECDSA signature for Kernel v3 ECDSA validator.
// Kernel v3 expects: 0x02 prefix + raw ECDSA signature (65 bytes)
func SignUserOpForKernel(rawSignature []byte) []byte {
	return append([]byte{0x02}, rawSignature...)
}
