package userop

import (
	"fmt"
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

// mustNewType creates an ABI type or panics (build-time invariant).
func mustNewType(t string) abi.Type {
	typ, err := abi.NewType(t, "", nil)
	if err != nil {
		panic("failed to create ABI type " + t + ": " + err.Error())
	}
	return typ
}

// ComputeDomainSeparator computes the EIP-712 domain separator for EntryPoint v0.9.
// domain = { name: "ERC4337", version: "1", chainId, verifyingContract: entryPoint }
func ComputeDomainSeparator(entryPoint common.Address, chainID *big.Int) (common.Hash, error) {
	bytes32Type := mustNewType("bytes32")
	uint256Type := mustNewType("uint256")
	addressType := mustNewType("address")

	args := abi.Arguments{
		{Type: bytes32Type},  // DOMAIN_TYPEHASH
		{Type: bytes32Type},  // nameHash
		{Type: bytes32Type},  // versionHash
		{Type: uint256Type},  // chainId
		{Type: addressType},  // verifyingContract
	}

	encoded, err := args.Pack(
		eip712DomainTypehash,
		eip712DomainNameHash,
		eip712DomainVersionHash,
		chainID,
		entryPoint,
	)
	if err != nil {
		return common.Hash{}, fmt.Errorf("failed to encode EIP-712 domain separator: %w", err)
	}

	return ethcrypto.Keccak256Hash(encoded), nil
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
	initCodeBytes, err := types.HexFromString(packed.InitCode)
	if err != nil {
		return types.Hash{}, fmt.Errorf("invalid initCode: %w", err)
	}
	hashInitCode := ethcrypto.Keccak256Hash(initCodeBytes.Bytes())

	// Hash callData
	callDataBytes, err := types.HexFromString(packed.CallData)
	if err != nil {
		return types.Hash{}, fmt.Errorf("invalid callData: %w", err)
	}
	hashCallData := ethcrypto.Keccak256Hash(callDataBytes.Bytes())

	// Hash paymasterAndData
	paymasterAndDataBytes, err := types.HexFromString(packed.PaymasterAndData)
	if err != nil {
		return types.Hash{}, fmt.Errorf("invalid paymasterAndData: %w", err)
	}
	hashPaymasterAndData := ethcrypto.Keccak256Hash(paymasterAndDataBytes.Bytes())

	// Parse accountGasLimits as bytes32
	accountGasLimitsBytes, err := types.HexFromString(packed.AccountGasLimits)
	if err != nil {
		return types.Hash{}, fmt.Errorf("invalid accountGasLimits: %w", err)
	}
	var accountGasLimits [32]byte
	copy(accountGasLimits[:], padLeft(accountGasLimitsBytes.Bytes(), 32))

	// Parse gasFees as bytes32
	gasFeesBytes, err := types.HexFromString(packed.GasFees)
	if err != nil {
		return types.Hash{}, fmt.Errorf("invalid gasFees: %w", err)
	}
	var gasFees [32]byte
	copy(gasFees[:], padLeft(gasFeesBytes.Bytes(), 32))

	// Encode the struct hash: keccak256(abi.encode(TYPEHASH, sender, nonce, ...))
	bytes32Type := mustNewType("bytes32")
	addressType := mustNewType("address")
	uint256Type := mustNewType("uint256")

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
	domainSeparator, err := ComputeDomainSeparator(common.Address(entryPoint), chainID)
	if err != nil {
		return types.Hash{}, err
	}

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
