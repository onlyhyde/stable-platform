package client

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
)

// UserOpBuilder builds UserOperations for subscription payments
type UserOpBuilder struct {
	chainID    *big.Int
	entryPoint string
}

// NewUserOpBuilder creates a new UserOperation builder
func NewUserOpBuilder(chainID int, entryPoint string) *UserOpBuilder {
	return &UserOpBuilder{
		chainID:    big.NewInt(int64(chainID)),
		entryPoint: entryPoint,
	}
}

// BuildERC20Transfer builds calldata for ERC20 transfer
// transfer(address to, uint256 amount)
func (b *UserOpBuilder) BuildERC20Transfer(to string, amount *big.Int) string {
	// ERC20 transfer selector: 0xa9059cbb
	selector := "a9059cbb"

	// Pad address to 32 bytes (remove 0x prefix, pad left with zeros)
	toAddr := strings.TrimPrefix(strings.ToLower(to), "0x")
	paddedTo := fmt.Sprintf("%064s", toAddr)

	// Pad amount to 32 bytes
	amountHex := fmt.Sprintf("%064x", amount)

	return "0x" + selector + paddedTo + amountHex
}

// BuildExecuteCalldata builds calldata for smart account execute function
// execute(address dest, uint256 value, bytes calldata func)
func (b *UserOpBuilder) BuildExecuteCalldata(dest string, value *big.Int, data string) string {
	// Kernel v3 ERC-7579 execute selector: 0xe9ae5c53
	// execute(bytes32 mode, bytes calldata executionCalldata)
	// For single execution: mode = 0x00, calldata = abi.encodePacked(target, value, data)
	selector := "e9ae5c53"

	// ExecMode for single execution (32 bytes of zeros = default mode)
	execMode := strings.Repeat("0", 64)

	// Build execution calldata: abi.encodePacked(target, value, data)
	destAddr := strings.TrimPrefix(strings.ToLower(dest), "0x")
	paddedDest := fmt.Sprintf("%040s", destAddr)

	valueHex := fmt.Sprintf("%064x", value)

	dataBytes := strings.TrimPrefix(data, "0x")

	// For the bytes parameter, we need offset (32 bytes) + length (32 bytes) + data
	executionData := paddedDest + valueHex + dataBytes

	// Calculate offset for bytes parameter (always 0x40 = 64 for this layout)
	offset := fmt.Sprintf("%064x", 64)

	// Length of executionData in bytes
	dataLen := len(executionData) / 2
	length := fmt.Sprintf("%064x", dataLen)

	// Pad data to 32-byte boundary
	paddedData := executionData
	if len(executionData)%64 != 0 {
		paddedData = executionData + strings.Repeat("0", 64-len(executionData)%64)
	}

	return "0x" + selector + execMode + offset + length + paddedData
}

// PackAccountGasLimits packs verification and call gas limits into a single bytes32
// Format: verificationGasLimit (16 bytes) || callGasLimit (16 bytes)
func PackAccountGasLimits(verificationGasLimit, callGasLimit *big.Int) string {
	// Pack into 32 bytes: first 16 bytes for verification, last 16 bytes for call
	vgl := fmt.Sprintf("%032x", verificationGasLimit)
	cgl := fmt.Sprintf("%032x", callGasLimit)
	return "0x" + vgl + cgl
}

// PackGasFees packs maxPriorityFeePerGas and maxFeePerGas into a single bytes32
// Format: maxPriorityFeePerGas (16 bytes) || maxFeePerGas (16 bytes)
func PackGasFees(maxPriorityFeePerGas, maxFeePerGas *big.Int) string {
	mpf := fmt.Sprintf("%032x", maxPriorityFeePerGas)
	mf := fmt.Sprintf("%032x", maxFeePerGas)
	return "0x" + mpf + mf
}

// PackPaymasterAndData packs paymaster address and data
// Format: paymaster (20 bytes) || paymasterVerificationGasLimit (16 bytes) || paymasterPostOpGasLimit (16 bytes) || paymasterData
func PackPaymasterAndData(paymaster string, verificationGasLimit, postOpGasLimit *big.Int, paymasterData string) string {
	pm := strings.TrimPrefix(strings.ToLower(paymaster), "0x")
	vgl := fmt.Sprintf("%032x", verificationGasLimit)
	pogl := fmt.Sprintf("%032x", postOpGasLimit)
	data := strings.TrimPrefix(paymasterData, "0x")

	return "0x" + pm + vgl + pogl + data
}

// CreateUserOperation creates a PackedUserOperation for a subscription payment
func (b *UserOpBuilder) CreateUserOperation(
	sender string,
	nonce *big.Int,
	token string,
	recipient string,
	amount *big.Int,
) *PackedUserOperation {
	// Build ERC20 transfer calldata
	transferData := b.BuildERC20Transfer(recipient, amount)

	// Build execute calldata (value = 0 for ERC20 transfer)
	callData := b.BuildExecuteCalldata(token, big.NewInt(0), transferData)

	return &PackedUserOperation{
		Sender:             sender,
		Nonce:              fmt.Sprintf("0x%x", nonce),
		InitCode:           "0x",
		CallData:           callData,
		AccountGasLimits:   "0x", // Will be filled by gas estimation
		PreVerificationGas: "0x", // Will be filled by gas estimation
		GasFees:            "0x", // Will be filled by gas estimation
		PaymasterAndData:   "0x", // Will be filled by paymaster
		Signature:          "0x", // Will be filled by signing
	}
}

// HexToBytes converts a hex string to bytes
func HexToBytes(s string) ([]byte, error) {
	s = strings.TrimPrefix(s, "0x")
	return hex.DecodeString(s)
}

// BytesToHex converts bytes to a hex string with 0x prefix
func BytesToHex(b []byte) string {
	return "0x" + hex.EncodeToString(b)
}
