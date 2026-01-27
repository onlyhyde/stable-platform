package guardian

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
)

// Guardian Monitor Tests

func TestNewGuardianMonitor(t *testing.T) {
	contracts := config.ContractConfig{
		BridgeGuardian: "0x1234567890abcdef1234567890abcdef12345678",
	}

	monitor := NewGuardianMonitor(nil, contracts)

	if monitor == nil {
		t.Fatal("expected monitor to be created")
	}
	if monitor.activeProposals == nil {
		t.Fatal("expected activeProposals map to be initialized")
	}
	if monitor.pauseChan == nil {
		t.Fatal("expected pauseChan to be initialized")
	}
	if cap(monitor.pauseChan) != 10 {
		t.Errorf("expected pause channel capacity 10, got %d", cap(monitor.pauseChan))
	}
}

func TestGuardianMonitor_StartStop(t *testing.T) {
	monitor := NewGuardianMonitor(nil, config.ContractConfig{})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initially not running
	monitor.mu.RLock()
	if monitor.isRunning {
		t.Error("expected monitor to not be running initially")
	}
	monitor.mu.RUnlock()

	// Start
	err := monitor.Start(ctx)
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}

	monitor.mu.RLock()
	if !monitor.isRunning {
		t.Error("expected monitor to be running after Start()")
	}
	monitor.mu.RUnlock()

	// Stop
	monitor.Stop()
	monitor.mu.RLock()
	if monitor.isRunning {
		t.Error("expected monitor to not be running after Stop()")
	}
	monitor.mu.RUnlock()
}

func TestGuardianMonitor_PauseState(t *testing.T) {
	monitor := NewGuardianMonitor(nil, config.ContractConfig{})

	// Initially not paused
	if monitor.IsPaused() {
		t.Error("expected bridge to not be paused initially")
	}

	// Set paused
	monitor.SetPaused("0xguardian", "suspicious activity detected")

	if !monitor.IsPaused() {
		t.Error("expected bridge to be paused")
	}

	isPaused, reason, pausedAt, pausedBy := monitor.GetPauseInfo()
	if !isPaused {
		t.Error("GetPauseInfo: expected paused")
	}
	if reason != "suspicious activity detected" {
		t.Errorf("reason = %s, want 'suspicious activity detected'", reason)
	}
	if pausedBy != "0xguardian" {
		t.Errorf("pausedBy = %s, want '0xguardian'", pausedBy)
	}
	if pausedAt.IsZero() {
		t.Error("pausedAt should not be zero")
	}

	// Receive pause event
	select {
	case event := <-monitor.GetPauseChannel():
		if event.Guardian != "0xguardian" {
			t.Errorf("event.Guardian = %s, want '0xguardian'", event.Guardian)
		}
		if event.Reason != "suspicious activity detected" {
			t.Errorf("event.Reason = %s, want 'suspicious activity detected'", event.Reason)
		}
	default:
		t.Error("expected pause event")
	}

	// Set unpaused
	monitor.SetUnpaused()

	if monitor.IsPaused() {
		t.Error("expected bridge to not be paused after unpause")
	}
}

func TestGuardianMonitor_Proposals(t *testing.T) {
	monitor := NewGuardianMonitor(nil, config.ContractConfig{})

	// Initially no proposals
	proposals := monitor.GetActiveProposals()
	if len(proposals) != 0 {
		t.Errorf("expected 0 proposals, got %d", len(proposals))
	}

	// Add proposals
	proposal1 := &domain.GuardianProposal{
		ID:           1,
		ProposalType: "pause",
	}
	proposal2 := &domain.GuardianProposal{
		ID:           2,
		ProposalType: "unpause",
	}

	monitor.AddProposal(proposal1)
	monitor.AddProposal(proposal2)

	proposals = monitor.GetActiveProposals()
	if len(proposals) != 2 {
		t.Errorf("expected 2 proposals, got %d", len(proposals))
	}

	// Get specific proposal
	p, exists := monitor.GetProposal(1)
	if !exists {
		t.Error("expected proposal 1 to exist")
	}
	if p.ProposalType != "pause" {
		t.Errorf("ProposalType = %s, want 'pause'", p.ProposalType)
	}

	// Get non-existent proposal
	_, exists = monitor.GetProposal(99)
	if exists {
		t.Error("expected proposal 99 to not exist")
	}

	// Remove proposal
	monitor.RemoveProposal(1)
	proposals = monitor.GetActiveProposals()
	if len(proposals) != 1 {
		t.Errorf("expected 1 proposal after removal, got %d", len(proposals))
	}
}

