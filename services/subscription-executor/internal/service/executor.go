package service

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/stablenet/stable-platform/services/subscription-executor/internal/client"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/config"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/model"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/repository"
)

// ExecutorService handles subscription execution
type ExecutorService struct {
	cfg             *config.Config
	repo            repository.SubscriptionRepository
	stopCh          chan struct{}
	bundlerClient   *client.BundlerClient
	paymasterClient *client.PaymasterClient
	userOpBuilder   *client.UserOpBuilder
	rpcClient       *client.RPCClient
}

// NewExecutorService creates a new executor service with the given repository
func NewExecutorService(cfg *config.Config, repo repository.SubscriptionRepository) *ExecutorService {
	// Initialize bundler client
	bundlerClient := client.NewBundlerClient(cfg.BundlerURL, cfg.EntryPointAddress)

	// Initialize paymaster client
	paymasterClient := client.NewPaymasterClient(cfg.PaymasterURL)

	// Initialize UserOp builder
	userOpBuilder := client.NewUserOpBuilder(cfg.ChainID, cfg.EntryPointAddress)

	// Initialize RPC client for nonce queries
	rpcClient := client.NewRPCClient(cfg.RPCURL)

	return &ExecutorService{
		cfg:             cfg,
		repo:            repo,
		stopCh:          make(chan struct{}),
		bundlerClient:   bundlerClient,
		paymasterClient: paymasterClient,
		userOpBuilder:   userOpBuilder,
		rpcClient:       rpcClient,
	}
}

// Start begins the subscription polling loop
func (s *ExecutorService) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(s.cfg.PollingInterval) * time.Second)
	defer ticker.Stop()

	log.Printf("Starting executor service with polling interval: %d seconds", s.cfg.PollingInterval)

	for {
		select {
		case <-ctx.Done():
			log.Println("Executor service stopped due to context cancellation")
			return
		case <-s.stopCh:
			log.Println("Executor service stopped")
			return
		case <-ticker.C:
			s.processDueSubscriptions(ctx)
		}
	}
}

// Stop stops the executor service
func (s *ExecutorService) Stop() {
	close(s.stopCh)
}

// CreateSubscription creates a new subscription
func (s *ExecutorService) CreateSubscription(ctx context.Context, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", req.Amount)
	}

	now := time.Now()
	sub := &model.Subscription{
		ID:             generateID(),
		SmartAccount:   req.SmartAccount,
		Recipient:      req.Recipient,
		Token:          req.Token,
		Amount:         amount,
		Interval:       int64(req.IntervalDays) * 86400,
		NextExecution:  now.Add(time.Duration(req.IntervalDays) * 24 * time.Hour),
		ExecutionCount: 0,
		MaxExecutions:  req.MaxExecutions,
		Status:         model.StatusActive,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.repo.Create(ctx, sub); err != nil {
		return nil, fmt.Errorf("failed to save subscription: %w", err)
	}

	log.Printf("Created subscription: %s for account: %s", sub.ID, sub.SmartAccount)
	return sub, nil
}

// GetSubscription returns a subscription by ID
func (s *ExecutorService) GetSubscription(ctx context.Context, id string) (*model.Subscription, error) {
	sub, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found: %s", id)
	}
	return sub, nil
}

// GetSubscriptionsByAccount returns all subscriptions for an account
func (s *ExecutorService) GetSubscriptionsByAccount(ctx context.Context, account string) ([]*model.Subscription, error) {
	subs, err := s.repo.GetByAccount(ctx, account)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscriptions: %w", err)
	}
	return subs, nil
}

// CancelSubscription cancels a subscription
func (s *ExecutorService) CancelSubscription(ctx context.Context, id string) error {
	if err := s.repo.UpdateStatus(ctx, id, model.StatusCancelled); err != nil {
		return fmt.Errorf("failed to cancel subscription: %w", err)
	}
	log.Printf("Cancelled subscription: %s", id)
	return nil
}

// PauseSubscription pauses a subscription
func (s *ExecutorService) PauseSubscription(ctx context.Context, id string) error {
	if err := s.repo.UpdateStatus(ctx, id, model.StatusPaused); err != nil {
		return fmt.Errorf("failed to pause subscription: %w", err)
	}
	log.Printf("Paused subscription: %s", id)
	return nil
}

// ResumeSubscription resumes a paused subscription
func (s *ExecutorService) ResumeSubscription(ctx context.Context, id string) error {
	sub, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return fmt.Errorf("subscription not found: %s", id)
	}
	if sub.Status != model.StatusPaused {
		return fmt.Errorf("subscription is not paused: %s", id)
	}

	if err := s.repo.UpdateStatus(ctx, id, model.StatusActive); err != nil {
		return fmt.Errorf("failed to resume subscription: %w", err)
	}
	log.Printf("Resumed subscription: %s", id)
	return nil
}

