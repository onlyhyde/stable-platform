// Package subscription provides recurring payment and subscription management
// for StableNet smart accounts.
package subscription

import (
	"math/big"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Permission Types (ERC-7715)
// ============================================================================

// PermissionType represents the type of permission.
type PermissionType string

// Permission type constants.
const (
	PermissionTypeNativeTokenRecurring PermissionType = "native-token-recurring-allowance"
	PermissionTypeERC20Recurring       PermissionType = "erc20-recurring-allowance"
	PermissionTypeSessionKey           PermissionType = "session-key"
	PermissionTypeSubscription         PermissionType = "subscription"
	PermissionTypeSpendingLimit        PermissionType = "spending-limit"
)

// Permission represents an ERC-7715 permission.
type Permission struct {
	// PermissionType is the type of permission.
	PermissionType PermissionType `json:"permissionType"`
	// IsAdjustmentAllowed indicates if the permission can be modified.
	IsAdjustmentAllowed bool `json:"isAdjustmentAllowed"`
	// Data is the encoded permission data.
	Data types.Hex `json:"data"`
}

// RuleType represents rule type identifiers.
type RuleType string

// RuleType constants.
const (
	RuleTypeExpiry        RuleType = "expiry"
	RuleTypeRateLimit     RuleType = "rate-limit"
	RuleTypeSpendingLimit RuleType = "spending-limit"
)

// Rule represents a permission rule.
type Rule struct {
	// RuleType is the type of rule.
	RuleType string `json:"ruleType"`
	// Data contains rule-specific encoded data.
	Data types.Hex `json:"data"`
}

// PermissionRecord represents a stored permission record.
type PermissionRecord struct {
	// Granter is the account granting the permission.
	Granter types.Address `json:"granter"`
	// Grantee is the account receiving the permission.
	Grantee types.Address `json:"grantee"`
	// ChainID is the chain ID.
	ChainID *big.Int `json:"chainId"`
	// Target is the target contract address.
	Target types.Address `json:"target"`
	// Permission is the permission details.
	Permission Permission `json:"permission"`
	// Rules are additional permission rules.
	Rules []Rule `json:"rules"`
	// CreatedAt is the creation timestamp.
	CreatedAt *big.Int `json:"createdAt"`
	// Active indicates if the permission is active.
	Active bool `json:"active"`
}

// GrantPermissionParams contains parameters for granting a permission.
type GrantPermissionParams struct {
	// Grantee is the address receiving the permission.
	Grantee types.Address
	// Target is the target contract.
	Target types.Address
	// Permission contains the permission details.
	Permission Permission
	// Rules contains rules to apply.
	Rules []Rule
}

// GrantPermissionWithSignatureParams contains parameters for granting with signature.
type GrantPermissionWithSignatureParams struct {
	GrantPermissionParams
	// Granter is the address granting the permission.
	Granter types.Address
	// Signature is the EIP-712 signature.
	Signature types.Hex
}

// GrantSubscriptionPermissionParams contains parameters for granting a subscription-specific recurring allowance.
type GrantSubscriptionPermissionParams struct {
	// Grantee is the address receiving the permission (e.g., SubscriptionManager).
	Grantee types.Address
	// Target is the target contract for the permission.
	Target types.Address
	// SpendingLimit is the spending limit per period.
	SpendingLimit *big.Int
	// Expiry is the expiry timestamp (0 = no expiry).
	Expiry *big.Int
	// IsAdjustmentAllowed indicates whether the permission can be adjusted later.
	IsAdjustmentAllowed bool
}

// ============================================================================
// Subscription Manager Types
// ============================================================================

// Plan represents a subscription plan.
type Plan struct {
	// ID is the plan identifier.
	ID *big.Int `json:"id"`
	// Merchant is the merchant address.
	Merchant types.Address `json:"merchant"`
	// Amount is the payment amount per period.
	Amount *big.Int `json:"amount"`
	// Period is the payment period in seconds.
	Period uint64 `json:"period"`
	// Token is the payment token (0x0 for native token).
	Token types.Address `json:"token"`
	// TrialPeriod is the trial period in seconds.
	TrialPeriod uint64 `json:"trialPeriod"`
	// GracePeriod is the grace period in seconds.
	GracePeriod uint64 `json:"gracePeriod"`
	// MinSubscriptionTime is the minimum subscription duration.
	MinSubscriptionTime uint64 `json:"minSubscriptionTime"`
	// Name is the plan name.
	Name string `json:"name"`
	// Description is the plan description.
	Description string `json:"description"`
	// Active indicates if the plan is active.
	Active bool `json:"active"`
	// SubscriberCount is the number of active subscribers.
	SubscriberCount uint64 `json:"subscriberCount"`
}

// Subscription represents an active subscription.
type Subscription struct {
	// ID is the subscription identifier.
	ID *big.Int `json:"id"`
	// PlanID is the plan identifier.
	PlanID *big.Int `json:"planId"`
	// Subscriber is the subscriber address.
	Subscriber types.Address `json:"subscriber"`
	// PermissionID is the associated permission ID.
	PermissionID types.Hash `json:"permissionId"`
	// StartTime is the subscription start timestamp.
	StartTime uint64 `json:"startTime"`
	// LastPayment is the last payment timestamp.
	LastPayment uint64 `json:"lastPayment"`
	// NextPayment is the next payment timestamp.
	NextPayment uint64 `json:"nextPayment"`
	// PaymentCount is the number of payments made.
	PaymentCount uint64 `json:"paymentCount"`
	// TotalPaid is the total amount paid.
	TotalPaid *big.Int `json:"totalPaid"`
	// Active indicates if the subscription is active.
	Active bool `json:"active"`
	// InGracePeriod indicates if the subscription is in grace period.
	InGracePeriod bool `json:"inGracePeriod"`
}

// CreatePlanParams represents parameters for creating a plan.
type CreatePlanParams struct {
	// Amount is the payment amount per period.
	Amount *big.Int `json:"amount"`
	// Period is the payment period in seconds.
	Period uint64 `json:"period"`
	// Token is the payment token (0x0 for native token).
	Token types.Address `json:"token"`
	// TrialPeriod is the trial period in seconds.
	TrialPeriod uint64 `json:"trialPeriod"`
	// GracePeriod is the grace period in seconds.
	GracePeriod uint64 `json:"gracePeriod"`
	// MinSubscriptionTime is the minimum subscription duration.
	MinSubscriptionTime uint64 `json:"minSubscriptionTime"`
	// Name is the plan name.
	Name string `json:"name"`
	// Description is the plan description.
	Description string `json:"description"`
}

// SubscribeParams represents parameters for subscribing to a plan.
type SubscribeParams struct {
	// PlanID is the plan to subscribe to.
	PlanID *big.Int `json:"planId"`
	// PermissionData is the ERC-7715 permission data.
	PermissionData types.Hex `json:"permissionData"`
}

// ============================================================================
// Recurring Payment Executor Types
// ============================================================================

// PaymentSchedule represents a recurring payment schedule.
type PaymentSchedule struct {
	// ID is the schedule identifier.
	ID *big.Int `json:"id"`
	// Recipient is the payment recipient.
	Recipient types.Address `json:"recipient"`
	// Token is the payment token (0x0 for ETH).
	Token types.Address `json:"token"`
	// Amount is the payment amount.
	Amount *big.Int `json:"amount"`
	// Interval is the payment interval in seconds.
	Interval uint64 `json:"interval"`
	// StartTime is the schedule start timestamp.
	StartTime uint64 `json:"startTime"`
	// LastPaymentTime is the last payment timestamp.
	LastPaymentTime uint64 `json:"lastPaymentTime"`
	// MaxPayments is the maximum number of payments (0 = unlimited).
	MaxPayments uint64 `json:"maxPayments"`
	// PaymentsMade is the number of payments made.
	PaymentsMade uint64 `json:"paymentsMade"`
	// IsActive indicates if the schedule is active.
	IsActive bool `json:"isActive"`
}

// CreateScheduleParams represents parameters for creating a payment schedule.
type CreateScheduleParams struct {
	// Recipient is the payment recipient.
	Recipient types.Address `json:"recipient"`
	// Token is the payment token (0x0 for ETH).
	Token types.Address `json:"token"`
	// Amount is the payment amount.
	Amount *big.Int `json:"amount"`
	// Interval is the payment interval in seconds.
	Interval uint64 `json:"interval"`
	// StartTime is the schedule start timestamp.
	StartTime uint64 `json:"startTime"`
	// MaxPayments is the maximum number of payments (0 = unlimited).
	MaxPayments uint64 `json:"maxPayments"`
}

// UpdateScheduleParams represents parameters for updating a schedule.
type UpdateScheduleParams struct {
	// ScheduleID is the schedule to update.
	ScheduleID *big.Int `json:"scheduleId"`
	// NewAmount is the new payment amount (optional).
	NewAmount *big.Int `json:"newAmount,omitempty"`
	// NewRecipient is the new recipient (optional).
	NewRecipient *types.Address `json:"newRecipient,omitempty"`
}

// ExecutePaymentParams represents parameters for executing a payment.
type ExecutePaymentParams struct {
	// ScheduleID is the schedule to execute.
	ScheduleID *big.Int `json:"scheduleId"`
}

// BatchExecutePaymentParams represents parameters for batch payment execution.
type BatchExecutePaymentParams struct {
	// ScheduleIDs are the schedules to execute.
	ScheduleIDs []*big.Int `json:"scheduleIds"`
}

// RecurringPaymentExecutorInitData represents initialization data.
type RecurringPaymentExecutorInitData struct {
	// MaxSchedules is the maximum number of schedules allowed.
	MaxSchedules uint64 `json:"maxSchedules"`
	// MinInterval is the minimum payment interval in seconds.
	MinInterval uint64 `json:"minInterval"`
}

// ============================================================================
// Payment Status Types
// ============================================================================

// PaymentStatus represents the current status of a payment schedule.
type PaymentStatus struct {
	// IsDue indicates if payment is currently due.
	IsDue bool `json:"isDue"`
	// NextPaymentTime is the next payment timestamp.
	NextPaymentTime uint64 `json:"nextPaymentTime"`
	// RemainingPayments is the number of remaining payments (-1 = unlimited).
	RemainingPayments int64 `json:"remainingPayments"`
	// TotalRemainingValue is the total remaining value to be paid.
	TotalRemainingValue *big.Int `json:"totalRemainingValue"`
	// IsComplete indicates if all payments are complete.
	IsComplete bool `json:"isComplete"`
}

// ============================================================================
// Event Types
// ============================================================================

// PlanCreatedEvent represents a plan creation event.
type PlanCreatedEvent struct {
	PlanID   *big.Int      `json:"planId"`
	Merchant types.Address `json:"merchant"`
	Name     string        `json:"name"`
}

// SubscriptionCreatedEvent represents a subscription creation event.
type SubscriptionCreatedEvent struct {
	SubscriptionID *big.Int      `json:"subscriptionId"`
	PlanID         *big.Int      `json:"planId"`
	Subscriber     types.Address `json:"subscriber"`
}

// SubscriptionCancelledEvent represents a subscription cancellation event.
type SubscriptionCancelledEvent struct {
	SubscriptionID *big.Int      `json:"subscriptionId"`
	Subscriber     types.Address `json:"subscriber"`
}

// PaymentProcessedEvent represents a payment processing event.
type PaymentProcessedEvent struct {
	SubscriptionID *big.Int      `json:"subscriptionId"`
	Amount         *big.Int      `json:"amount"`
	Timestamp      uint64        `json:"timestamp"`
}

// ScheduleCreatedEvent represents a schedule creation event.
type ScheduleCreatedEvent struct {
	ScheduleID *big.Int      `json:"scheduleId"`
	Account    types.Address `json:"account"`
	Recipient  types.Address `json:"recipient"`
	Amount     *big.Int      `json:"amount"`
	Interval   uint64        `json:"interval"`
}

// ScheduleCancelledEvent represents a schedule cancellation event.
type ScheduleCancelledEvent struct {
	ScheduleID *big.Int      `json:"scheduleId"`
	Account    types.Address `json:"account"`
}

// PaymentExecutedEvent represents a payment execution event.
type PaymentExecutedEvent struct {
	ScheduleID   *big.Int      `json:"scheduleId"`
	Account      types.Address `json:"account"`
	Recipient    types.Address `json:"recipient"`
	Amount       *big.Int      `json:"amount"`
	PaymentCount uint64        `json:"paymentCount"`
}
