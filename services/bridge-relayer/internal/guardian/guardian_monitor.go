package guardian

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/ethereum"
)

// GuardianMonitor monitors the BridgeGuardian contract for emergency events
type GuardianMonitor struct {
	ethClient  *ethereum.Client
	contracts  config.ContractConfig

	// State tracking
	mu              sync.RWMutex
	isPaused        bool
	pauseReason     string
	pausedAt        time.Time
	pausedBy        string
	activeProposals map[uint64]*domain.GuardianProposal

	// Channels
	pauseChan    chan GuardianPauseEvent
	proposalChan chan domain.GuardianProposal

	// State
	isRunning bool
}

// GuardianPauseEvent represents a pause event
type GuardianPauseEvent struct {
	Guardian  string    `json:"guardian"`
	Reason    string    `json:"reason"`
	Timestamp time.Time `json:"timestamp"`
}

// NewGuardianMonitor creates a new guardian monitor
func NewGuardianMonitor(ethClient *ethereum.Client, contracts config.ContractConfig) *GuardianMonitor {
	return &GuardianMonitor{
		ethClient:       ethClient,
		contracts:       contracts,
		activeProposals: make(map[uint64]*domain.GuardianProposal),
		pauseChan:       make(chan GuardianPauseEvent, 10),
		proposalChan:    make(chan domain.GuardianProposal, 100),
	}
}

// Start starts the guardian monitor
func (m *GuardianMonitor) Start(ctx context.Context) error {
	m.mu.Lock()
	if m.isRunning {
		m.mu.Unlock()
		return nil
	}
	m.isRunning = true
	m.mu.Unlock()

	log.Println("Starting guardian monitor...")

	// Start monitoring goroutines
	go m.monitorPauseEvents(ctx)
	go m.monitorProposals(ctx)
	go m.checkBridgeStatus(ctx)

	return nil
}

// Stop stops the guardian monitor
func (m *GuardianMonitor) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.isRunning = false
	log.Println("Guardian monitor stopped")
}

// monitorPauseEvents monitors for emergency pause events
func (m *GuardianMonitor) monitorPauseEvents(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.mu.RLock()
			if !m.isRunning {
				m.mu.RUnlock()
				continue
			}
			m.mu.RUnlock()

			if err := m.checkPauseEvents(ctx); err != nil {
				log.Printf("Error checking pause events: %v", err)
			}
		}
	}
}

// checkPauseEvents checks for new pause events
func (m *GuardianMonitor) checkPauseEvents(ctx context.Context) error {
	// In production, this would:
	// 1. Query EmergencyPause events from BridgeGuardian contract
	// 2. Update paused state
	// 3. Send to pauseChan

	return nil
}

// monitorProposals monitors for guardian proposals
func (m *GuardianMonitor) monitorProposals(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.mu.RLock()
			if !m.isRunning {
				m.mu.RUnlock()
				continue
			}
			m.mu.RUnlock()

			if err := m.checkProposalEvents(ctx); err != nil {
				log.Printf("Error checking proposal events: %v", err)
			}
		}
	}
}

// checkProposalEvents checks for new proposal events
func (m *GuardianMonitor) checkProposalEvents(ctx context.Context) error {
	// In production, this would:
	// 1. Query ProposalCreated, ProposalApproved, ProposalExecuted events
	// 2. Update activeProposals map
	// 3. Send relevant proposals to proposalChan

	return nil
}

// checkBridgeStatus periodically checks the bridge's paused status
func (m *GuardianMonitor) checkBridgeStatus(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.mu.RLock()
			if !m.isRunning {
				m.mu.RUnlock()
				continue
			}
			m.mu.RUnlock()

			if err := m.queryBridgePauseStatus(ctx); err != nil {
				log.Printf("Error querying bridge pause status: %v", err)
			}
		}
	}
}

// queryBridgePauseStatus queries the current pause status from the contract
func (m *GuardianMonitor) queryBridgePauseStatus(ctx context.Context) error {
	// In production, this would call the paused() function on the SecureBridge
	// For PoC, we use the local state
	return nil
}

// SetPaused sets the paused state (called when pause event is detected)
func (m *GuardianMonitor) SetPaused(guardian, reason string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isPaused = true
	m.pauseReason = reason
	m.pausedAt = time.Now()
	m.pausedBy = guardian

	log.Printf("Bridge paused by %s: %s", guardian, reason)

	// Send pause event
	event := GuardianPauseEvent{
		Guardian:  guardian,
		Reason:    reason,
		Timestamp: time.Now(),
	}

	select {
	case m.pauseChan <- event:
	default:
		log.Println("Warning: Pause channel full, event dropped")
	}
}

// SetUnpaused sets the unpaused state
func (m *GuardianMonitor) SetUnpaused() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isPaused = false
	m.pauseReason = ""
	m.pausedAt = time.Time{}
	m.pausedBy = ""

	log.Println("Bridge unpaused")
}

// IsPaused returns whether the bridge is paused
func (m *GuardianMonitor) IsPaused() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isPaused
}

// GetPauseInfo returns pause information
func (m *GuardianMonitor) GetPauseInfo() (bool, string, time.Time, string) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isPaused, m.pauseReason, m.pausedAt, m.pausedBy
}

// GetPauseChannel returns the pause event channel
func (m *GuardianMonitor) GetPauseChannel() <-chan GuardianPauseEvent {
	return m.pauseChan
}

// GetProposalChannel returns the proposal event channel
func (m *GuardianMonitor) GetProposalChannel() <-chan domain.GuardianProposal {
	return m.proposalChan
}

// AddProposal adds a proposal to tracking
func (m *GuardianMonitor) AddProposal(proposal *domain.GuardianProposal) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.activeProposals[proposal.ID] = proposal
}

// GetActiveProposals returns all active proposals
func (m *GuardianMonitor) GetActiveProposals() []*domain.GuardianProposal {
	m.mu.RLock()
	defer m.mu.RUnlock()

	proposals := make([]*domain.GuardianProposal, 0, len(m.activeProposals))
	for _, p := range m.activeProposals {
		proposals = append(proposals, p)
	}
	return proposals
}

// GetProposal returns a specific proposal
func (m *GuardianMonitor) GetProposal(proposalID uint64) (*domain.GuardianProposal, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, exists := m.activeProposals[proposalID]
	return p, exists
}

// RemoveProposal removes a proposal from tracking (when executed or expired)
func (m *GuardianMonitor) RemoveProposal(proposalID uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.activeProposals, proposalID)
}
