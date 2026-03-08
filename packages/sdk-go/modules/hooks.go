package modules

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

// HookType classifies hook execution timing.
type HookType uint8

const (
	// HookTypePre executes only before the main transaction.
	HookTypePre HookType = 0
	// HookTypePost executes only after the main transaction.
	HookTypePost HookType = 1
	// HookTypeBoth executes both before and after the main transaction.
	HookTypeBoth HookType = 2
)

// String returns the string name of the hook type.
func (h HookType) String() string {
	switch h {
	case HookTypePre:
		return "Pre"
	case HookTypePost:
		return "Post"
	case HookTypeBoth:
		return "Both"
	default:
		return "Unknown"
	}
}

// InstalledHook represents a hook module installed on a smart account.
type InstalledHook struct {
	// Address is the on-chain address of the hook module.
	Address common.Address
	// HookType indicates when the hook executes (pre, post, or both).
	HookType HookType
}

// HookContext carries data between pre-check and post-check execution phases.
type HookContext struct {
	// PreCheckData is opaque data returned by preCheck, passed to postCheck.
	PreCheckData []byte
	// ExecutionMode is the ERC-7579 execution mode used for the transaction.
	ExecutionMode [32]byte
	// ExecutionCalldata is the calldata for the main execution.
	ExecutionCalldata []byte
}

// HookExecutor handles pre/post execution hooks for ERC-7579 smart accounts.
type HookExecutor struct {
	hooks   []InstalledHook
	hookABI abi.ABI
}

// hookModuleABI defines the ERC-7579 hook interface ABI.
const hookModuleABI = `[
	{
		"name": "preCheck",
		"type": "function",
		"inputs": [
			{"name": "msgSender", "type": "address"},
			{"name": "value", "type": "uint256"},
			{"name": "msgData", "type": "bytes"}
		],
		"outputs": [
			{"name": "hookData", "type": "bytes"}
		],
		"stateMutability": "nonpayable"
	},
	{
		"name": "postCheck",
		"type": "function",
		"inputs": [
			{"name": "hookData", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	}
]`

// NewHookExecutor creates a new HookExecutor with the given installed hooks.
func NewHookExecutor(hooks []InstalledHook) (*HookExecutor, error) {
	parsedABI, err := abi.JSON(strings.NewReader(hookModuleABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse hook ABI: %w", err)
	}

	return &HookExecutor{
		hooks:   hooks,
		hookABI: parsedABI,
	}, nil
}

// Hooks returns the list of installed hooks.
func (h *HookExecutor) Hooks() []InstalledHook {
	return h.hooks
}

// AddHook adds a hook to the executor.
func (h *HookExecutor) AddHook(hook InstalledHook) {
	h.hooks = append(h.hooks, hook)
}

// RemoveHook removes a hook by address. Returns true if the hook was found and removed.
func (h *HookExecutor) RemoveHook(address common.Address) bool {
	for i, hook := range h.hooks {
		if hook.Address == address {
			h.hooks = append(h.hooks[:i], h.hooks[i+1:]...)
			return true
		}
	}
	return false
}

// PreCheck executes all pre-execution hooks and returns context data for PostCheck.
// Hooks with HookTypePre or HookTypeBoth are executed.
// If no pre-hooks are installed, returns an empty HookContext (no-op).
func (h *HookExecutor) PreCheck(ctx context.Context, executionMode [32]byte, calldata []byte) (*HookContext, error) {
	hookCtx := &HookContext{
		ExecutionMode:     executionMode,
		ExecutionCalldata: calldata,
	}

	var combinedPreData []byte

	for _, hook := range h.hooks {
		if hook.HookType != HookTypePre && hook.HookType != HookTypeBoth {
			continue
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		encoded, err := EncodePreCheckCall(hook.Address, common.Address{}, big.NewInt(0), calldata)
		if err != nil {
			return nil, fmt.Errorf("preCheck encoding failed for hook %s: %w", hook.Address.Hex(), err)
		}

		// Append each hook's encoded preCheck call to combined data.
		// In a real on-chain scenario, the account contract calls each hook
		// and collects the returned hookData. Here we simulate the encoding
		// by concatenating: [hookAddress (20 bytes)] + [encoded calldata].
		entry := make([]byte, 0, 20+len(encoded))
		entry = append(entry, hook.Address.Bytes()...)
		entry = append(entry, encoded...)
		combinedPreData = append(combinedPreData, entry...)
	}

	hookCtx.PreCheckData = combinedPreData
	return hookCtx, nil
}

// PostCheck executes all post-execution hooks with the context from PreCheck.
// Hooks with HookTypePost or HookTypeBoth are executed.
// If no post-hooks are installed, this is a no-op.
func (h *HookExecutor) PostCheck(ctx context.Context, hookCtx *HookContext) error {
	if hookCtx == nil {
		return fmt.Errorf("hookCtx must not be nil")
	}

	for _, hook := range h.hooks {
		if hook.HookType != HookTypePost && hook.HookType != HookTypeBoth {
			continue
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		_, err := EncodePostCheckCall(hook.Address, hookCtx.PreCheckData)
		if err != nil {
			return fmt.Errorf("postCheck encoding failed for hook %s: %w", hook.Address.Hex(), err)
		}
	}

	return nil
}

// EncodePreCheckCall encodes the preCheck function call for a hook module.
// Hook preCheck signature: preCheck(address msgSender, uint256 value, bytes calldata) returns (bytes)
func EncodePreCheckCall(hookAddress common.Address, msgSender common.Address, value *big.Int, calldata []byte) ([]byte, error) {
	parsedABI, err := abi.JSON(strings.NewReader(hookModuleABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse hook ABI: %w", err)
	}

	if value == nil {
		value = big.NewInt(0)
	}

	data, err := parsedABI.Pack("preCheck", msgSender, value, calldata)
	if err != nil {
		return nil, fmt.Errorf("failed to encode preCheck for hook %s: %w", hookAddress.Hex(), err)
	}

	return data, nil
}

// EncodePostCheckCall encodes the postCheck function call for a hook module.
// Hook postCheck signature: postCheck(bytes calldata hookData)
func EncodePostCheckCall(hookAddress common.Address, preCheckData []byte) ([]byte, error) {
	parsedABI, err := abi.JSON(strings.NewReader(hookModuleABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse hook ABI: %w", err)
	}

	if preCheckData == nil {
		preCheckData = []byte{}
	}

	data, err := parsedABI.Pack("postCheck", preCheckData)
	if err != nil {
		return nil, fmt.Errorf("failed to encode postCheck for hook %s: %w", hookAddress.Hex(), err)
	}

	return data, nil
}
