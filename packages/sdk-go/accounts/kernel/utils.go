package kernel

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/accounts"
	"github.com/stablenet/sdk-go/types"
)

// EncodeExecutionMode encodes the execution mode for Kernel v3.
// Mode is a bytes32 with the following structure:
// - byte 0: call type (0x00 = single, 0x01 = batch, 0xff = delegate)
// - byte 1: exec mode (0x00 = default, 0x01 = try, 0xff = delegate)
// - bytes 2-5: unused (0x00000000)
// - bytes 6-9: selector (0x00000000 for default execution)
// - bytes 10-31: context (22 bytes, usually 0x00...00)
func EncodeExecutionMode(callType CallType, execMode ExecMode) [32]byte {
	var mode [32]byte
	mode[0] = byte(callType)
	mode[1] = byte(execMode)
	// Rest are zeros by default
	return mode
}

// EncodeSingleCall encodes a single call for Kernel execution.
// Format: abi.encodePacked(address target[20], uint256 value[32], bytes callData[variable])
// This matches Solady LibERC7579.decodeSingle() which reads:
//   target = executionData[0:20]
//   value  = executionData[20:52]
//   data   = executionData[52:]
func EncodeSingleCall(call accounts.Call) ([]byte, error) {
	value := call.Value.Int
	if value == nil {
		value = big.NewInt(0)
	}

	data := call.Data.Bytes()
	if data == nil {
		data = []byte{}
	}

	// Packed encoding: address(20 bytes) + uint256(32 bytes) + raw calldata
	encoded := make([]byte, 0, 20+32+len(data))

	// address (20 bytes, NOT padded to 32)
	encoded = append(encoded, call.To.Bytes()...)

	// uint256 value (32 bytes)
	encoded = append(encoded, common.LeftPadBytes(value.Bytes(), 32)...)

	// raw calldata bytes (no offset/length prefix, no padding)
	encoded = append(encoded, data...)

	return encoded, nil
}

// EncodeBatchCalls encodes batch calls for Kernel execution.
func EncodeBatchCalls(calls []accounts.Call) ([]byte, error) {
	if len(calls) == 0 {
		return nil, fmt.Errorf("at least one call is required")
	}

	// For batch encoding, we need to encode an array of (target, value, callData) tuples
	// This is a dynamic array, so we need proper ABI encoding

	// Calculate total size needed
	// Array offset (32) + array length (32) + n * tuple_offset (32 each) + tuple data
	arrayOffset := big.NewInt(32)
	arrayLen := big.NewInt(int64(len(calls)))

	// Start building encoded data
	var encoded []byte

	// Array offset
	encoded = append(encoded, common.LeftPadBytes(arrayOffset.Bytes(), 32)...)

	// Array length
	encoded = append(encoded, common.LeftPadBytes(arrayLen.Bytes(), 32)...)

	// For each call, we need to encode (address, uint256, bytes)
	// First, calculate offsets for each tuple
	tupleDataStart := 32 * len(calls) // After all tuple offsets

	var tupleData []byte
	offsets := make([]int, len(calls))

	for i, call := range calls {
		offsets[i] = tupleDataStart + len(tupleData)

		// Encode tuple: address + value + bytes_offset + bytes_length + bytes_data
		value := call.Value.Int
		if value == nil {
			value = big.NewInt(0)
		}
		data := call.Data.Bytes()
		if data == nil {
			data = []byte{}
		}

		// address
		tupleData = append(tupleData, common.LeftPadBytes(call.To.Bytes(), 32)...)
		// value
		tupleData = append(tupleData, common.LeftPadBytes(value.Bytes(), 32)...)
		// bytes offset (relative to start of this tuple = 96)
		tupleData = append(tupleData, common.LeftPadBytes(big.NewInt(96).Bytes(), 32)...)
		// bytes length
		tupleData = append(tupleData, common.LeftPadBytes(big.NewInt(int64(len(data))).Bytes(), 32)...)
		// bytes data (padded)
		tupleData = append(tupleData, data...)
		if padding := len(data) % 32; padding != 0 {
			tupleData = append(tupleData, make([]byte, 32-padding)...)
		}
	}

	// Append tuple offsets
	for _, offset := range offsets {
		encoded = append(encoded, common.LeftPadBytes(big.NewInt(int64(offset)).Bytes(), 32)...)
	}

	// Append tuple data
	encoded = append(encoded, tupleData...)

	return encoded, nil
}

// EncodeKernelExecuteCallData encodes call data for Kernel execute function.
func EncodeKernelExecuteCallData(calls []accounts.Call) (types.Hex, error) {
	if len(calls) == 0 {
		return nil, fmt.Errorf("at least one call is required")
	}

	isSingle := len(calls) == 1

	var callType CallType
	if isSingle {
		callType = CallTypeSingle
	} else {
		callType = CallTypeBatch
	}

	mode := EncodeExecutionMode(callType, ExecModeDefault)

	var executionCalldata []byte
	var err error

	if isSingle {
		executionCalldata, err = EncodeSingleCall(calls[0])
	} else {
		executionCalldata, err = EncodeBatchCalls(calls)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to encode execution calldata: %w", err)
	}

	// Pack execute(bytes32 mode, bytes executionCalldata)
	packed, err := KernelAccountABI.Pack("execute", mode, executionCalldata)
	if err != nil {
		return nil, fmt.Errorf("failed to pack execute call: %w", err)
	}

	return types.Hex(packed), nil
}

// EncodeRootValidator encodes the root validator for Kernel initialization.
// Root validator is encoded as bytes21: MODULE_TYPE (1 byte) + address (20 bytes)
func EncodeRootValidator(validator accounts.Validator) [21]byte {
	var result [21]byte
	result[0] = byte(ModuleTypeValidator)
	copy(result[1:], validator.Address().Bytes())
	return result
}

// EncodeKernelInitializeData encodes the initialize function data for Kernel.
func EncodeKernelInitializeData(validator accounts.Validator, validatorInitData types.Hex) (types.Hex, error) {
	rootValidator := EncodeRootValidator(validator)
	hookAddress := common.Address{} // No hook (zero address)
	hookData := []byte{}
	initConfig := [][]byte{}

	// Pack initialize(bytes21 rootValidator, address hook, bytes validatorData, bytes hookData, bytes[] initConfig)
	packed, err := KernelAccountABI.Pack(
		"initialize",
		rootValidator,
		hookAddress,
		validatorInitData.Bytes(),
		hookData,
		initConfig,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack initialize call: %w", err)
	}

	return types.Hex(packed), nil
}

// CalculateSalt calculates the salt for account creation.
func CalculateSalt(index uint64) [32]byte {
	var salt [32]byte
	indexBig := big.NewInt(int64(index))
	copy(salt[32-len(indexBig.Bytes()):], indexBig.Bytes())
	return salt
}

// EncodeFactoryData encodes the factory call data for account creation.
func EncodeFactoryData(initData types.Hex, salt [32]byte) (types.Hex, error) {
	// Pack createAccount(bytes initData, bytes32 salt)
	packed, err := KernelFactoryABI.Pack("createAccount", initData.Bytes(), salt)
	if err != nil {
		return nil, fmt.Errorf("failed to pack createAccount call: %w", err)
	}

	return types.Hex(packed), nil
}