// processDueSubscriptions processes all subscriptions that are due
func (s *ExecutorService) processDueSubscriptions(ctx context.Context) {
	// Use GetDueSubscriptions for read-only check
	// In production, consider using GetDueSubscriptionsWithLock for concurrent workers
	dueSubscriptions, err := s.repo.GetDueSubscriptions(ctx, 100)
	if err != nil {
		log.Printf("Failed to get due subscriptions: %v", err)
		return
	}

	if len(dueSubscriptions) == 0 {
		return
	}

	log.Printf("Found %d due subscriptions", len(dueSubscriptions))

	for _, sub := range dueSubscriptions {
		if err := s.executeSubscription(ctx, sub); err != nil {
			log.Printf("Failed to execute subscription %s: %v", sub.ID, err)
		}
	}
}

// executeSubscription executes a single subscription payment
func (s *ExecutorService) executeSubscription(ctx context.Context, sub *model.Subscription) error {
	log.Printf("Executing subscription: %s", sub.ID)

	// Create execution record
	record := &model.ExecutionRecord{
		SubscriptionID: sub.ID,
		Status:         "pending",
		CreatedAt:      time.Now(),
	}
	if err := s.repo.CreateExecutionRecord(ctx, record); err != nil {
		log.Printf("Failed to create execution record: %v", err)
		// Continue with execution even if record creation fails
	}

	// Parse record ID for updates
	var recordID int64
	if record.ID != "" {
		fmt.Sscanf(record.ID, "%d", &recordID)
	}

	// Execute UserOperation
	txHash, gasUsed, err := s.submitUserOperation(ctx, sub)
	if err != nil {
		// Update record as failed
		if recordID > 0 {
			s.updateExecutionRecord(ctx, recordID, "failed", "", 0, err.Error())
		}
		return fmt.Errorf("failed to submit user operation: %w", err)
	}

	// Update execution record as success
	if recordID > 0 {
		s.updateExecutionRecord(ctx, recordID, "success", txHash, gasUsed, "")
	}

	// Update subscription state
	now := time.Now()
	sub.LastExecution = &now
	sub.ExecutionCount++
	sub.NextExecution = now.Add(time.Duration(sub.Interval) * time.Second)
	sub.UpdatedAt = now

	// Check if max executions reached
	if sub.MaxExecutions > 0 && sub.ExecutionCount >= sub.MaxExecutions {
		sub.Status = model.StatusExpired
		log.Printf("Subscription %s reached max executions", sub.ID)
	}

	// Update subscription in database
	if err := s.repo.Update(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	log.Printf("Successfully executed subscription: %s (txHash: %s, count: %d)", sub.ID, txHash, sub.ExecutionCount)
	return nil
}

// submitUserOperation builds and submits a UserOperation for a subscription payment
func (s *ExecutorService) submitUserOperation(ctx context.Context, sub *model.Subscription) (string, uint64, error) {
	chainID := fmt.Sprintf("0x%x", s.cfg.ChainID)

	// 1. Get nonce from EntryPoint
	nonce, err := s.rpcClient.GetNonce(ctx, sub.SmartAccount, s.cfg.EntryPointAddress)
	if err != nil {
		return "", 0, fmt.Errorf("failed to get nonce: %w", err)
	}
	nonceInt := new(big.Int)
	nonceInt.SetString(nonce[2:], 16)

	// 2. Build UserOperation
	userOp := s.userOpBuilder.CreateUserOperation(
		sub.SmartAccount,
		nonceInt,
		sub.Token,
		sub.Recipient,
		sub.Amount,
	)

	// 3. Get gas prices
	gasPrice, err := s.rpcClient.GetGasPrice(ctx)
	if err != nil {
		return "", 0, fmt.Errorf("failed to get gas price: %w", err)
	}
	maxPriorityFee, _ := s.rpcClient.GetMaxPriorityFeePerGas(ctx)

	gasPriceInt := new(big.Int)
	gasPriceInt.SetString(gasPrice[2:], 16)
	maxPriorityFeeInt := new(big.Int)
	maxPriorityFeeInt.SetString(maxPriorityFee[2:], 16)

	// Set gas fees (maxPriorityFeePerGas || maxFeePerGas)
	userOp.GasFees = client.PackGasFees(maxPriorityFeeInt, gasPriceInt)

	// 4. Get paymaster stub data for gas estimation
	stubReq := &client.PaymasterStubDataRequest{
		Sender:   userOp.Sender,
		Nonce:    userOp.Nonce,
		InitCode: userOp.InitCode,
		CallData: userOp.CallData,
	}
	stubData, err := s.paymasterClient.GetPaymasterStubData(ctx, stubReq, chainID, s.cfg.EntryPointAddress)
	if err != nil {
		return "", 0, fmt.Errorf("failed to get paymaster stub data: %w", err)
	}

	// Set stub paymaster data for gas estimation
	pmVerifyGas := new(big.Int)
	pmVerifyGas.SetString(stubData.PaymasterVerificationGasLimit[2:], 16)
	pmPostOpGas := new(big.Int)
	pmPostOpGas.SetString(stubData.PaymasterPostOpGasLimit[2:], 16)
	userOp.PaymasterAndData = client.PackPaymasterAndData(
		stubData.Paymaster,
		pmVerifyGas,
		pmPostOpGas,
		stubData.PaymasterData,
	)

	// 5. Estimate gas via bundler
	// Use a dummy signature for estimation (65 bytes of 0x01)
	userOp.Signature = "0x" + fmt.Sprintf("%0130x", 1)
	gasEstimate, err := s.bundlerClient.EstimateUserOperationGas(ctx, userOp)
	if err != nil {
		return "", 0, fmt.Errorf("failed to estimate gas: %w", err)
	}

	// 6. Set estimated gas limits
	verifyGas := new(big.Int)
	verifyGas.SetString(gasEstimate.VerificationGasLimit[2:], 16)
	callGas := new(big.Int)
	callGas.SetString(gasEstimate.CallGasLimit[2:], 16)
	preVerifyGas := new(big.Int)
	preVerifyGas.SetString(gasEstimate.PreVerificationGas[2:], 16)

	userOp.AccountGasLimits = client.PackAccountGasLimits(verifyGas, callGas)
	userOp.PreVerificationGas = fmt.Sprintf("0x%x", preVerifyGas)

	// 7. Get final paymaster data with signature
	pmDataReq := &client.PaymasterDataRequest{
		Sender:             userOp.Sender,
		Nonce:              userOp.Nonce,
		InitCode:           userOp.InitCode,
		CallData:           userOp.CallData,
		AccountGasLimits:   userOp.AccountGasLimits,
		PreVerificationGas: userOp.PreVerificationGas,
		GasFees:            userOp.GasFees,
	}
	pmData, err := s.paymasterClient.GetPaymasterData(ctx, pmDataReq, chainID, s.cfg.EntryPointAddress)
	if err != nil {
		return "", 0, fmt.Errorf("failed to get paymaster data: %w", err)
	}

	// Update paymaster data with final signature
	finalPmVerifyGas := pmVerifyGas
	finalPmPostOpGas := pmPostOpGas
	if pmData.PaymasterVerificationGasLimit != "" {
		finalPmVerifyGas = new(big.Int)
		finalPmVerifyGas.SetString(pmData.PaymasterVerificationGasLimit[2:], 16)
	}
	if pmData.PaymasterPostOpGasLimit != "" {
		finalPmPostOpGas = new(big.Int)
		finalPmPostOpGas.SetString(pmData.PaymasterPostOpGasLimit[2:], 16)
	}
	userOp.PaymasterAndData = client.PackPaymasterAndData(
		pmData.Paymaster,
		finalPmVerifyGas,
		finalPmPostOpGas,
		pmData.PaymasterData,
	)

	// 8. Sign the UserOperation
	// For subscription executor, we use a session key or pre-authorized signature
	// The smart account should have pre-authorized this executor
	// Using a placeholder signature - in production, implement proper signing
	userOp.Signature = "0x" + fmt.Sprintf("%0130x", 1) // Placeholder

	// 9. Submit to bundler
	userOpHash, err := s.bundlerClient.SendUserOperation(ctx, userOp)
	if err != nil {
		return "", 0, fmt.Errorf("failed to send user operation: %w", err)
	}
	log.Printf("UserOperation submitted: %s", userOpHash)

	// 10. Wait for receipt
	receipt, err := s.bundlerClient.WaitForReceipt(ctx, userOpHash, 60*time.Second)
	if err != nil {
		return "", 0, fmt.Errorf("failed to get receipt: %w", err)
	}

	if !receipt.Success {
		return "", 0, fmt.Errorf("user operation failed: %s", receipt.Reason)
	}

	// Parse gas used
	gasUsed := uint64(0)
	if receipt.ActualGasUsed != "" {
		gasUsedInt := new(big.Int)
		gasUsedInt.SetString(receipt.ActualGasUsed[2:], 16)
		gasUsed = gasUsedInt.Uint64()
	}

	return receipt.Receipt.TransactionHash, gasUsed, nil
}

// updateExecutionRecord updates an execution record with the result
func (s *ExecutorService) updateExecutionRecord(ctx context.Context, recordID int64, status string, txHash string, gasUsed uint64, errMsg string) {
	gasUsedStr := ""
	if gasUsed > 0 {
		gasUsedStr = fmt.Sprintf("%d", gasUsed)
	}

	if err := s.repo.UpdateExecutionRecord(ctx, recordID, status, txHash, errMsg, gasUsedStr); err != nil {
		log.Printf("Failed to update execution record: %v", err)
	}
}

// generateID generates a unique ID
func generateID() string {
	return fmt.Sprintf("sub_%d", time.Now().UnixNano())
}