// Challenge Manager Tests

func TestNewChallengeManager(t *testing.T) {
	cfg := config.ContractConfig{
		BridgeGuardian: "0x1234567890abcdef1234567890abcdef12345678",
	}

	manager := NewChallengeManager(cfg)

	if manager == nil {
		t.Fatal("expected manager to be created")
	}
	if manager.challenges == nil {
		t.Fatal("expected challenges map to be initialized")
	}
	if manager.challengePeriod != 24*time.Hour {
		t.Errorf("expected default challenge period 24h, got %v", manager.challengePeriod)
	}
	if manager.minStakeAmount.Cmp(big.NewInt(1e17)) != 0 {
		t.Errorf("expected default min stake 1e17, got %s", manager.minStakeAmount)
	}
}

func TestChallengeManager_ChallengePeriod(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})

	manager.SetChallengePeriod(48 * time.Hour)
	if manager.GetChallengePeriod() != 48*time.Hour {
		t.Errorf("expected 48h, got %v", manager.GetChallengePeriod())
	}
}

func TestChallengeManager_MinStakeAmount(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})

	newAmount := big.NewInt(2e18)
	manager.SetMinStakeAmount(newAmount)

	got := manager.GetMinStakeAmount()
	if got.Cmp(newAmount) != 0 {
		t.Errorf("expected %s, got %s", newAmount, got)
	}
}

func TestChallengeManager_SubmitChallenge(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	requestID := [32]byte{1, 2, 3}
	challenger := "0xchallenger123"
	evidence := []byte("fraud evidence")
	stakeAmount := big.NewInt(1e18)

	challenge, err := manager.SubmitChallenge(ctx, requestID, challenger, "invalid_signature", evidence, stakeAmount)
	if err != nil {
		t.Fatalf("SubmitChallenge() error = %v", err)
	}

	if challenge.ID != 1 {
		t.Errorf("challenge.ID = %d, want 1", challenge.ID)
	}
	if challenge.Challenger != challenger {
		t.Errorf("challenge.Challenger = %s, want %s", challenge.Challenger, challenger)
	}
	if challenge.Status != ChallengeStatusActive {
		t.Errorf("challenge.Status = %d, want Active", challenge.Status)
	}
	if challenge.ExpiresAt.Before(time.Now()) {
		t.Error("challenge should not be expired yet")
	}

	// Receive challenge event
	select {
	case ch := <-manager.GetChallengeChannel():
		if ch.ID != challenge.ID {
			t.Errorf("event challenge ID = %d, want %d", ch.ID, challenge.ID)
		}
	default:
		t.Error("expected challenge event")
	}
}

