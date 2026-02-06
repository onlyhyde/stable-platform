package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Session Key Executor Utils
// ============================================================================

// EncodeSessionKeyInit encodes session key executor initialization data.
func EncodeSessionKeyInit(config types.SessionKeyConfig) (types.Hex, error) {
	addressType, _ := abi.NewType("address", "", nil)
	addressArrayType, _ := abi.NewType("address[]", "", nil)
	bytes4ArrayType, _ := abi.NewType("bytes4[]", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	uint48Type, _ := abi.NewType("uint48", "", nil)

	arguments := abi.Arguments{
		{Type: addressType, Name: "sessionKey"},
		{Type: addressArrayType, Name: "allowedTargets"},
		{Type: bytes4ArrayType, Name: "allowedSelectors"},
		{Type: uint256Type, Name: "spendLimit"},
		{Type: uint48Type, Name: "validAfter"},
		{Type: uint48Type, Name: "validUntil"},
	}

	// Convert targets to []common.Address
	targets := make([]common.Address, len(config.AllowedTargets))
	for i, t := range config.AllowedTargets {
		targets[i] = t
	}

	// Convert selectors to [][4]byte
	selectors := make([][4]byte, len(config.AllowedSelectors))
	for i, s := range config.AllowedSelectors {
		var sel [4]byte
		copy(sel[:], s.Bytes())
		selectors[i] = sel
	}

	spendLimit := config.SpendLimit
	if spendLimit == nil {
		spendLimit = big.NewInt(0)
	}

	encoded, err := arguments.Pack(
		common.Address(config.SessionKey),
		targets,
		selectors,
		spendLimit,
		big.NewInt(int64(config.ValidAfter)),
		big.NewInt(int64(config.ValidUntil)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode session key init: %w", err)
	}

	return types.Hex(encoded), nil
}

// ValidateSessionKeyConfig validates session key configuration.
func ValidateSessionKeyConfig(config types.SessionKeyConfig) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate session key address
	if config.SessionKey == (types.Address{}) {
		result.AddError("Session key address is required")
	} else if config.SessionKey == ZeroAddress {
		result.AddError("Session key cannot be zero address")
	}

	// Validate allowed targets
	if len(config.AllowedTargets) == 0 {
		result.AddError("At least one allowed target is required")
	}
	for i, target := range config.AllowedTargets {
		if target == ZeroAddress {
			result.AddError(fmt.Sprintf("Allowed target %d cannot be zero address", i+1))
		}
	}

	// Validate time range
	if config.ValidUntil > 0 && config.ValidAfter >= config.ValidUntil {
		result.AddError("validAfter must be less than validUntil")
	}

	// Validate spend limit
	if config.SpendLimit != nil && config.SpendLimit.Sign() < 0 {
		result.AddError("Spend limit cannot be negative")
	}

	return result
}

// PermissionCheckResult contains the result of a permission check.
type PermissionCheckResult struct {
	Allowed bool
	Reason  string
}

// CheckSessionKeyPermission checks if a session key has permission for an action.
func CheckSessionKeyPermission(config types.SessionKeyConfig, target types.Address, selector types.Hex, value *big.Int, timestamp uint64) *PermissionCheckResult {
	// Check if expired
	if config.ValidUntil > 0 && timestamp > config.ValidUntil {
		return &PermissionCheckResult{
			Allowed: false,
			Reason:  "Session key has expired",
		}
	}

	// Check if not yet valid
	if timestamp < config.ValidAfter {
		return &PermissionCheckResult{
			Allowed: false,
			Reason:  "Session key is not yet valid",
		}
	}

	// Check target
	targetAllowed := false
	for _, t := range config.AllowedTargets {
		if t == target {
			targetAllowed = true
			break
		}
	}
	if !targetAllowed {
		return &PermissionCheckResult{
			Allowed: false,
			Reason:  "Target not in allowed list",
		}
	}

	// Check selector
	if len(config.AllowedSelectors) > 0 && len(selector) >= 4 {
		selectorAllowed := false
		for _, s := range config.AllowedSelectors {
			if len(s) >= 4 {
				var sel1, sel2 [4]byte
				copy(sel1[:], selector.Bytes()[:4])
				copy(sel2[:], s.Bytes()[:4])
				if sel1 == sel2 {
					selectorAllowed = true
					break
				}
			}
		}
		if !selectorAllowed {
			return &PermissionCheckResult{
				Allowed: false,
				Reason:  "Function selector not in allowed list",
			}
		}
	}

	// Check spend limit
	if config.SpendLimit != nil && value != nil && value.Cmp(config.SpendLimit) > 0 {
		return &PermissionCheckResult{
			Allowed: false,
			Reason:  "Value exceeds spend limit",
		}
	}

	return &PermissionCheckResult{
		Allowed: true,
		Reason:  "",
	}
}

// ============================================================================
// Recurring Payment Executor Utils
// ============================================================================

// EncodeRecurringPaymentInit encodes recurring payment executor initialization data.
func EncodeRecurringPaymentInit(config types.RecurringPaymentConfig) (types.Hex, error) {
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	uint64Type, _ := abi.NewType("uint64", "", nil)

	arguments := abi.Arguments{
		{Type: addressType, Name: "recipient"},
		{Type: addressType, Name: "token"},
		{Type: uint256Type, Name: "amount"},
		{Type: uint64Type, Name: "interval"},
		{Type: uint64Type, Name: "maxExecutions"},
	}

	encoded, err := arguments.Pack(
		common.Address(config.Recipient),
		common.Address(config.Token),
		config.Amount,
		config.Interval,
		config.MaxExecutions,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode recurring payment init: %w", err)
	}

	return types.Hex(encoded), nil
}

// ValidateRecurringPaymentConfig validates recurring payment configuration.
func ValidateRecurringPaymentConfig(config types.RecurringPaymentConfig) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate recipient
	if config.Recipient == (types.Address{}) || config.Recipient == ZeroAddress {
		result.AddError("Recipient address is required and cannot be zero address")
	}

	// Validate amount
	if config.Amount == nil || config.Amount.Sign() <= 0 {
		result.AddError("Payment amount must be positive")
	}

	// Validate interval
	if config.Interval == 0 {
		result.AddError("Payment interval must be greater than 0")
	}

	return result
}

