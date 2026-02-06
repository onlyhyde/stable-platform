// Package subscription provides subscription management for StableNet smart accounts.
package subscription

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Subscription Manager Client Configuration
// ============================================================================

// SubscriptionManagerConfig contains configuration for the SubscriptionManager client.
type SubscriptionManagerConfig struct {
	// Client is the Ethereum client.
	Client *ethclient.Client
	// ManagerAddress is the SubscriptionManager contract address.
	ManagerAddress types.Address
	// ChainID is the chain ID.
	ChainID uint64
}

// ============================================================================
// Subscription Manager Client
// ============================================================================

// SubscriptionManagerClient provides methods for interacting with SubscriptionManager.
type SubscriptionManagerClient struct {
	client         *ethclient.Client
	managerAddress types.Address
	chainID        uint64
	abi            abi.ABI
}

// NewSubscriptionManagerClient creates a new SubscriptionManagerClient.
func NewSubscriptionManagerClient(config SubscriptionManagerConfig) (*SubscriptionManagerClient, error) {
	parsedABI, err := abi.JSON(strings.NewReader(subscriptionManagerABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	return &SubscriptionManagerClient{
		client:         config.Client,
		managerAddress: config.ManagerAddress,
		chainID:        config.ChainID,
		abi:            parsedABI,
	}, nil
}

// GetManagerAddress returns the manager contract address.
func (c *SubscriptionManagerClient) GetManagerAddress() types.Address {
	return c.managerAddress
}

// ============================================================================
// Write Encoders (Calldata Generation)
// ============================================================================

// EncodeCreatePlan encodes calldata for creating a new subscription plan.
func (c *SubscriptionManagerClient) EncodeCreatePlan(params *CreatePlanParams) (types.Hex, error) {
	token := params.Token
	if token == (types.Address{}) {
		token = NativeToken
	}

	trialPeriod := params.TrialPeriod
	gracePeriod := params.GracePeriod
	minSubscriptionTime := params.MinSubscriptionTime

	data, err := c.abi.Pack(
		"createPlan",
		params.Amount,
		big.NewInt(int64(params.Period)),
		common.Address(token),
		big.NewInt(int64(trialPeriod)),
		big.NewInt(int64(gracePeriod)),
		big.NewInt(int64(minSubscriptionTime)),
		params.Name,
		params.Description,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode createPlan: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeUpdatePlan encodes calldata for updating an existing plan.
func (c *SubscriptionManagerClient) EncodeUpdatePlan(planID, amount *big.Int, period uint64, active bool) (types.Hex, error) {
	data, err := c.abi.Pack("updatePlan", planID, amount, big.NewInt(int64(period)), active)
	if err != nil {
		return nil, fmt.Errorf("failed to encode updatePlan: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeSubscribe encodes calldata for subscribing to a plan.
func (c *SubscriptionManagerClient) EncodeSubscribe(params *SubscribeParams) (types.Hex, error) {
	data, err := c.abi.Pack("subscribe", params.PlanID, common.Hash(params.PermissionData))
	if err != nil {
		return nil, fmt.Errorf("failed to encode subscribe: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeCancelSubscription encodes calldata for cancelling a subscription.
func (c *SubscriptionManagerClient) EncodeCancelSubscription(subscriptionID types.Hash) (types.Hex, error) {
	data, err := c.abi.Pack("cancelSubscription", common.Hash(subscriptionID))
	if err != nil {
		return nil, fmt.Errorf("failed to encode cancelSubscription: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeProcessPayment encodes calldata for processing a single payment.
func (c *SubscriptionManagerClient) EncodeProcessPayment(subscriptionID types.Hash) (types.Hex, error) {
	data, err := c.abi.Pack("processPayment", common.Hash(subscriptionID))
	if err != nil {
		return nil, fmt.Errorf("failed to encode processPayment: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeBatchProcessPayments encodes calldata for batch processing payments.
func (c *SubscriptionManagerClient) EncodeBatchProcessPayments(subscriptionIDs []types.Hash) (types.Hex, error) {
	hashes := make([]common.Hash, len(subscriptionIDs))
	for i, id := range subscriptionIDs {
		hashes[i] = common.Hash(id)
	}
	data, err := c.abi.Pack("batchProcessPayments", hashes)
	if err != nil {
		return nil, fmt.Errorf("failed to encode batchProcessPayments: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeAddProcessor encodes calldata for adding an authorized processor.
func (c *SubscriptionManagerClient) EncodeAddProcessor(processor types.Address) (types.Hex, error) {
	data, err := c.abi.Pack("addProcessor", common.Address(processor))
	if err != nil {
		return nil, fmt.Errorf("failed to encode addProcessor: %w", err)
	}
	return types.Hex(data), nil
}

// EncodeRemoveProcessor encodes calldata for removing an authorized processor.
func (c *SubscriptionManagerClient) EncodeRemoveProcessor(processor types.Address) (types.Hex, error) {
	data, err := c.abi.Pack("removeProcessor", common.Address(processor))
	if err != nil {
		return nil, fmt.Errorf("failed to encode removeProcessor: %w", err)
	}
	return types.Hex(data), nil
}

// ============================================================================
// Read Functions
// ============================================================================

// GetPlan retrieves plan details by ID.
func (c *SubscriptionManagerClient) GetPlan(ctx context.Context, planID *big.Int) (*Plan, error) {
	data, err := c.abi.Pack("getPlan", planID)
	if err != nil {
		return nil, fmt.Errorf("failed to pack getPlan: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getPlan: %w", err)
	}

	outputs, err := c.abi.Unpack("getPlan", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	return parsePlanFromOutputs(planID, outputs), nil
}

// GetSubscription retrieves subscription details by ID.
func (c *SubscriptionManagerClient) GetSubscription(ctx context.Context, subscriptionID types.Hash) (*Subscription, error) {
	data, err := c.abi.Pack("getSubscription", common.Hash(subscriptionID))
	if err != nil {
		return nil, fmt.Errorf("failed to pack getSubscription: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getSubscription: %w", err)
	}

	outputs, err := c.abi.Unpack("getSubscription", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	return parseSubscriptionFromOutputs(subscriptionID, outputs), nil
}

// GetSubscriberSubscriptions retrieves all subscription IDs for a subscriber.
func (c *SubscriptionManagerClient) GetSubscriberSubscriptions(ctx context.Context, subscriber types.Address) ([]types.Hash, error) {
	data, err := c.abi.Pack("getSubscriberSubscriptions", common.Address(subscriber))
	if err != nil {
		return nil, fmt.Errorf("failed to pack getSubscriberSubscriptions: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getSubscriberSubscriptions: %w", err)
	}

	outputs, err := c.abi.Unpack("getSubscriberSubscriptions", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) == 0 {
		return []types.Hash{}, nil
	}

	hashes, ok := outputs[0].([][32]byte)
	if !ok {
		return []types.Hash{}, nil
	}

	subscriptionIDs := make([]types.Hash, len(hashes))
	for i, h := range hashes {
		subscriptionIDs[i] = types.Hash(h)
	}
	return subscriptionIDs, nil
}

// GetMerchantPlans retrieves all plan IDs for a merchant.
func (c *SubscriptionManagerClient) GetMerchantPlans(ctx context.Context, merchant types.Address) ([]*big.Int, error) {
	data, err := c.abi.Pack("getMerchantPlans", common.Address(merchant))
	if err != nil {
		return nil, fmt.Errorf("failed to pack getMerchantPlans: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getMerchantPlans: %w", err)
	}

	outputs, err := c.abi.Unpack("getMerchantPlans", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) == 0 {
		return []*big.Int{}, nil
	}

	planIDs, ok := outputs[0].([]*big.Int)
	if !ok {
		return []*big.Int{}, nil
	}

	return planIDs, nil
}

// IsPaymentDue checks if a subscription payment is due.
func (c *SubscriptionManagerClient) IsPaymentDue(ctx context.Context, subscriptionID types.Hash) (bool, error) {
	data, err := c.abi.Pack("isPaymentDue", common.Hash(subscriptionID))
	if err != nil {
		return false, fmt.Errorf("failed to pack isPaymentDue: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return false, fmt.Errorf("failed to call isPaymentDue: %w", err)
	}

	outputs, err := c.abi.Unpack("isPaymentDue", result)
	if err != nil {
		return false, nil
	}

	if len(outputs) > 0 {
		if due, ok := outputs[0].(bool); ok {
			return due, nil
		}
	}
	return false, nil
}

// GetDueSubscriptions filters subscription IDs that are due for payment.
func (c *SubscriptionManagerClient) GetDueSubscriptions(ctx context.Context, subscriptionIDs []types.Hash) ([]types.Hash, error) {
	hashes := make([]common.Hash, len(subscriptionIDs))
	for i, id := range subscriptionIDs {
		hashes[i] = common.Hash(id)
	}

	data, err := c.abi.Pack("getDueSubscriptions", hashes)
	if err != nil {
		return nil, fmt.Errorf("failed to pack getDueSubscriptions: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getDueSubscriptions: %w", err)
	}

	outputs, err := c.abi.Unpack("getDueSubscriptions", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) == 0 {
		return []types.Hash{}, nil
	}

	dueHashes, ok := outputs[0].([][32]byte)
	if !ok {
		return []types.Hash{}, nil
	}

	dueIDs := make([]types.Hash, len(dueHashes))
	for i, h := range dueHashes {
		dueIDs[i] = types.Hash(h)
	}
	return dueIDs, nil
}

// GetDaysUntilNextPayment returns days until next payment (negative if overdue).
func (c *SubscriptionManagerClient) GetDaysUntilNextPayment(ctx context.Context, subscriptionID types.Hash) (*big.Int, error) {
	data, err := c.abi.Pack("daysUntilNextPayment", common.Hash(subscriptionID))
	if err != nil {
		return nil, fmt.Errorf("failed to pack daysUntilNextPayment: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call daysUntilNextPayment: %w", err)
	}

	outputs, err := c.abi.Unpack("daysUntilNextPayment", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) > 0 {
		if days, ok := outputs[0].(*big.Int); ok {
			return days, nil
		}
	}
	return big.NewInt(0), nil
}

// GetPlanCount returns total plan count.
func (c *SubscriptionManagerClient) GetPlanCount(ctx context.Context) (*big.Int, error) {
	data, err := c.abi.Pack("planCount")
	if err != nil {
		return nil, fmt.Errorf("failed to pack planCount: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call planCount: %w", err)
	}

	outputs, err := c.abi.Unpack("planCount", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) > 0 {
		if count, ok := outputs[0].(*big.Int); ok {
			return count, nil
		}
	}
	return big.NewInt(0), nil
}

// GetProtocolFeeBps returns current protocol fee in basis points.
func (c *SubscriptionManagerClient) GetProtocolFeeBps(ctx context.Context) (uint64, error) {
	data, err := c.abi.Pack("protocolFeeBps")
	if err != nil {
		return 0, fmt.Errorf("failed to pack protocolFeeBps: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to call protocolFeeBps: %w", err)
	}

	outputs, err := c.abi.Unpack("protocolFeeBps", result)
	if err != nil {
		return 0, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(outputs) > 0 {
		if fee, ok := outputs[0].(*big.Int); ok {
			return fee.Uint64(), nil
		}
	}
	return 0, nil
}

// IsAuthorizedProcessor checks if an address is an authorized processor.
func (c *SubscriptionManagerClient) IsAuthorizedProcessor(ctx context.Context, processor types.Address) (bool, error) {
	data, err := c.abi.Pack("authorizedProcessors", common.Address(processor))
	if err != nil {
		return false, fmt.Errorf("failed to pack authorizedProcessors: %w", err)
	}

	result, err := c.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&c.managerAddress),
		Data: data,
	}, nil)
	if err != nil {
		return false, fmt.Errorf("failed to call authorizedProcessors: %w", err)
	}

	outputs, err := c.abi.Unpack("authorizedProcessors", result)
	if err != nil {
		return false, nil
	}

	if len(outputs) > 0 {
		if authorized, ok := outputs[0].(bool); ok {
			return authorized, nil
		}
	}
	return false, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

func parsePlanFromOutputs(planID *big.Int, outputs []interface{}) *Plan {
	plan := &Plan{ID: planID}

	if len(outputs) >= 11 {
		if merchant, ok := outputs[0].(common.Address); ok {
			plan.Merchant = types.Address(merchant)
		}
		if amount, ok := outputs[1].(*big.Int); ok {
			plan.Amount = amount
		}
		if period, ok := outputs[2].(*big.Int); ok {
			plan.Period = period.Uint64()
		}
		if token, ok := outputs[3].(common.Address); ok {
			plan.Token = types.Address(token)
		}
		if trialPeriod, ok := outputs[4].(*big.Int); ok {
			plan.TrialPeriod = trialPeriod.Uint64()
		}
		if gracePeriod, ok := outputs[5].(*big.Int); ok {
			plan.GracePeriod = gracePeriod.Uint64()
		}
		if minSubscriptionTime, ok := outputs[6].(*big.Int); ok {
			plan.MinSubscriptionTime = minSubscriptionTime.Uint64()
		}
		if name, ok := outputs[7].(string); ok {
			plan.Name = name
		}
		if description, ok := outputs[8].(string); ok {
			plan.Description = description
		}
		if active, ok := outputs[9].(bool); ok {
			plan.Active = active
		}
		if subscriberCount, ok := outputs[10].(*big.Int); ok {
			plan.SubscriberCount = subscriberCount.Uint64()
		}
	}

	return plan
}

func parseSubscriptionFromOutputs(subscriptionID types.Hash, outputs []interface{}) *Subscription {
	sub := &Subscription{ID: new(big.Int).SetBytes(subscriptionID[:])}

	if len(outputs) >= 10 {
		if planID, ok := outputs[0].(*big.Int); ok {
			sub.PlanID = planID
		}
		if subscriber, ok := outputs[1].(common.Address); ok {
			sub.Subscriber = types.Address(subscriber)
		}
		if permissionID, ok := outputs[2].([32]byte); ok {
			sub.PermissionID = types.Hash(permissionID)
		}
		if startTime, ok := outputs[3].(*big.Int); ok {
			sub.StartTime = startTime.Uint64()
		}
		if lastPayment, ok := outputs[4].(*big.Int); ok {
			sub.LastPayment = lastPayment.Uint64()
		}
		if nextPayment, ok := outputs[5].(*big.Int); ok {
			sub.NextPayment = nextPayment.Uint64()
		}
		if paymentCount, ok := outputs[6].(*big.Int); ok {
			sub.PaymentCount = paymentCount.Uint64()
		}
		if totalPaid, ok := outputs[7].(*big.Int); ok {
			sub.TotalPaid = totalPaid
		}
		if active, ok := outputs[8].(bool); ok {
			sub.Active = active
		}
		if inGracePeriod, ok := outputs[9].(bool); ok {
			sub.InGracePeriod = inGracePeriod
		}
	}

	return sub
}

// NativeToken represents the native token address (0x0).
var NativeToken = types.Address{}

// ============================================================================
// ABI Definition
// ============================================================================

const subscriptionManagerABI = `[
	{
		"name": "createPlan",
		"type": "function",
		"inputs": [
			{"name": "amount", "type": "uint256"},
			{"name": "period", "type": "uint256"},
			{"name": "token", "type": "address"},
			{"name": "trialPeriod", "type": "uint256"},
			{"name": "gracePeriod", "type": "uint256"},
			{"name": "minSubscriptionTime", "type": "uint256"},
			{"name": "name", "type": "string"},
			{"name": "description", "type": "string"}
		],
		"outputs": [{"name": "planId", "type": "uint256"}]
	},
	{
		"name": "updatePlan",
		"type": "function",
		"inputs": [
			{"name": "planId", "type": "uint256"},
			{"name": "amount", "type": "uint256"},
			{"name": "period", "type": "uint256"},
			{"name": "active", "type": "bool"}
		],
		"outputs": []
	},
	{
		"name": "subscribe",
		"type": "function",
		"inputs": [
			{"name": "planId", "type": "uint256"},
			{"name": "permissionId", "type": "bytes32"}
		],
		"outputs": [{"name": "subscriptionId", "type": "bytes32"}]
	},
	{
		"name": "cancelSubscription",
		"type": "function",
		"inputs": [{"name": "subscriptionId", "type": "bytes32"}],
		"outputs": []
	},
	{
		"name": "processPayment",
		"type": "function",
		"inputs": [{"name": "subscriptionId", "type": "bytes32"}],
		"outputs": []
	},
	{
		"name": "batchProcessPayments",
		"type": "function",
		"inputs": [{"name": "subscriptionIds", "type": "bytes32[]"}],
		"outputs": []
	},
	{
		"name": "addProcessor",
		"type": "function",
		"inputs": [{"name": "processor", "type": "address"}],
		"outputs": []
	},
	{
		"name": "removeProcessor",
		"type": "function",
		"inputs": [{"name": "processor", "type": "address"}],
		"outputs": []
	},
	{
		"name": "getPlan",
		"type": "function",
		"inputs": [{"name": "planId", "type": "uint256"}],
		"outputs": [
			{"name": "merchant", "type": "address"},
			{"name": "amount", "type": "uint256"},
			{"name": "period", "type": "uint256"},
			{"name": "token", "type": "address"},
			{"name": "trialPeriod", "type": "uint256"},
			{"name": "gracePeriod", "type": "uint256"},
			{"name": "minSubscriptionTime", "type": "uint256"},
			{"name": "name", "type": "string"},
			{"name": "description", "type": "string"},
			{"name": "active", "type": "bool"},
			{"name": "subscriberCount", "type": "uint256"}
		]
	},
	{
		"name": "getSubscription",
		"type": "function",
		"inputs": [{"name": "subscriptionId", "type": "bytes32"}],
		"outputs": [
			{"name": "planId", "type": "uint256"},
			{"name": "subscriber", "type": "address"},
			{"name": "permissionId", "type": "bytes32"},
			{"name": "startTime", "type": "uint256"},
			{"name": "lastPayment", "type": "uint256"},
			{"name": "nextPayment", "type": "uint256"},
			{"name": "paymentCount", "type": "uint256"},
			{"name": "totalPaid", "type": "uint256"},
			{"name": "active", "type": "bool"},
			{"name": "inGracePeriod", "type": "bool"}
		]
	},
	{
		"name": "getSubscriberSubscriptions",
		"type": "function",
		"inputs": [{"name": "subscriber", "type": "address"}],
		"outputs": [{"name": "subscriptionIds", "type": "bytes32[]"}]
	},
	{
		"name": "getMerchantPlans",
		"type": "function",
		"inputs": [{"name": "merchant", "type": "address"}],
		"outputs": [{"name": "planIds", "type": "uint256[]"}]
	},
	{
		"name": "isPaymentDue",
		"type": "function",
		"inputs": [{"name": "subscriptionId", "type": "bytes32"}],
		"outputs": [{"name": "", "type": "bool"}]
	},
	{
		"name": "getDueSubscriptions",
		"type": "function",
		"inputs": [{"name": "subscriptionIds", "type": "bytes32[]"}],
		"outputs": [{"name": "", "type": "bytes32[]"}]
	},
	{
		"name": "daysUntilNextPayment",
		"type": "function",
		"inputs": [{"name": "subscriptionId", "type": "bytes32"}],
		"outputs": [{"name": "", "type": "int256"}]
	},
	{
		"name": "planCount",
		"type": "function",
		"inputs": [],
		"outputs": [{"name": "", "type": "uint256"}]
	},
	{
		"name": "protocolFeeBps",
		"type": "function",
		"inputs": [],
		"outputs": [{"name": "", "type": "uint256"}]
	},
	{
		"name": "authorizedProcessors",
		"type": "function",
		"inputs": [{"name": "processor", "type": "address"}],
		"outputs": [{"name": "", "type": "bool"}]
	}
]`