func TestChallengeManager_SubmitChallenge_Errors(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	requestID := [32]byte{1, 2, 3}

	// Empty challenger
	_, err := manager.SubmitChallenge(ctx, requestID, "", "type", []byte("data"), big.NewInt(1e18))
	if err != ErrInvalidChallenger {
		t.Errorf("expected ErrInvalidChallenger, got %v", err)
	}

	// Insufficient stake
	_, err = manager.SubmitChallenge(ctx, requestID, "challenger", "type", []byte("data"), big.NewInt(1e16))
	if err != ErrInsufficientStake {
		t.Errorf("expected ErrInsufficientStake, got %v", err)
	}

	// Nil stake
	_, err = manager.SubmitChallenge(ctx, requestID, "challenger", "type", []byte("data"), nil)
	if err != ErrInsufficientStake {
		t.Errorf("expected ErrInsufficientStake for nil stake, got %v", err)
	}

	// Duplicate challenge
	_, _ = manager.SubmitChallenge(ctx, requestID, "challenger", "type", []byte("data"), big.NewInt(1e18))
	_, err = manager.SubmitChallenge(ctx, requestID, "challenger2", "type", []byte("data"), big.NewInt(1e18))
	if err != ErrChallengeExists {
		t.Errorf("expected ErrChallengeExists, got %v", err)
	}
}

func TestChallengeManager_ResolveChallenge_ChallengerWins(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	requestID := [32]byte{1, 2, 3}
	challenger := "0xchallenger"
	challenge, _ := manager.SubmitChallenge(ctx, requestID, challenger, "fraud", []byte("evidence"), big.NewInt(1e18))

	// Drain challenge channel
	<-manager.GetChallengeChannel()

	resolution, err := manager.ResolveChallenge(ctx, challenge.ID, true, "0xresolver")
	if err != nil {
		t.Fatalf("ResolveChallenge() error = %v", err)
	}

	if !resolution.IsValid {
		t.Error("expected resolution.IsValid = true")
	}
	if resolution.Winner != challenger {
		t.Errorf("Winner = %s, want %s", resolution.Winner, challenger)
	}

	// Check challenge status updated
	updatedChallenge, _ := manager.GetChallenge(challenge.ID)
	if updatedChallenge.Status != ChallengeStatusResolved {
		t.Errorf("Status = %d, want Resolved", updatedChallenge.Status)
	}
	if updatedChallenge.Resolution != "challenger_wins" {
		t.Errorf("Resolution = %s, want 'challenger_wins'", updatedChallenge.Resolution)
	}

	// Receive resolution event
	select {
	case res := <-manager.GetResolutionChannel():
		if res.ChallengeID != challenge.ID {
			t.Errorf("resolution challenge ID = %d, want %d", res.ChallengeID, challenge.ID)
		}
	default:
		t.Error("expected resolution event")
	}
}

func TestChallengeManager_ResolveChallenge_ChallengerLoses(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	stakeAmount := big.NewInt(1e18)
	challenge, _ := manager.SubmitChallenge(ctx, [32]byte{1}, "challenger", "fraud", []byte("evidence"), stakeAmount)
	<-manager.GetChallengeChannel()

	resolution, err := manager.ResolveChallenge(ctx, challenge.ID, false, "0xresolver")
	if err != nil {
		t.Fatalf("ResolveChallenge() error = %v", err)
	}

	if resolution.IsValid {
		t.Error("expected resolution.IsValid = false")
	}
	if resolution.Winner != "" {
		t.Errorf("Winner = %s, want empty", resolution.Winner)
	}

	// Check slashing - 50% of stake
	expectedSlash := new(big.Int).Mul(stakeAmount, big.NewInt(50))
	expectedSlash.Div(expectedSlash, big.NewInt(100))
	if resolution.SlashedAmount.Cmp(expectedSlash) != 0 {
		t.Errorf("SlashedAmount = %s, want %s", resolution.SlashedAmount, expectedSlash)
	}
}

func TestChallengeManager_ResolveChallenge_Errors(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	// Not found
	_, err := manager.ResolveChallenge(ctx, 999, true, "resolver")
	if err != ErrChallengeNotFound {
		t.Errorf("expected ErrChallengeNotFound, got %v", err)
	}

	// Already resolved
	challenge, _ := manager.SubmitChallenge(ctx, [32]byte{1}, "challenger", "fraud", []byte("evidence"), big.NewInt(1e18))
	<-manager.GetChallengeChannel()
	_, _ = manager.ResolveChallenge(ctx, challenge.ID, true, "resolver")
	<-manager.GetResolutionChannel()

	_, err = manager.ResolveChallenge(ctx, challenge.ID, false, "resolver")
	if err != ErrAlreadyResolved {
		t.Errorf("expected ErrAlreadyResolved, got %v", err)
	}
}