// RecurringPaymentStatus contains the status of a recurring payment.
type RecurringPaymentStatus struct {
	IsActive       bool
	TotalPaid      *big.Int
	PaymentsCount  uint64
	NextPaymentAt  uint64
	RemainingCount uint64
}

// CalculateRecurringPaymentStatus calculates the status of a recurring payment.
func CalculateRecurringPaymentStatus(config types.RecurringPaymentConfig, executedCount uint64, lastExecutionTime uint64, currentTime uint64) *RecurringPaymentStatus {
	isActive := config.MaxExecutions == 0 || executedCount < config.MaxExecutions

	var remainingCount uint64
	if config.MaxExecutions > 0 && executedCount < config.MaxExecutions {
		remainingCount = config.MaxExecutions - executedCount
	}

	var nextPaymentAt uint64
	if isActive {
		if lastExecutionTime == 0 {
			nextPaymentAt = currentTime
		} else {
			nextPaymentAt = lastExecutionTime + config.Interval
		}
	}

	totalPaid := new(big.Int).Mul(config.Amount, big.NewInt(int64(executedCount)))

	return &RecurringPaymentStatus{
		IsActive:       isActive,
		TotalPaid:      totalPaid,
		PaymentsCount:  executedCount,
		NextPaymentAt:  nextPaymentAt,
		RemainingCount: remainingCount,
	}
}

// CalculateTotalRecurringCost calculates the total cost of all scheduled payments.
func CalculateTotalRecurringCost(config types.RecurringPaymentConfig, executedCount uint64) *big.Int {
	if config.MaxExecutions == 0 {
		return nil // Unlimited
	}

	remainingCount := config.MaxExecutions - executedCount
	if remainingCount <= 0 {
		return big.NewInt(0)
	}

	return new(big.Int).Mul(config.Amount, big.NewInt(int64(remainingCount)))
}

// ============================================================================
// Common Executor Utils
// ============================================================================

// EncodeExecutorCall encodes a call for executor execution.
func EncodeExecutorCall(to types.Address, value *big.Int, data types.Hex) (types.Hex, error) {
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	bytesType, _ := abi.NewType("bytes", "", nil)

	arguments := abi.Arguments{
		{Type: addressType, Name: "to"},
		{Type: uint256Type, Name: "value"},
		{Type: bytesType, Name: "data"},
	}

	if value == nil {
		value = big.NewInt(0)
	}

	encoded, err := arguments.Pack(common.Address(to), value, data.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to encode executor call: %w", err)
	}

	return types.Hex(encoded), nil
}

// EncodeBatchExecutorCalls encodes multiple calls for batch execution.
func EncodeBatchExecutorCalls(calls []types.Call) (types.Hex, error) {
	// Define tuple type for (address, uint256, bytes)
	callComponents := []abi.ArgumentMarshaling{
		{Name: "to", Type: "address"},
		{Name: "value", Type: "uint256"},
		{Name: "data", Type: "bytes"},
	}
	callTupleType, _ := abi.NewType("tuple[]", "", callComponents)

	arguments := abi.Arguments{{Type: callTupleType}}

	// Convert calls to interface slice
	callData := make([]struct {
		To    common.Address
		Value *big.Int
		Data  []byte
	}, len(calls))

	for i, call := range calls {
		value := call.Value
		if value == nil {
			value = big.NewInt(0)
		}
		callData[i] = struct {
			To    common.Address
			Value *big.Int
			Data  []byte
		}{
			To:    call.To,
			Value: value,
			Data:  call.Data.Bytes(),
		}
	}

	encoded, err := arguments.Pack(callData)
	if err != nil {
		return nil, fmt.Errorf("failed to encode batch executor calls: %w", err)
	}

	return types.Hex(encoded), nil
}

// GeneratePaymentID generates a unique payment ID.
func GeneratePaymentID() (types.Hash, error) {
	var id [32]byte
	_, err := rand.Read(id[:])
	if err != nil {
		return types.Hash{}, fmt.Errorf("failed to generate payment ID: %w", err)
	}
	return types.Hash(id), nil
}

// GeneratePaymentIDHex generates a unique payment ID as a hex string.
func GeneratePaymentIDHex() (string, error) {
	id, err := GeneratePaymentID()
	if err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(id[:]), nil
}
