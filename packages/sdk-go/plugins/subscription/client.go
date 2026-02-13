package subscription

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Client Configuration
// ============================================================================

// RecurringPaymentClientConfig contains configuration for the client.
type RecurringPaymentClientConfig struct {
	// Client is the Ethereum client.
	Client *ethclient.Client
	// ExecutorAddress is the RecurringPaymentExecutor contract address.
	ExecutorAddress types.Address
	// ChainID is the chain ID.
	ChainID uint64
}

// ============================================================================
// RecurringPaymentClient
// ============================================================================

// RecurringPaymentClient provides methods for interacting with RecurringPaymentExecutor.
type RecurringPaymentClient struct {
	client          *ethclient.Client
	executorAddress types.Address
	chainID         uint64
	abi             abi.ABI
}

// NewRecurringPaymentClient creates a new RecurringPaymentClient.
func NewRecurringPaymentClient(config RecurringPaymentClientConfig) (*RecurringPaymentClient, error) {
	parsedABI, err := abi.JSON(strings.NewReader(recurringPaymentExecutorABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	return &RecurringPaymentClient{
		client:          config.Client,
		executorAddress: config.ExecutorAddress,
		chainID:         config.ChainID,
		abi:             parsedABI,
	}, nil
}

// ============================================================================
// Write Encoders (Calldata Generation)
// ============================================================================

// EncodeCreateSchedule encodes calldata for creating a payment schedule.
func (c *RecurringPaymentClient) EncodeCreateSchedule(params *CreateScheduleParams) (types.Hex, error) {
	data, err := c.abi.Pack(
		"createSchedule",
		common.Address(params.Recipient),
		common.Address(params.Token),
		params.Amount,
		big.NewInt(int64(params.Interval)),
		big.NewInt(int64(params.StartTime)),
		big.NewInt(int64(params.MaxPayments)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode createSchedule: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeCancelSchedule encodes calldata for cancelling a schedule.
func (c *RecurringPaymentClient) EncodeCancelSchedule(scheduleID *big.Int) (types.Hex, error) {
	data, err := c.abi.Pack("cancelSchedule", scheduleID)
	if err != nil {
		return nil, fmt.Errorf("failed to encode cancelSchedule: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeUpdateAmount encodes calldata for updating payment amount.
func (c *RecurringPaymentClient) EncodeUpdateAmount(scheduleID, newAmount *big.Int) (types.Hex, error) {
	data, err := c.abi.Pack("updateAmount", scheduleID, newAmount)
	if err != nil {
		return nil, fmt.Errorf("failed to encode updateAmount: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeUpdateRecipient encodes calldata for updating recipient.
func (c *RecurringPaymentClient) EncodeUpdateRecipient(scheduleID *big.Int, newRecipient types.Address) (types.Hex, error) {
	data, err := c.abi.Pack("updateRecipient", scheduleID, common.Address(newRecipient))
	if err != nil {
		return nil, fmt.Errorf("failed to encode updateRecipient: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeExecutePayment encodes calldata for executing a single payment.
func (c *RecurringPaymentClient) EncodeExecutePayment(scheduleID *big.Int) (types.Hex, error) {
	data, err := c.abi.Pack("executePayment", scheduleID)
	if err != nil {
		return nil, fmt.Errorf("failed to encode executePayment: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeExecutePaymentBatch encodes calldata for executing multiple payments.
func (c *RecurringPaymentClient) EncodeExecutePaymentBatch(scheduleIDs []*big.Int) (types.Hex, error) {
	data, err := c.abi.Pack("executePaymentBatch", scheduleIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to encode executePaymentBatch: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeInstallData encodes initialization data for module installation.
func (c *RecurringPaymentClient) EncodeInstallData(config *RecurringPaymentExecutorInitData) (types.Hex, error) {
	arguments := abi.Arguments{
		{Type: mustType("uint256")},
		{Type: mustType("uint256")},
	}

	data, err := arguments.Pack(
		big.NewInt(int64(config.MaxSchedules)),
		big.NewInt(int64(config.MinInterval)),
	)
	if err != nil {
		return nil, err
	}

	return types.Hex(data), nil
}

// ============================================================================
// Read Functions
// ============================================================================

// GetSchedule retrieves a payment schedule by ID.
func (c *RecurringPaymentClient) GetSchedule(ctx context.Context, account types.Address, scheduleID *big.Int) (*PaymentSchedule, error) {
	data, err := c.abi.Pack("getSchedule", scheduleID)
	if err != nil {
		return nil, fmt.Errorf("failed to pack getSchedule: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&account),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getSchedule: %w", err)
	}

	outputs, err := c.abi.Unpack("getSchedule", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) == 0 {
		return nil, nil
	}

	// Parse the schedule struct from outputs
	schedule := parseScheduleFromOutputs(outputs)
	schedule.ID = scheduleID
	return schedule, nil
}

// GetActiveSchedules retrieves all active schedules for an account.
func (c *RecurringPaymentClient) GetActiveSchedules(ctx context.Context, account types.Address) ([]*PaymentSchedule, error) {
	data, err := c.abi.Pack("getActiveSchedules")
	if err != nil {
		return nil, fmt.Errorf("failed to pack getActiveSchedules: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&account),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getActiveSchedules: %w", err)
	}

	outputs, err := c.abi.Unpack("getActiveSchedules", result)
	if err != nil {
		// If the method doesn't exist, return empty
		return []*PaymentSchedule{}, nil
	}

	// Parse schedule IDs from the response, then fetch each full schedule
	ids := parseScheduleIDsFromOutputs(outputs)
	schedules := make([]*PaymentSchedule, 0, len(ids))
	for _, id := range ids {
		schedule, err := c.GetSchedule(ctx, account, id)
		if err != nil {
			continue // Skip schedules that fail to load
		}
		if schedule != nil {
			schedules = append(schedules, schedule)
		}
	}
	return schedules, nil
}

// IsPaymentDue checks if a payment is due for a schedule.
func (c *RecurringPaymentClient) IsPaymentDue(ctx context.Context, account types.Address, scheduleID *big.Int) (bool, error) {
	schedule, err := c.GetSchedule(ctx, account, scheduleID)
	if err != nil {
		return false, err
	}
	if schedule == nil || !schedule.IsActive {
		return false, nil
	}

	now := uint64(time.Now().Unix())
	nextPayment := schedule.LastPaymentTime + schedule.Interval
	return now >= nextPayment, nil
}

// GetNextPaymentTime returns the next payment time for a schedule.
func (c *RecurringPaymentClient) GetNextPaymentTime(ctx context.Context, account types.Address, scheduleID *big.Int) (uint64, error) {
	schedule, err := c.GetSchedule(ctx, account, scheduleID)
	if err != nil {
		return 0, err
	}
	if schedule == nil {
		return 0, fmt.Errorf("schedule not found")
	}

	return schedule.LastPaymentTime + schedule.Interval, nil
}

// GetRemainingPayments returns the number of remaining payments.
// Returns -1 for unlimited schedules.
func (c *RecurringPaymentClient) GetRemainingPayments(ctx context.Context, account types.Address, scheduleID *big.Int) (int64, error) {
	schedule, err := c.GetSchedule(ctx, account, scheduleID)
	if err != nil {
		return 0, err
	}
	if schedule == nil {
		return 0, fmt.Errorf("schedule not found")
	}

	if schedule.MaxPayments == 0 {
		return -1, nil // Unlimited
	}

	remaining := int64(schedule.MaxPayments) - int64(schedule.PaymentsMade)
	if remaining < 0 {
		remaining = 0
	}
	return remaining, nil
}

// GetTotalRemainingValue returns the total remaining value to be paid.
func (c *RecurringPaymentClient) GetTotalRemainingValue(ctx context.Context, account types.Address, scheduleID *big.Int) (*big.Int, error) {
	schedule, err := c.GetSchedule(ctx, account, scheduleID)
	if err != nil {
		return nil, err
	}
	if schedule == nil {
		return nil, fmt.Errorf("schedule not found")
	}

	if schedule.MaxPayments == 0 {
		// Unlimited - return max value indicator
		return new(big.Int).Exp(big.NewInt(2), big.NewInt(256), nil), nil
	}

	remaining := schedule.MaxPayments - schedule.PaymentsMade
	totalRemaining := new(big.Int).Mul(schedule.Amount, big.NewInt(int64(remaining)))
	return totalRemaining, nil
}

// GetPaymentStatus returns the comprehensive payment status.
func (c *RecurringPaymentClient) GetPaymentStatus(ctx context.Context, account types.Address, scheduleID *big.Int) (*PaymentStatus, error) {
	schedule, err := c.GetSchedule(ctx, account, scheduleID)
	if err != nil {
		return nil, err
	}
	if schedule == nil {
		return nil, fmt.Errorf("schedule not found")
	}

	now := uint64(time.Now().Unix())
	nextPayment := schedule.LastPaymentTime + schedule.Interval

	var remainingPayments int64 = -1
	var isComplete bool
	var totalRemaining *big.Int

	if schedule.MaxPayments > 0 {
		remainingPayments = int64(schedule.MaxPayments) - int64(schedule.PaymentsMade)
		if remainingPayments <= 0 {
			remainingPayments = 0
			isComplete = true
		}
		totalRemaining = new(big.Int).Mul(schedule.Amount, big.NewInt(remainingPayments))
	}

	return &PaymentStatus{
		IsDue:               now >= nextPayment && !isComplete,
		NextPaymentTime:     nextPayment,
		RemainingPayments:   remainingPayments,
		TotalRemainingValue: totalRemaining,
		IsComplete:          isComplete,
	}, nil
}

// IsInitialized checks if the executor is initialized for an account.
func (c *RecurringPaymentClient) IsInitialized(ctx context.Context, account types.Address) (bool, error) {
	data, err := c.abi.Pack("isInitialized", common.Address(account))
	if err != nil {
		return false, err
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.executorAddress),
		Data: data,
	}, nil)
	if err != nil {
		return false, nil // Assume not initialized if call fails
	}

	outputs, err := c.abi.Unpack("isInitialized", result)
	if err != nil || len(outputs) == 0 {
		return false, nil
	}

	initialized, ok := outputs[0].(bool)
	return ok && initialized, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

func parseScheduleFromOutputs(outputs []interface{}) *PaymentSchedule {
	schedule := &PaymentSchedule{}

	if len(outputs) >= 8 {
		if recipient, ok := outputs[0].(common.Address); ok {
			schedule.Recipient = types.Address(recipient)
		}
		if token, ok := outputs[1].(common.Address); ok {
			schedule.Token = types.Address(token)
		}
		if amount, ok := outputs[2].(*big.Int); ok {
			schedule.Amount = amount
		}
		if interval, ok := outputs[3].(*big.Int); ok {
			schedule.Interval = interval.Uint64()
		}
		if startTime, ok := outputs[4].(*big.Int); ok {
			schedule.StartTime = startTime.Uint64()
		}
		if lastPaymentTime, ok := outputs[5].(*big.Int); ok {
			schedule.LastPaymentTime = lastPaymentTime.Uint64()
		}
		if maxPayments, ok := outputs[6].(*big.Int); ok {
			schedule.MaxPayments = maxPayments.Uint64()
		}
		if paymentsMade, ok := outputs[7].(*big.Int); ok {
			schedule.PaymentsMade = paymentsMade.Uint64()
		}
		if len(outputs) > 8 {
			if isActive, ok := outputs[8].(bool); ok {
				schedule.IsActive = isActive
			}
		}
	}

	return schedule
}

func parseScheduleIDsFromOutputs(outputs []interface{}) []*big.Int {
	if len(outputs) == 0 {
		return nil
	}
	// getActiveSchedules returns uint256[] — go-ethereum ABI decodes as []*big.Int
	if ids, ok := outputs[0].([]*big.Int); ok {
		return ids
	}
	return nil
}

func mustType(t string) abi.Type {
	typ, err := abi.NewType(t, "", nil)
	if err != nil {
		panic(err)
	}
	return typ
}

// ============================================================================
// ABI Definition
// ============================================================================

const recurringPaymentExecutorABI = `[
	{
		"name": "createSchedule",
		"type": "function",
		"inputs": [
			{"name": "recipient", "type": "address"},
			{"name": "token", "type": "address"},
			{"name": "amount", "type": "uint256"},
			{"name": "interval", "type": "uint256"},
			{"name": "startTime", "type": "uint256"},
			{"name": "maxPayments", "type": "uint256"}
		],
		"outputs": [{"name": "scheduleId", "type": "uint256"}]
	},
	{
		"name": "cancelSchedule",
		"type": "function",
		"inputs": [{"name": "scheduleId", "type": "uint256"}],
		"outputs": []
	},
	{
		"name": "updateAmount",
		"type": "function",
		"inputs": [
			{"name": "scheduleId", "type": "uint256"},
			{"name": "newAmount", "type": "uint256"}
		],
		"outputs": []
	},
	{
		"name": "updateRecipient",
		"type": "function",
		"inputs": [
			{"name": "scheduleId", "type": "uint256"},
			{"name": "newRecipient", "type": "address"}
		],
		"outputs": []
	},
	{
		"name": "executePayment",
		"type": "function",
		"inputs": [{"name": "scheduleId", "type": "uint256"}],
		"outputs": []
	},
	{
		"name": "executePaymentBatch",
		"type": "function",
		"inputs": [{"name": "scheduleIds", "type": "uint256[]"}],
		"outputs": []
	},
	{
		"name": "getSchedule",
		"type": "function",
		"inputs": [{"name": "scheduleId", "type": "uint256"}],
		"outputs": [
			{"name": "recipient", "type": "address"},
			{"name": "token", "type": "address"},
			{"name": "amount", "type": "uint256"},
			{"name": "interval", "type": "uint256"},
			{"name": "startTime", "type": "uint256"},
			{"name": "lastPaymentTime", "type": "uint256"},
			{"name": "maxPayments", "type": "uint256"},
			{"name": "paymentsMade", "type": "uint256"},
			{"name": "isActive", "type": "bool"}
		]
	},
	{
		"name": "getActiveSchedules",
		"type": "function",
		"inputs": [],
		"outputs": [{"name": "scheduleIds", "type": "uint256[]"}]
	},
	{
		"name": "isInitialized",
		"type": "function",
		"inputs": [{"name": "account", "type": "address"}],
		"outputs": [{"name": "", "type": "bool"}]
	},
	{
		"name": "onInstall",
		"type": "function",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": []
	},
	{
		"name": "onUninstall",
		"type": "function",
		"inputs": [{"name": "data", "type": "bytes"}],
		"outputs": []
	},
	{
		"name": "isModuleType",
		"type": "function",
		"inputs": [{"name": "moduleTypeId", "type": "uint256"}],
		"outputs": [{"name": "", "type": "bool"}]
	}
]`
