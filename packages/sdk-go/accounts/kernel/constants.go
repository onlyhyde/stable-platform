// Package kernel provides Kernel v3 smart account implementation.
package kernel

import (
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// Kernel v3.1 factory address (deployed at same address on all chains).
var KernelV31FactoryAddress = common.HexToAddress("0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419")

// EntryPoint v0.7 address.
var EntryPointV07Address = common.HexToAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032")

// CallType represents the call type for execute mode.
type CallType byte

const (
	// CallTypeSingle is for single call execution.
	CallTypeSingle CallType = 0x00

	// CallTypeBatch is for batch call execution.
	CallTypeBatch CallType = 0x01

	// CallTypeDelegate is for delegate call execution.
	CallTypeDelegate CallType = 0xff
)

// ExecMode represents the execution mode.
type ExecMode byte

const (
	// ExecModeDefault is the default execution mode.
	ExecModeDefault ExecMode = 0x00

	// ExecModeTry is the try execution mode (continues on failure).
	ExecModeTry ExecMode = 0x01

	// ExecModeDelegate is for delegate execution.
	ExecModeDelegate ExecMode = 0xff
)

// Module types for ERC-7579.
const (
	ModuleTypeValidator types.ModuleType = 1
	ModuleTypeExecutor  types.ModuleType = 2
	ModuleTypeFallback  types.ModuleType = 3
	ModuleTypeHook      types.ModuleType = 4
)

// Signature modes for Kernel v3.
const (
	// SignatureModeEnable is for enabling a validator.
	SignatureModeEnable byte = 0x00

	// SignatureModeEnableWithSig is for enabling with a signature.
	SignatureModeEnableWithSig byte = 0x01

	// SignatureModeValidation is for normal validation.
	SignatureModeValidation byte = 0x02
)

// KernelSignatureFormatter implements accounts.SignatureFormatter for Kernel v3.
// It prepends a mode byte to the raw validator signature.
type KernelSignatureFormatter struct {
	// Mode is the signature mode byte (default: SignatureModeValidation = 0x02).
	Mode byte
}

// NewKernelSignatureFormatter creates a formatter with the default validation mode.
func NewKernelSignatureFormatter() *KernelSignatureFormatter {
	return &KernelSignatureFormatter{Mode: SignatureModeValidation}
}

// NewKernelSignatureFormatterWithMode creates a formatter with a custom mode byte.
// Use this for enable-mode signatures (0x00) or enable-with-sig (0x01).
func NewKernelSignatureFormatterWithMode(mode byte) *KernelSignatureFormatter {
	return &KernelSignatureFormatter{Mode: mode}
}

// FormatSignature prepends the Kernel v3 mode byte to the raw signature.
// Output format: [mode(1 byte)] || [rawSignature]
func (f *KernelSignatureFormatter) FormatSignature(rawSignature types.Hex) (types.Hex, error) {
	result := make([]byte, 1+len(rawSignature))
	result[0] = f.Mode
	copy(result[1:], rawSignature.Bytes())
	return types.Hex(result), nil
}
