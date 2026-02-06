package utils

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Period Constants
// ============================================================================

// Period presets in seconds.
const (
	PeriodMinute   uint64 = 60
	PeriodHour     uint64 = 3600
	PeriodDay      uint64 = 86400
	PeriodWeek     uint64 = 604800
	PeriodMonth    uint64 = 2592000  // 30 days
	PeriodQuarter  uint64 = 7776000  // 90 days
	PeriodYear     uint64 = 31536000 // 365 days
)

// PeriodPresets maps period names to durations.
var PeriodPresets = map[string]uint64{
	"minute":  PeriodMinute,
	"hour":    PeriodHour,
	"day":     PeriodDay,
	"week":    PeriodWeek,
	"month":   PeriodMonth,
	"quarter": PeriodQuarter,
	"year":    PeriodYear,
}

// GetPeriodName returns a human-readable name for a period.
func GetPeriodName(period uint64) string {
	switch period {
	case PeriodMinute:
		return "minute"
	case PeriodHour:
		return "hour"
	case PeriodDay:
		return "day"
	case PeriodWeek:
		return "week"
	case PeriodMonth:
		return "month"
	case PeriodQuarter:
		return "quarter"
	case PeriodYear:
		return "year"
	default:
		return fmt.Sprintf("%d seconds", period)
	}
}

// ============================================================================
// Spending Limit Hook Utils
// ============================================================================

// EncodeSpendingLimitInit encodes spending limit hook initialization data.
func EncodeSpendingLimitInit(config types.SpendingLimitConfig) (types.Hex, error) {
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	uint64Type, _ := abi.NewType("uint64", "", nil)

	var arguments abi.Arguments
	var values []interface{}

	if config.Recipient != nil {
		arguments = abi.Arguments{
			{Type: addressType, Name: "token"},
			{Type: uint256Type, Name: "limit"},
			{Type: uint64Type, Name: "period"},
			{Type: addressType, Name: "recipient"},
		}
		values = []interface{}{
			common.Address(config.Token),
			config.Limit,
			config.Period,
			common.Address(*config.Recipient),
		}
	} else {
		arguments = abi.Arguments{
			{Type: addressType, Name: "token"},
			{Type: uint256Type, Name: "limit"},
			{Type: uint64Type, Name: "period"},
		}
		values = []interface{}{
			common.Address(config.Token),
			config.Limit,
			config.Period,
		}
	}

	encoded, err := arguments.Pack(values...)
	if err != nil {
		return nil, fmt.Errorf("failed to encode spending limit init: %w", err)
	}

	return types.Hex(encoded), nil
}

// EncodeMultipleSpendingLimitsInit encodes multiple spending limit configurations.
func EncodeMultipleSpendingLimitsInit(configs []types.SpendingLimitConfig) (types.Hex, error) {
	// For multiple limits, encode as array of tuples
	tupleComponents := []abi.ArgumentMarshaling{
		{Name: "token", Type: "address"},
		{Name: "limit", Type: "uint256"},
		{Name: "period", Type: "uint64"},
	}
	tupleArrayType, _ := abi.NewType("tuple[]", "", tupleComponents)

	arguments := abi.Arguments{{Type: tupleArrayType}}

	limits := make([]struct {
		Token  common.Address
		Limit  *big.Int
		Period uint64
	}, len(configs))

	for i, cfg := range configs {
		limits[i] = struct {
			Token  common.Address
			Limit  *big.Int
			Period uint64
		}{
			Token:  cfg.Token,
			Limit:  cfg.Limit,
			Period: cfg.Period,
		}
	}

	encoded, err := arguments.Pack(limits)
	if err != nil {
		return nil, fmt.Errorf("failed to encode multiple spending limits: %w", err)
	}

	return types.Hex(encoded), nil
}

