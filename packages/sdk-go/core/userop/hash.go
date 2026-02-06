package userop

import (
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/types"
)

// GetUserOperationHash calculates the hash of a UserOperation.
// This is the hash that should be signed by the account.
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

	// Encode the UserOperation struct
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	bytes32Type, _ := abi.NewType("bytes32", "", nil)

	args := abi.Arguments{
		{Type: addressType},  // sender
		{Type: uint256Type},  // nonce
		{Type: bytes32Type},  // hashInitCode
		{Type: bytes32Type},  // hashCallData
		{Type: bytes32Type},  // accountGasLimits
		{Type: uint256Type},  // preVerificationGas
		{Type: bytes32Type},  // gasFees
		{Type: bytes32Type},  // hashPaymasterAndData
	}

	userOpEncoded, err := args.Pack(
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

	// Hash the encoded UserOperation
	userOpHash := ethcrypto.Keccak256Hash(userOpEncoded)

	// Encode final hash with entryPoint and chainId
	finalArgs := abi.Arguments{
		{Type: bytes32Type},  // userOpHash
		{Type: addressType},  // entryPoint
		{Type: uint256Type},  // chainId
	}

	finalEncoded, err := finalArgs.Pack(
		userOpHash,
		common.Address(entryPoint),
		chainID,
	)
	if err != nil {
		return types.Hash{}, err
	}

	return ethcrypto.Keccak256Hash(finalEncoded), nil
}