func TestChallengeManager_ResolveChallenge_Expired(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	manager.SetChallengePeriod(time.Millisecond) // Very short period
	ctx := context.Background()

	challenge, _ := manager.SubmitChallenge(ctx, [32]byte{1}, "challenger", "fraud", []byte("evidence"), big.NewInt(1e18))
	<-manager.GetChallengeChannel()

	// Wait for expiration
	time.Sleep(10 * time.Millisecond)

	_, err := manager.ResolveChallenge(ctx, challenge.ID, true, "resolver")
	if err != ErrChallengeExpired {
		t.Errorf("expected ErrChallengeExpired, got %v", err)
	}
}

func TestChallengeManager_GetChallengesByRequest(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	requestID1 := [32]byte{1}
	requestID2 := [32]byte{2}

	// Add challenges for request 1
	manager.SubmitChallenge(ctx, requestID1, "challenger1", "type1", []byte("data"), big.NewInt(1e18))
	// Resolve first challenge so we can add another
	manager.mu.Lock()
	manager.challenges[1].Status = ChallengeStatusResolved
	manager.mu.Unlock()
	manager.SubmitChallenge(ctx, requestID1, "challenger2", "type2", []byte("data"), big.NewInt(1e18))

	// Add challenge for request 2
	manager.SubmitChallenge(ctx, requestID2, "challenger3", "type1", []byte("data"), big.NewInt(1e18))

	// Drain channel
	for i := 0; i < 3; i++ {
		<-manager.GetChallengeChannel()
	}

	challenges := manager.GetChallengesByRequest(requestID1)
	if len(challenges) != 2 {
		t.Errorf("expected 2 challenges for request1, got %d", len(challenges))
	}

	challenges = manager.GetChallengesByRequest(requestID2)
	if len(challenges) != 1 {
		t.Errorf("expected 1 challenge for request2, got %d", len(challenges))
	}

	challenges = manager.GetChallengesByRequest([32]byte{99})
	if len(challenges) != 0 {
		t.Errorf("expected 0 challenges for unknown request, got %d", len(challenges))
	}
}

func TestChallengeManager_GetActiveChallenges(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	// Add challenges
	manager.SubmitChallenge(ctx, [32]byte{1}, "challenger1", "type", []byte("data"), big.NewInt(1e18))
	manager.SubmitChallenge(ctx, [32]byte{2}, "challenger2", "type", []byte("data"), big.NewInt(1e18))
	challenge3, _ := manager.SubmitChallenge(ctx, [32]byte{3}, "challenger3", "type", []byte("data"), big.NewInt(1e18))

	// Drain channel
	for i := 0; i < 3; i++ {
		<-manager.GetChallengeChannel()
	}

	// Resolve one
	manager.ResolveChallenge(ctx, challenge3.ID, true, "resolver")
	<-manager.GetResolutionChannel()

	active := manager.GetActiveChallenges()
	if len(active) != 2 {
		t.Errorf("expected 2 active challenges, got %d", len(active))
	}
}

func TestChallengeManager_ExpireChallenge(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	challenge, _ := manager.SubmitChallenge(ctx, [32]byte{1}, "challenger", "type", []byte("data"), big.NewInt(1e18))
	<-manager.GetChallengeChannel()

	err := manager.ExpireChallenge(challenge.ID)
	if err != nil {
		t.Fatalf("ExpireChallenge() error = %v", err)
	}

	ch, _ := manager.GetChallenge(challenge.ID)
	if ch.Status != ChallengeStatusExpired {
		t.Errorf("Status = %d, want Expired", ch.Status)
	}

	// Cannot expire already resolved
	err = manager.ExpireChallenge(challenge.ID)
	if err != ErrAlreadyResolved {
		t.Errorf("expected ErrAlreadyResolved, got %v", err)
	}
}

