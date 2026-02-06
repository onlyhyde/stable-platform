// Package userop provides UserOperation utilities for ERC-4337.
package userop

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// PackedUserOperation represents a packed user operation for RPC transmission.
type PackedUserOperation struct {
	Sender             string `json:"sender"`
	Nonce              string `json:"nonce"`
	InitCode           string `json:"initCode"`
	CallData           string `json:"callData"`
	AccountGasLimits   string `json:"accountGasLimits"`
	PreVerificationGas string `json:"preVerificationGas"`
	GasFees            string `json:"gasFees"`
	PaymasterAndData   string `json:"paymasterAndData"`
	Signature          string `json:"signature"`
}

// Pack converts a UserOperation into the packed format for bundler RPC.
func Pack(userOp *types.UserOperation) *PackedUserOperation {
	// Build initCode: factory + factoryData
	initCode := "0x"
	if userOp.Factory != nil && len(userOp.FactoryData) > 0 {
		initCode = "0x" + hex.EncodeToString(append(userOp.Factory.Bytes(), userOp.FactoryData.Bytes()...))
	}

	// Build accountGasLimits: verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
	verificationGasBytes := padLeft(userOp.VerificationGasLimit.Bytes(), 16)
	callGasBytes := padLeft(userOp.CallGasLimit.Bytes(), 16)
	accountGasLimits := "0x" + hex.EncodeToString(append(verificationGasBytes, callGasBytes...))

	// Build gasFees: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
	maxPriorityFeeBytes := padLeft(userOp.MaxPriorityFeePerGas.Bytes(), 16)
	maxFeeBytes := padLeft(userOp.MaxFeePerGas.Bytes(), 16)
	gasFees := "0x" + hex.EncodeToString(append(maxPriorityFeeBytes, maxFeeBytes...))

	// Build paymasterAndData
	paymasterAndData := "0x"
	if userOp.Paymaster != nil {
		paymasterVerificationGasLimit := big.NewInt(0)
		if userOp.PaymasterVerificationGasLimit != nil {
			paymasterVerificationGasLimit = userOp.PaymasterVerificationGasLimit
		}
		paymasterPostOpGasLimit := big.NewInt(0)
		if userOp.PaymasterPostOpGasLimit != nil {
			paymasterPostOpGasLimit = userOp.PaymasterPostOpGasLimit
		}

		data := userOp.Paymaster.Bytes()
		data = append(data, padLeft(paymasterVerificationGasLimit.Bytes(), 16)...)
		data = append(data, padLeft(paymasterPostOpGasLimit.Bytes(), 16)...)
		data = append(data, userOp.PaymasterData.Bytes()...)
		paymasterAndData = "0x" + hex.EncodeToString(data)
	}

	return &PackedUserOperation{
		Sender:             userOp.Sender.Hex(),
		Nonce:              toHexString(userOp.Nonce),
		InitCode:           initCode,
		CallData:           userOp.CallData.String(),
		AccountGasLimits:   accountGasLimits,
		PreVerificationGas: toHexString(userOp.PreVerificationGas),
		GasFees:            gasFees,
		PaymasterAndData:   paymasterAndData,
		Signature:          userOp.Signature.String(),
	}
}

// Unpack converts a packed user operation from RPC response to UserOperation.
func Unpack(packed map[string]string) (*types.UserOperation, error) {
	userOp := &types.UserOperation{}

	// Parse sender
	userOp.Sender = common.HexToAddress(packed["sender"])

	// Parse nonce
	nonce, err := parseBigInt(packed["nonce"])
	if err != nil {
		return nil, fmt.Errorf("invalid nonce: %w", err)
	}
	userOp.Nonce = nonce

	// Parse initCode
	initCode := packed["initCode"]
	if initCode != "" && initCode != "0x" && len(initCode) > 42 {
		factoryAddr := common.HexToAddress(initCode[:42])
		userOp.Factory = &factoryAddr
		factoryData, _ := hex.DecodeString(initCode[42:])
		userOp.FactoryData = types.Hex(factoryData)
	}

	// Parse callData
	userOp.CallData, err = types.HexFromString(packed["callData"])
	if err != nil {
		return nil, fmt.Errorf("invalid callData: %w", err)
	}

	// Parse accountGasLimits
	accountGasLimits := packed["accountGasLimits"]
	if accountGasLimits != "" && accountGasLimits != "0x" {
		data, _ := hex.DecodeString(strings.TrimPrefix(accountGasLimits, "0x"))
		if len(data) >= 32 {
			userOp.VerificationGasLimit = new(big.Int).SetBytes(data[:16])
			userOp.CallGasLimit = new(big.Int).SetBytes(data[16:32])
		}
	}

	// Parse preVerificationGas
	userOp.PreVerificationGas, err = parseBigInt(packed["preVerificationGas"])
	if err != nil {
		return nil, fmt.Errorf("invalid preVerificationGas: %w", err)
	}

	// Parse gasFees
	gasFees := packed["gasFees"]
	if gasFees != "" && gasFees != "0x" {
		data, _ := hex.DecodeString(strings.TrimPrefix(gasFees, "0x"))
		if len(data) >= 32 {
			userOp.MaxPriorityFeePerGas = new(big.Int).SetBytes(data[:16])
			userOp.MaxFeePerGas = new(big.Int).SetBytes(data[16:32])
		}
	}

	// Parse paymasterAndData
	paymasterAndData := packed["paymasterAndData"]
	if paymasterAndData != "" && paymasterAndData != "0x" && len(paymasterAndData) > 42 {
		paymasterAddr := common.HexToAddress(paymasterAndData[:42])
		userOp.Paymaster = &paymasterAddr

		data, _ := hex.DecodeString(strings.TrimPrefix(paymasterAndData, "0x"))
		if len(data) >= 52 { // 20 (address) + 16 + 16
			userOp.PaymasterVerificationGasLimit = new(big.Int).SetBytes(data[20:36])
			userOp.PaymasterPostOpGasLimit = new(big.Int).SetBytes(data[36:52])
			if len(data) > 52 {
				userOp.PaymasterData = types.Hex(data[52:])
			}
		}
	}

	// Parse signature
	userOp.Signature, err = types.HexFromString(packed["signature"])
	if err != nil {
		return nil, fmt.Errorf("invalid signature: %w", err)
	}

	return userOp, nil
}

// padLeft pads a byte slice to the specified length on the left with zeros.
func padLeft(b []byte, length int) []byte {
	if len(b) >= length {
		return b[len(b)-length:]
	}
	result := make([]byte, length)
	copy(result[length-len(b):], b)
	return result
}

// toHexString converts a big.Int to a hex string.
func toHexString(n *big.Int) string {
	if n == nil || n.Sign() == 0 {
		return "0x0"
	}
	return "0x" + n.Text(16)
}

// parseBigInt parses a hex string to big.Int.
func parseBigInt(s string) (*big.Int, error) {
	if s == "" || s == "0x" || s == "0x0" {
		return big.NewInt(0), nil
	}
	s = strings.TrimPrefix(s, "0x")
	n, ok := new(big.Int).SetString(s, 16)
	if !ok {
		return nil, fmt.Errorf("invalid hex number: %s", s)
	}
	return n, nil
}