// ValidateSpendingLimitConfig validates spending limit configuration.
func ValidateSpendingLimitConfig(config types.SpendingLimitConfig) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate limit
	if config.Limit == nil || config.Limit.Sign() <= 0 {
		result.AddError("Spending limit must be positive")
	}

	// Validate period
	if config.Period == 0 {
		result.AddError("Period must be greater than 0")
	}

	return result
}

// SpendingLimitStatus contains the current status of a spending limit.
type SpendingLimitStatus struct {
	Token         types.Address
	Limit         *big.Int
	Spent         *big.Int
	Remaining     *big.Int
	Period        uint64
	PeriodStart   uint64
	PeriodEnd     uint64
	ResetIn       uint64
	UsagePercent  float64
}

// CalculateSpendingLimitStatus calculates the current status of a spending limit.
func CalculateSpendingLimitStatus(config types.SpendingLimitConfig, spent *big.Int, periodStart, currentTime uint64) *SpendingLimitStatus {
	periodEnd := periodStart + config.Period
	var resetIn uint64
	if currentTime < periodEnd {
		resetIn = periodEnd - currentTime
	}

	remaining := new(big.Int).Sub(config.Limit, spent)
	if remaining.Sign() < 0 {
		remaining = big.NewInt(0)
	}

	var usagePercent float64
	if config.Limit.Sign() > 0 {
		spentFloat := new(big.Float).SetInt(spent)
		limitFloat := new(big.Float).SetInt(config.Limit)
		ratio, _ := new(big.Float).Quo(spentFloat, limitFloat).Float64()
		usagePercent = ratio * 100
	}

	return &SpendingLimitStatus{
		Token:        config.Token,
		Limit:        config.Limit,
		Spent:        spent,
		Remaining:    remaining,
		Period:       config.Period,
		PeriodStart:  periodStart,
		PeriodEnd:    periodEnd,
		ResetIn:      resetIn,
		UsagePercent: usagePercent,
	}
}

// WouldExceedLimit checks if an amount would exceed the spending limit.
func WouldExceedLimit(limit, spent, amount *big.Int) bool {
	newTotal := new(big.Int).Add(spent, amount)
	return newTotal.Cmp(limit) > 0
}

// FormatSpendingLimit formats a spending limit for display.
func FormatSpendingLimit(limit *big.Int, decimals int, symbol string) string {
	if limit == nil {
		return "unlimited"
	}

	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	whole := new(big.Int).Div(limit, divisor)
	frac := new(big.Int).Mod(limit, divisor)

	if frac.Sign() == 0 {
		return fmt.Sprintf("%s %s", whole.String(), symbol)
	}

	fracStr := frac.String()
	// Pad with leading zeros if needed
	for len(fracStr) < decimals {
		fracStr = "0" + fracStr
	}
	// Trim trailing zeros
	for len(fracStr) > 1 && fracStr[len(fracStr)-1] == '0' {
		fracStr = fracStr[:len(fracStr)-1]
	}

	return fmt.Sprintf("%s.%s %s", whole.String(), fracStr, symbol)
}

// EncodeSetLimit encodes a call to set a new spending limit.
func EncodeSetLimit(token types.Address, limit *big.Int, period uint64) (types.Hex, error) {
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	uint64Type, _ := abi.NewType("uint64", "", nil)

	arguments := abi.Arguments{
		{Type: addressType, Name: "token"},
		{Type: uint256Type, Name: "limit"},
		{Type: uint64Type, Name: "period"},
	}

	encoded, err := arguments.Pack(common.Address(token), limit, period)
	if err != nil {
		return nil, fmt.Errorf("failed to encode setLimit call: %w", err)
	}

	return types.Hex(encoded), nil
}

// SuggestSpendingLimit suggests a spending limit based on usage patterns.
func SuggestSpendingLimit(averageSpend, maxSpend *big.Int, safetyMultiplier float64) *big.Int {
	// Use max of average * 2 or maxSpend as base
	base := new(big.Int).Mul(averageSpend, big.NewInt(2))
	if maxSpend.Cmp(base) > 0 {
		base = maxSpend
	}

	// Apply safety multiplier
	multiplied := new(big.Float).SetInt(base)
	multiplied.Mul(multiplied, big.NewFloat(safetyMultiplier))

	result, _ := multiplied.Int(nil)
	return result
}

