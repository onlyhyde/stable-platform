package executor

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/ethereum"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/middleware"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/monitor"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/mpc"
)

// BridgeExecutor handles the execution of bridge requests
type BridgeExecutor struct {
	ethClient    *ethereum.Client
	mpcClient    *mpc.SignerClient
	monitor      *monitor.EventMonitor
	contracts    config.ContractConfig

	// Request tracking
	mu              sync.RWMutex
	pendingRequests map[[32]byte]*domain.BridgeRequest
	processedCount  int
	failedCount     int

	// Event deduplication
	eventTracker *middleware.ProcessedEventTracker

	// State
	isRunning bool
	isPaused  bool
}

// NewBridgeExecutor creates a new bridge executor
func NewBridgeExecutor(
	ethClient *ethereum.Client,
	mpcClient *mpc.SignerClient,
	eventMonitor *monitor.EventMonitor,
	contracts config.ContractConfig,
	eventTracker *middleware.ProcessedEventTracker,
) *BridgeExecutor {
	return &BridgeExecutor{
		ethClient:       ethClient,
		mpcClient:       mpcClient,
		monitor:         eventMonitor,
		contracts:       contracts,
		pendingRequests: make(map[[32]byte]*domain.BridgeRequest),
		eventTracker:    eventTracker,
	}
}

// Start starts the bridge executor
func (e *BridgeExecutor) Start(ctx context.Context) error {
	e.mu.Lock()
	if e.isRunning {
		e.mu.Unlock()
		return nil
	}
	e.isRunning = true
	e.mu.Unlock()

	log.Println("Starting bridge executor...")

	// Start processing goroutines
	go e.processBridgeInitiated(ctx)
	go e.processApprovedRequests(ctx)
	go e.processChallenges(ctx)
	go e.processEmergencyPause(ctx)

	return nil
}

// Stop stops the bridge executor
func (e *BridgeExecutor) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.isRunning = false
	log.Println("Bridge executor stopped")
}

// processBridgeInitiated processes BridgeInitiated events
func (e *BridgeExecutor) processBridgeInitiated(ctx context.Context) {
	bridgeInitiatedChan := e.monitor.GetBridgeInitiatedChannel()

	for {
		select {
		case <-ctx.Done():
			return
		case event := <-bridgeInitiatedChan:
			e.mu.RLock()
			if !e.isRunning || e.isPaused {
				e.mu.RUnlock()
				continue
			}
			e.mu.RUnlock()

			if err := e.handleBridgeInitiated(ctx, event); err != nil {
				log.Printf("Error handling BridgeInitiated event: %v", err)
			}
		}
	}
}

// handleBridgeInitiated handles a BridgeInitiated event
func (e *BridgeExecutor) handleBridgeInitiated(ctx context.Context, event domain.BridgeInitiatedEvent) error {
	// Check for duplicate event processing
	if e.eventTracker != nil && !e.eventTracker.MarkProcessed(event.RequestID, "BridgeInitiated") {
		log.Printf("Skipping duplicate BridgeInitiated event: requestId=%x", event.RequestID[:8])
		return nil
	}

	log.Printf("Processing BridgeInitiated: requestId=%x, amount=%s, sender=%s",
		event.RequestID[:8], event.Amount.String(), event.Sender)

	// Create bridge request
	request := &domain.BridgeRequest{
		RequestID:   event.RequestID,
		Sender:      event.Sender,
		Recipient:   event.Recipient,
		Token:       event.Token,
		Amount:      event.Amount,
		SourceChain: event.SourceChain,
		TargetChain: event.TargetChain,
		Fee:         event.Fee,
		Status:      domain.StatusPending,
		InitiatedAt: time.Now(),
	}

	// Store in pending requests
	e.mu.Lock()
	e.pendingRequests[event.RequestID] = request
	e.mu.Unlock()

	log.Printf("Bridge request %x added to pending queue", event.RequestID[:8])

	return nil
}

// processApprovedRequests processes approved requests
func (e *BridgeExecutor) processApprovedRequests(ctx context.Context) {
	requestApprovedChan := e.monitor.GetRequestApprovedChannel()

	for {
		select {
		case <-ctx.Done():
			return
		case event := <-requestApprovedChan:
			e.mu.RLock()
			if !e.isRunning || e.isPaused {
				e.mu.RUnlock()
				continue
			}
			e.mu.RUnlock()

			if err := e.handleRequestApproved(ctx, event); err != nil {
				log.Printf("Error handling RequestApproved event: %v", err)
			}
		}
	}
}

// handleRequestApproved handles a RequestApproved event
func (e *BridgeExecutor) handleRequestApproved(ctx context.Context, event domain.RequestApprovedEvent) error {
	// Check for duplicate event processing
	if e.eventTracker != nil && !e.eventTracker.MarkProcessed(event.RequestID, "RequestApproved") {
		log.Printf("Skipping duplicate RequestApproved event: requestId=%x", event.RequestID[:8])
		return nil
	}

	log.Printf("Processing RequestApproved: requestId=%x", event.RequestID[:8])

	// Get pending request
	e.mu.RLock()
	request, exists := e.pendingRequests[event.RequestID]
	e.mu.RUnlock()

	if !exists {
		return fmt.Errorf("request %x not found in pending requests", event.RequestID[:8])
	}

	// Update status
	request.Status = domain.StatusApproved

	// Execute the bridge completion
	if err := e.executeBridgeCompletion(ctx, request); err != nil {
		e.mu.Lock()
		e.failedCount++
		e.mu.Unlock()
		return fmt.Errorf("failed to execute bridge completion: %w", err)
	}

	// Update status and counts
	e.mu.Lock()
	request.Status = domain.StatusExecuted
	delete(e.pendingRequests, event.RequestID)
	e.processedCount++
	e.mu.Unlock()

	log.Printf("Bridge request %x completed successfully", event.RequestID[:8])

	return nil
}

