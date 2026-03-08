// Package core provides core SDK functionality for ERC-4337 Account Abstraction.
package core

import (
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ERC-4337 v0.9 EntryPoint address (StableNet deployment).
var EntryPointV09Address = common.HexToAddress("0xEf6817fe73741A8F10088f9511c64b666a338A14")

// EntryPointV07Address is the legacy v0.7 EntryPoint address.
// Deprecated: Use EntryPointV09Address for new deployments.
var EntryPointV07Address = common.HexToAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032")

// Default configuration values.
const (
	// DefaultUserOpPollingInterval is the default polling interval for user operation receipts.
	DefaultUserOpPollingInterval = 2000 // milliseconds

	// DefaultConfirmationTimeout is the default timeout for waiting for user operation receipts.
	DefaultConfirmationTimeout = 60000 // milliseconds

	// DefaultGasBufferPercent is the default gas buffer percentage.
	DefaultGasBufferPercent = 10 // 10%
)

// ModuleType constants for ERC-7579.
const (
	ModuleTypeValidator types.ModuleType = 1
	ModuleTypeExecutor  types.ModuleType = 2
	ModuleTypeFallback  types.ModuleType = 3
	ModuleTypeHook      types.ModuleType = 4
	ModuleTypePolicy    types.ModuleType = 5
	ModuleTypeSigner    types.ModuleType = 6
)

// ExecutionMode constants for ERC-7579 execute.
type ExecutionMode [32]byte

var (
	// ExecutionModeSingle is the mode for a single call execution.
	ExecutionModeSingle ExecutionMode

	// ExecutionModeBatch is the mode for batch call execution.
	ExecutionModeBatch ExecutionMode

	// ExecutionModeDelegateCall is the mode for delegate call execution.
	ExecutionModeDelegateCall ExecutionMode

	// ExecutionModeStaticCall is the mode for staticcall (read-only) execution.
	// Per ERC-7579 section 3.4, callType 0xfe is staticcall.
	// Encoding uses same format as delegatecall: abi.encodePacked(target, callData) with no value.
	ExecutionModeStaticCall ExecutionMode
)

// EntryPoint v0.9 canonical address from spec (for reference/interop).
var EntryPointV09CanonicalAddress = common.HexToAddress("0x433709009B8330FDa32311DF1C2AFA402eD8D009")

// SenderCreator v0.9 address from spec.
var SenderCreatorV09Address = common.HexToAddress("0x0A630a99Df908A81115A3022927Be82f9299987e")

// PostOpMode represents the mode passed to paymaster.postOp().
// v0.9 change: postOp revert no longer triggers a second call;
// the EntryPoint reverts execution and settles directly from prefund.
type PostOpMode uint8

const (
	// PostOpModeOpSucceeded indicates the UserOp execution succeeded.
	PostOpModeOpSucceeded PostOpMode = 0
	// PostOpModeOpReverted indicates the UserOp execution reverted.
	// The paymaster still pays gas costs.
	PostOpModeOpReverted PostOpMode = 1
)

func init() {
	// Single execution: callType = 0x00
	ExecutionModeSingle[0] = 0x00

	// Batch execution: callType = 0x01
	ExecutionModeBatch[0] = 0x01

	// Delegate call: callType = 0xff
	ExecutionModeDelegateCall[0] = 0xff

	// Static call: callType = 0xfe
	ExecutionModeStaticCall[0] = 0xfe
}