func TestChallengeManager_CleanupExpiredChallenges(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	manager.SetChallengePeriod(time.Millisecond)
	ctx := context.Background()

	// Add challenges
	manager.SubmitChallenge(ctx, [32]byte{1}, "challenger1", "type", []byte("data"), big.NewInt(1e18))
	manager.SubmitChallenge(ctx, [32]byte{2}, "challenger2", "type", []byte("data"), big.NewInt(1e18))
	manager.SubmitChallenge(ctx, [32]byte{3}, "challenger3", "type", []byte("data"), big.NewInt(1e18))

	// Drain channel
	for i := 0; i < 3; i++ {
		<-manager.GetChallengeChannel()
	}

	// Wait for expiration
	time.Sleep(10 * time.Millisecond)

	count := manager.CleanupExpiredChallenges()
	if count != 3 {
		t.Errorf("expected 3 expired challenges, got %d", count)
	}

	active := manager.GetActiveChallenges()
	if len(active) != 0 {
		t.Errorf("expected 0 active challenges after cleanup, got %d", len(active))
	}
}

func TestChallengeManager_HasActiveChallenge(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	requestID := [32]byte{1}

	// Initially no active challenge
	if manager.HasActiveChallenge(requestID) {
		t.Error("expected no active challenge initially")
	}

	// Add challenge
	manager.SubmitChallenge(ctx, requestID, "challenger", "type", []byte("data"), big.NewInt(1e18))
	<-manager.GetChallengeChannel()

	if !manager.HasActiveChallenge(requestID) {
		t.Error("expected active challenge")
	}
}

func TestChallengeStatus_String(t *testing.T) {
	tests := []struct {
		status ChallengeStatus
		want   string
	}{
		{ChallengeStatusPending, "pending"},
		{ChallengeStatusActive, "active"},
		{ChallengeStatusResolved, "resolved"},
		{ChallengeStatusExpired, "expired"},
		{ChallengeStatus(99), "unknown"},
	}

	for _, tt := range tests {
		if got := tt.status.String(); got != tt.want {
			t.Errorf("ChallengeStatus(%d).String() = %s, want %s", tt.status, got, tt.want)
		}
	}
}

func TestChallengeManager_GetChallengeCount(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	if manager.GetChallengeCount() != 0 {
		t.Errorf("expected 0 challenges initially, got %d", manager.GetChallengeCount())
	}

	manager.SubmitChallenge(ctx, [32]byte{1}, "challenger", "type", []byte("data"), big.NewInt(1e18))
	<-manager.GetChallengeChannel()

	if manager.GetChallengeCount() != 1 {
		t.Errorf("expected 1 challenge, got %d", manager.GetChallengeCount())
	}
}

func TestChallengeManager_GetResolution(t *testing.T) {
	manager := NewChallengeManager(config.ContractConfig{})
	ctx := context.Background()

	// No resolution initially
	_, exists := manager.GetResolution(1)
	if exists {
		t.Error("expected no resolution initially")
	}

	challenge, _ := manager.SubmitChallenge(ctx, [32]byte{1}, "challenger", "type", []byte("data"), big.NewInt(1e18))
	<-manager.GetChallengeChannel()

	manager.ResolveChallenge(ctx, challenge.ID, true, "resolver")
	<-manager.GetResolutionChannel()

	resolution, exists := manager.GetResolution(challenge.ID)
	if !exists {
		t.Error("expected resolution to exist")
	}
	if resolution.ChallengeID != challenge.ID {
		t.Errorf("ChallengeID = %d, want %d", resolution.ChallengeID, challenge.ID)
	}
}