// executeBridgeCompletion executes the completeBridge transaction
func (e *BridgeExecutor) executeBridgeCompletion(ctx context.Context, request *domain.BridgeRequest) error {
	// 1. Create bridge message for signing
	msg := domain.BridgeMessage{
		RequestID:   request.RequestID,
		Sender:      request.Sender,
		Recipient:   request.Recipient,
		Token:       request.Token,
		Amount:      request.Amount,
		SourceChain: request.SourceChain,
		TargetChain: request.TargetChain,
		Nonce:       request.Nonce,
		Deadline:    request.Deadline,
	}

	// 2. Collect MPC signatures
	log.Printf("Collecting MPC signatures for request %x", request.RequestID[:8])
	signatures, err := e.mpcClient.CollectSignatures(ctx, msg)
	if err != nil {
		// Fallback to simulated signatures for PoC testing
		log.Printf("MPC signature collection failed, using simulated signatures: %v", err)
		signatures, err = e.mpcClient.SimulateSignatures(msg)
		if err != nil {
			return fmt.Errorf("failed to collect signatures: %w", err)
		}
	}
	request.Signatures = signatures

	// 3. Encode completeBridge call
	callData, err := e.ethClient.EncodeCompleteBridge(
		request.RequestID,
		request.Sender,
		request.Recipient,
		request.Token,
		request.Amount,
		request.SourceChain,
		request.Nonce,
		request.Deadline,
		signatures,
	)
	if err != nil {
		return fmt.Errorf("failed to encode completeBridge call: %w", err)
	}

	// 4. Send transaction to target chain
	log.Printf("Sending completeBridge transaction for request %x", request.RequestID[:8])
	txHash, err := e.ethClient.SendTransaction(ctx, e.contracts.SecureBridge, callData, big.NewInt(0), false)
	if err != nil {
		return fmt.Errorf("failed to send transaction: %w", err)
	}

	log.Printf("Transaction sent: %s", txHash)
	request.TxHash = txHash

	// 5. Wait for confirmation
	success, err := e.ethClient.WaitForTransaction(ctx, txHash, false)
	if err != nil {
		return fmt.Errorf("failed waiting for transaction: %w", err)
	}

	if !success {
		return fmt.Errorf("transaction %s failed", txHash)
	}

	return nil
}

// processChallenges processes challenge events
func (e *BridgeExecutor) processChallenges(ctx context.Context) {
	challengedChan := e.monitor.GetRequestChallengedChannel()
	resolvedChan := e.monitor.GetChallengeResolvedChannel()

	for {
		select {
		case <-ctx.Done():
			return
		case event := <-challengedChan:
			e.handleRequestChallenged(event)
		case event := <-resolvedChan:
			e.handleChallengeResolved(event)
		}
	}
}

// handleRequestChallenged handles a RequestChallenged event
func (e *BridgeExecutor) handleRequestChallenged(event domain.RequestChallengedEvent) {
	log.Printf("Request %x challenged by %s: %s", event.RequestID[:8], event.Challenger, event.Reason)

	e.mu.Lock()
	defer e.mu.Unlock()

	if request, exists := e.pendingRequests[event.RequestID]; exists {
		request.Status = domain.StatusChallenged
	}
}

// handleChallengeResolved handles a ChallengeResolved event
func (e *BridgeExecutor) handleChallengeResolved(event domain.ChallengeResolvedEvent) {
	log.Printf("Challenge for request %x resolved: success=%v", event.RequestID[:8], event.ChallengeSuccess)

	e.mu.Lock()
	defer e.mu.Unlock()

	if request, exists := e.pendingRequests[event.RequestID]; exists {
		if event.ChallengeSuccess {
			request.Status = domain.StatusRefunded
			delete(e.pendingRequests, event.RequestID)
		} else {
			request.Status = domain.StatusApproved
		}
	}
}

// processEmergencyPause handles emergency pause events
func (e *BridgeExecutor) processEmergencyPause(ctx context.Context) {
	pauseChan := e.monitor.GetEmergencyPauseChannel()

	for {
		select {
		case <-ctx.Done():
			return
		case event := <-pauseChan:
			log.Printf("Emergency pause triggered by %s: %s", event.Guardian, event.Reason)
			e.Pause()
		}
	}
}

// Pause pauses the executor
func (e *BridgeExecutor) Pause() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.isPaused = true
	log.Println("Bridge executor paused")
}

// Resume resumes the executor
func (e *BridgeExecutor) Resume() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.isPaused = false
	log.Println("Bridge executor resumed")
}

// IsPaused returns whether the executor is paused
func (e *BridgeExecutor) IsPaused() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.isPaused
}

// GetPendingRequestCount returns the number of pending requests
func (e *BridgeExecutor) GetPendingRequestCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.pendingRequests)
}

// GetProcessedCount returns the number of processed requests
func (e *BridgeExecutor) GetProcessedCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.processedCount
}

// GetFailedCount returns the number of failed requests
func (e *BridgeExecutor) GetFailedCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.failedCount
}

// GetPendingRequests returns all pending requests
func (e *BridgeExecutor) GetPendingRequests() []*domain.BridgeRequest {
	e.mu.RLock()
	defer e.mu.RUnlock()

	requests := make([]*domain.BridgeRequest, 0, len(e.pendingRequests))
	for _, req := range e.pendingRequests {
		requests = append(requests, req)
	}
	return requests
}

// GetRequest returns a specific request by ID
func (e *BridgeExecutor) GetRequest(requestID [32]byte) (*domain.BridgeRequest, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	req, exists := e.pendingRequests[requestID]
	return req, exists
}
