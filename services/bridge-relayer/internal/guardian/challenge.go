package guardian

import (
	"context"
	"errors"
	"math/big"
	"sync"
	"time"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
)

var (
	ErrChallengeNotFound    = errors.New("challenge not found")
	ErrChallengeExpired     = errors.New("challenge period expired")
	ErrChallengeExists      = errors.New("challenge already exists")
	ErrInvalidChallenger    = errors.New("invalid challenger")
	ErrInsufficientStake    = errors.New("insufficient stake")
	ErrAlreadyResolved      = errors.New("challenge already resolved")
)

// ChallengeStatus represents the status of a challenge
type ChallengeStatus int

const (
	ChallengeStatusPending ChallengeStatus = iota
	ChallengeStatusActive
	ChallengeStatusResolved
	ChallengeStatusExpired
)

// String returns string representation of ChallengeStatus
func (s ChallengeStatus) String() string {
	switch s {
	case ChallengeStatusPending:
		return "pending"
	case ChallengeStatusActive:
		return "active"
	case ChallengeStatusResolved:
		return "resolved"
	case ChallengeStatusExpired:
		return "expired"
	default:
		return "unknown"
	}
}

// Challenge represents a challenge to a bridge transaction
type Challenge struct {
	ID            uint64           `json:"id"`
	RequestID     [32]byte         `json:"requestId"`
	Challenger    string           `json:"challenger"`
	ChallengeType string           `json:"challengeType"`
	Evidence      []byte           `json:"evidence"`
	StakeAmount   *big.Int         `json:"stakeAmount"`
	Status        ChallengeStatus  `json:"status"`
	CreatedAt     time.Time        `json:"createdAt"`
	ExpiresAt     time.Time        `json:"expiresAt"`
	ResolvedAt    time.Time        `json:"resolvedAt,omitempty"`
	Resolution    string           `json:"resolution,omitempty"`
	WinnerAddress string           `json:"winnerAddress,omitempty"`
}

// ChallengeResolution represents the result of a challenge
type ChallengeResolution struct {
	ChallengeID    uint64    `json:"challengeId"`
	RequestID      [32]byte  `json:"requestId"`
	IsValid        bool      `json:"isValid"`
	Winner         string    `json:"winner"`
	SlashedAmount  *big.Int  `json:"slashedAmount"`
	RewardAmount   *big.Int  `json:"rewardAmount"`
	ResolvedAt     time.Time `json:"resolvedAt"`
	ResolvedBy     string    `json:"resolvedBy"`
}

// ChallengeManager manages the challenge process for bridge transactions
type ChallengeManager struct {
	cfg config.ContractConfig

	mu               sync.RWMutex
	challenges       map[uint64]*Challenge
	challengesByReq  map[[32]byte][]uint64
	resolutions      map[uint64]*ChallengeResolution
	nextChallengeID  uint64

	// Configuration
	challengePeriod  time.Duration
	minStakeAmount   *big.Int
	slashPercentage  uint8

	// Channels
	challengeChan   chan *Challenge
	resolutionChan  chan *ChallengeResolution
}

// NewChallengeManager creates a new challenge manager
func NewChallengeManager(cfg config.ContractConfig) *ChallengeManager {
	return &ChallengeManager{
		cfg:              cfg,
		challenges:       make(map[uint64]*Challenge),
		challengesByReq:  make(map[[32]byte][]uint64),
		resolutions:      make(map[uint64]*ChallengeResolution),
		nextChallengeID:  1,
		challengePeriod:  24 * time.Hour,
		minStakeAmount:   big.NewInt(1e17), // 0.1 ETH
		slashPercentage:  50,
		challengeChan:    make(chan *Challenge, 100),
		resolutionChan:   make(chan *ChallengeResolution, 100),
	}
}

// SetChallengePeriod sets the challenge period
func (m *ChallengeManager) SetChallengePeriod(period time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.challengePeriod = period
}

// GetChallengePeriod returns the challenge period
func (m *ChallengeManager) GetChallengePeriod() time.Duration {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.challengePeriod
}

// SetMinStakeAmount sets the minimum stake required to challenge
func (m *ChallengeManager) SetMinStakeAmount(amount *big.Int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.minStakeAmount = new(big.Int).Set(amount)
}

// GetMinStakeAmount returns the minimum stake amount
func (m *ChallengeManager) GetMinStakeAmount() *big.Int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return new(big.Int).Set(m.minStakeAmount)
}