// ============================================================================
// Audit Hook Utils
// ============================================================================

// Audit event flags.
const (
	AuditFlagTransfer   uint32 = 1 << 0
	AuditFlagApproval   uint32 = 1 << 1
	AuditFlagCall       uint32 = 1 << 2
	AuditFlagCalldata   uint32 = 1 << 3
	AuditFlagModule     uint32 = 1 << 4
	AuditFlagDelegation uint32 = 1 << 5
)

// EncodeAuditHookInit encodes audit hook initialization data.
func EncodeAuditHookInit(config types.AuditHookConfig) (types.Hex, error) {
	addressType, _ := abi.NewType("address", "", nil)
	uint32Type, _ := abi.NewType("uint32", "", nil)

	arguments := abi.Arguments{
		{Type: addressType, Name: "auditAddress"},
		{Type: uint32Type, Name: "eventFlags"},
	}

	encoded, err := arguments.Pack(common.Address(config.AuditAddress), config.EventFlags)
	if err != nil {
		return nil, fmt.Errorf("failed to encode audit hook init: %w", err)
	}

	return types.Hex(encoded), nil
}

// DecodeAuditEventFlags decodes audit event flags into a list of event names.
func DecodeAuditEventFlags(flags uint32) []string {
	var events []string

	if flags&AuditFlagTransfer != 0 {
		events = append(events, "transfer")
	}
	if flags&AuditFlagApproval != 0 {
		events = append(events, "approval")
	}
	if flags&AuditFlagCall != 0 {
		events = append(events, "call")
	}
	if flags&AuditFlagCalldata != 0 {
		events = append(events, "calldata")
	}
	if flags&AuditFlagModule != 0 {
		events = append(events, "module")
	}
	if flags&AuditFlagDelegation != 0 {
		events = append(events, "delegation")
	}

	return events
}

// EncodeAuditEventFlags encodes a list of event names into flags.
func EncodeAuditEventFlags(events []string) uint32 {
	var flags uint32

	for _, event := range events {
		switch event {
		case "transfer":
			flags |= AuditFlagTransfer
		case "approval":
			flags |= AuditFlagApproval
		case "call":
			flags |= AuditFlagCall
		case "calldata":
			flags |= AuditFlagCalldata
		case "module":
			flags |= AuditFlagModule
		case "delegation":
			flags |= AuditFlagDelegation
		}
	}

	return flags
}

// ValidateAuditHookConfig validates audit hook configuration.
func ValidateAuditHookConfig(config types.AuditHookConfig) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate audit address
	if config.AuditAddress == (types.Address{}) || config.AuditAddress == ZeroAddress {
		result.AddError("Audit address is required and cannot be zero address")
	}

	// Validate event flags
	if config.EventFlags == 0 {
		result.AddError("At least one audit event flag must be set")
	}

	return result
}

// AuditLogEntry represents an audit log entry.
type AuditLogEntry struct {
	Timestamp   uint64
	EventType   string
	From        types.Address
	To          types.Address
	Value       *big.Int
	Data        types.Hex
	TxHash      types.Hash
	BlockNumber uint64
}

// FormatAuditLogEntry formats an audit log entry for display.
func FormatAuditLogEntry(entry *AuditLogEntry, decimals int, symbol string) string {
	valueStr := ""
	if entry.Value != nil && entry.Value.Sign() > 0 {
		valueStr = FormatSpendingLimit(entry.Value, decimals, symbol)
	}

	return fmt.Sprintf("[%d] %s: %s -> %s %s (tx: %s)",
		entry.Timestamp,
		entry.EventType,
		entry.From.Hex()[:10]+"...",
		entry.To.Hex()[:10]+"...",
		valueStr,
		entry.TxHash.Hex()[:10]+"...",
	)
}