// SubmitChallenge submits a new challenge
func (m *ChallengeManager) SubmitChallenge(ctx context.Context, requestID [32]byte, challenger string, challengeType string, evidence []byte, stakeAmount *big.Int) (*Challenge, error) {
	if challenger == "" {
		return nil, ErrInvalidChallenger
	}

	if stakeAmount == nil || stakeAmount.Cmp(m.minStakeAmount) < 0 {
		return nil, ErrInsufficientStake
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if active challenge already exists for this request
	existingIDs := m.challengesByReq[requestID]
	for _, id := range existingIDs {
		if ch := m.challenges[id]; ch != nil && ch.Status == ChallengeStatusActive {
			return nil, ErrChallengeExists
		}
	}

	challenge := &Challenge{
		ID:            m.nextChallengeID,
		RequestID:     requestID,
		Challenger:    challenger,
		ChallengeType: challengeType,
		Evidence:      evidence,
		StakeAmount:   new(big.Int).Set(stakeAmount),
		Status:        ChallengeStatusActive,
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(m.challengePeriod),
	}

	m.challenges[challenge.ID] = challenge
	m.challengesByReq[requestID] = append(m.challengesByReq[requestID], challenge.ID)
	m.nextChallengeID++

	// Notify listeners
	select {
	case m.challengeChan <- challenge:
	default:
	}

	return challenge, nil
}

// ResolveChallenge resolves an active challenge
func (m *ChallengeManager) ResolveChallenge(ctx context.Context, challengeID uint64, isValid bool, resolvedBy string) (*ChallengeResolution, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	challenge, exists := m.challenges[challengeID]
	if !exists {
		return nil, ErrChallengeNotFound
	}

	if challenge.Status == ChallengeStatusResolved {
		return nil, ErrAlreadyResolved
	}

	if time.Now().After(challenge.ExpiresAt) {
		challenge.Status = ChallengeStatusExpired
		return nil, ErrChallengeExpired
	}

	// Calculate rewards/slashing
	var winner string
	var slashedAmount, rewardAmount *big.Int

	if isValid {
		// Challenger wins
		winner = challenge.Challenger
		slashedAmount = big.NewInt(0) // Operator gets slashed
		rewardAmount = new(big.Int).Set(challenge.StakeAmount)
	} else {
		// Challenger loses
		winner = "" // Original request stands
		slashedAmount = new(big.Int).Mul(challenge.StakeAmount, big.NewInt(int64(m.slashPercentage)))
		slashedAmount.Div(slashedAmount, big.NewInt(100))
		rewardAmount = big.NewInt(0)
	}

	// Update challenge status
	challenge.Status = ChallengeStatusResolved
	challenge.ResolvedAt = time.Now()
	challenge.Resolution = func() string {
		if isValid {
			return "challenger_wins"
		}
		return "challenger_loses"
	}()
	challenge.WinnerAddress = winner

	// Create resolution record
	resolution := &ChallengeResolution{
		ChallengeID:   challengeID,
		RequestID:     challenge.RequestID,
		IsValid:       isValid,
		Winner:        winner,
		SlashedAmount: slashedAmount,
		RewardAmount:  rewardAmount,
		ResolvedAt:    time.Now(),
		ResolvedBy:    resolvedBy,
	}

	m.resolutions[challengeID] = resolution

	// Notify listeners
	select {
	case m.resolutionChan <- resolution:
	default:
	}

	return resolution, nil
}

// GetChallenge returns a challenge by ID
func (m *ChallengeManager) GetChallenge(challengeID uint64) (*Challenge, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ch, exists := m.challenges[challengeID]
	return ch, exists
}

// GetChallengesByRequest returns all challenges for a request
func (m *ChallengeManager) GetChallengesByRequest(requestID [32]byte) []*Challenge {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := m.challengesByReq[requestID]
	challenges := make([]*Challenge, 0, len(ids))
	for _, id := range ids {
		if ch := m.challenges[id]; ch != nil {
			challenges = append(challenges, ch)
		}
	}
	return challenges
}

// GetActiveChallenges returns all active challenges
func (m *ChallengeManager) GetActiveChallenges() []*Challenge {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var active []*Challenge
	now := time.Now()
	for _, ch := range m.challenges {
		if ch.Status == ChallengeStatusActive && now.Before(ch.ExpiresAt) {
			active = append(active, ch)
		}
	}
	return active
}

// GetResolution returns the resolution for a challenge
func (m *ChallengeManager) GetResolution(challengeID uint64) (*ChallengeResolution, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res, exists := m.resolutions[challengeID]
	return res, exists
}

// ExpireChallenge marks a challenge as expired
func (m *ChallengeManager) ExpireChallenge(challengeID uint64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	challenge, exists := m.challenges[challengeID]
	if !exists {
		return ErrChallengeNotFound
	}

	if challenge.Status != ChallengeStatusActive {
		return ErrAlreadyResolved
	}

	challenge.Status = ChallengeStatusExpired
	return nil
}

// CleanupExpiredChallenges marks expired challenges
func (m *ChallengeManager) CleanupExpiredChallenges() int {
	m.mu.Lock()
	defer m.mu.Unlock()

	count := 0
	now := time.Now()
	for _, ch := range m.challenges {
		if ch.Status == ChallengeStatusActive && now.After(ch.ExpiresAt) {
			ch.Status = ChallengeStatusExpired
			count++
		}
	}
	return count
}

// GetChallengeChannel returns the challenge event channel
func (m *ChallengeManager) GetChallengeChannel() <-chan *Challenge {
	return m.challengeChan
}

// GetResolutionChannel returns the resolution event channel
func (m *ChallengeManager) GetResolutionChannel() <-chan *ChallengeResolution {
	return m.resolutionChan
}

// GetChallengeCount returns the total number of challenges
func (m *ChallengeManager) GetChallengeCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.challenges)
}

// HasActiveChallenge checks if a request has an active challenge
func (m *ChallengeManager) HasActiveChallenge(requestID [32]byte) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := m.challengesByReq[requestID]
	now := time.Now()
	for _, id := range ids {
		if ch := m.challenges[id]; ch != nil {
			if ch.Status == ChallengeStatusActive && now.Before(ch.ExpiresAt) {
				return true
			}
		}
	}
	return false
}
