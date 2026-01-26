package domain

import (
	"math/big"
	"time"
)

// RequestStatus represents the status of a bridge request
type RequestStatus int

const (
	StatusNone RequestStatus = iota
	StatusPending
	StatusApproved
	StatusChallenged
	StatusExecuted
	StatusRefunded
	StatusCancelled
)

// String returns the string representation of RequestStatus
func (s RequestStatus) String() string {
	switch s {
	case StatusNone:
		return "none"
	case StatusPending:
		return "pending"
	case StatusApproved:
		return "approved"
	case StatusChallenged:
		return "challenged"
	case StatusExecuted:
		return "executed"
	case StatusRefunded:
		return "refunded"
	case StatusCancelled:
		return "cancelled"
	default:
		return "unknown"
	}
}

// FraudProofType represents the type of fraud proof
type FraudProofType int

const (
	FraudProofNone FraudProofType = iota
	FraudProofInvalidSignature
	FraudProofDoubleSpending
	FraudProofInvalidAmount
	FraudProofInvalidToken
	FraudProofReplayAttack
)

// String returns the string representation of FraudProofType
func (f FraudProofType) String() string {
	switch f {
	case FraudProofNone:
		return "none"
	case FraudProofInvalidSignature:
		return "invalid_signature"
	case FraudProofDoubleSpending:
		return "double_spending"
	case FraudProofInvalidAmount:
		return "invalid_amount"
	case FraudProofInvalidToken:
		return "invalid_token"
	case FraudProofReplayAttack:
		return "replay_attack"
	default:
		return "unknown"
	}
}

// BridgeRequest represents a bridge request
type BridgeRequest struct {
	RequestID     [32]byte       `json:"requestId"`
	Sender        string         `json:"sender"`
	Recipient     string         `json:"recipient"`
	Token         string         `json:"token"`
	Amount        *big.Int       `json:"amount"`
	SourceChain   uint64         `json:"sourceChain"`
	TargetChain   uint64         `json:"targetChain"`
	Nonce         uint64         `json:"nonce"`
	Deadline      uint64         `json:"deadline"`
	Fee           *big.Int       `json:"fee"`
	Status        RequestStatus  `json:"status"`
	InitiatedAt   time.Time      `json:"initiatedAt"`
	BlockNumber   uint64         `json:"blockNumber"`
	TxHash        string         `json:"txHash"`
	Signatures    [][]byte       `json:"signatures,omitempty"`
	ChallengeEnd  time.Time      `json:"challengeEnd,omitempty"`
}

// BridgeMessage represents a message to be signed by MPC signers
type BridgeMessage struct {
	RequestID   [32]byte `json:"requestId"`
	Sender      string   `json:"sender"`
	Recipient   string   `json:"recipient"`
	Token       string   `json:"token"`
	Amount      *big.Int `json:"amount"`
	SourceChain uint64   `json:"sourceChain"`
	TargetChain uint64   `json:"targetChain"`
	Nonce       uint64   `json:"nonce"`
	Deadline    uint64   `json:"deadline"`
}

// DepositInfo represents deposit information from the bridge
type DepositInfo struct {
	Sender    string   `json:"sender"`
	Token     string   `json:"token"`
	Amount    *big.Int `json:"amount"`
	Timestamp uint64   `json:"timestamp"`
	Executed  bool     `json:"executed"`
	Refunded  bool     `json:"refunded"`
}

// SignatureRequest represents a request for MPC signature
type SignatureRequest struct {
	Message    BridgeMessage `json:"message"`
	SignerID   int           `json:"signerId"`
	RequestedAt time.Time    `json:"requestedAt"`
}

// SignatureResponse represents a response from MPC signer
type SignatureResponse struct {
	Message   BridgeMessage `json:"message"`
	SignerID  int           `json:"signerId"`
	Signature []byte        `json:"signature"`
	Error     string        `json:"error,omitempty"`
}

// FraudProof represents a fraud proof submission
type FraudProof struct {
	RequestID   [32]byte       `json:"requestId"`
	ProofType   FraudProofType `json:"proofType"`
	MerkleProof [][32]byte     `json:"merkleProof"`
	StateProof  []byte         `json:"stateProof"`
	Evidence    []byte         `json:"evidence"`
}

// ProofRecord represents a fraud proof record
type ProofRecord struct {
	Submitter   string         `json:"submitter"`
	ProofType   FraudProofType `json:"proofType"`
	ProofHash   [32]byte       `json:"proofHash"`
	SubmittedAt time.Time      `json:"submittedAt"`
	Verified    bool           `json:"verified"`
	IsValid     bool           `json:"isValid"`
}

// GuardianProposal represents a guardian proposal
type GuardianProposal struct {
	ID            uint64    `json:"id"`
	ProposalType  string    `json:"proposalType"`
	Proposer      string    `json:"proposer"`
	Target        string    `json:"target"`
	Data          []byte    `json:"data"`
	DataHash      [32]byte  `json:"dataHash"`
	ApprovalCount uint64    `json:"approvalCount"`
	CreatedAt     time.Time `json:"createdAt"`
	ExpiresAt     time.Time `json:"expiresAt"`
	Status        string    `json:"status"`
}

// BridgeEvent represents a bridge event
type BridgeEvent struct {
	EventType   string      `json:"eventType"`
	BlockNumber uint64      `json:"blockNumber"`
	TxHash      string      `json:"txHash"`
	LogIndex    uint        `json:"logIndex"`
	Timestamp   time.Time   `json:"timestamp"`
	Data        interface{} `json:"data"`
}

// BridgeInitiatedEvent represents a BridgeInitiated event
type BridgeInitiatedEvent struct {
	RequestID   [32]byte `json:"requestId"`
	Sender      string   `json:"sender"`
	Recipient   string   `json:"recipient"`
	Token       string   `json:"token"`
	Amount      *big.Int `json:"amount"`
	SourceChain uint64   `json:"sourceChain"`
	TargetChain uint64   `json:"targetChain"`
	Fee         *big.Int `json:"fee"`
}

// BridgeCompletedEvent represents a BridgeCompleted event
type BridgeCompletedEvent struct {
	RequestID [32]byte `json:"requestId"`
	Recipient string   `json:"recipient"`
	Token     string   `json:"token"`
	Amount    *big.Int `json:"amount"`
}

// RequestApprovedEvent represents a RequestApproved event
type RequestApprovedEvent struct {
	RequestID [32]byte  `json:"requestId"`
	Timestamp time.Time `json:"timestamp"`
}

// RequestChallengedEvent represents a RequestChallenged event
type RequestChallengedEvent struct {
	RequestID  [32]byte `json:"requestId"`
	Challenger string   `json:"challenger"`
	BondAmount *big.Int `json:"bondAmount"`
	Reason     string   `json:"reason"`
}

// ChallengeResolvedEvent represents a ChallengeResolved event
type ChallengeResolvedEvent struct {
	RequestID          [32]byte `json:"requestId"`
	ChallengeSuccess   bool     `json:"challengeSuccessful"`
	Challenger         string   `json:"challenger"`
	Reward             *big.Int `json:"reward"`
}

// EmergencyPauseEvent represents an EmergencyPause event
type EmergencyPauseEvent struct {
	Guardian string `json:"guardian"`
	Reason   string `json:"reason"`
}

// RateLimitStatus represents the current rate limit status
type RateLimitStatus struct {
	HourlyUsage    *big.Int `json:"hourlyUsage"`
	DailyUsage     *big.Int `json:"dailyUsage"`
	HourlyLimit    *big.Int `json:"hourlyLimit"`
	DailyLimit     *big.Int `json:"dailyLimit"`
	UsagePercent   float64  `json:"usagePercent"`
	AlertTriggered bool     `json:"alertTriggered"`
	IsPaused       bool     `json:"isPaused"`
}

// RelayerStatus represents the status of the relayer
type RelayerStatus struct {
	IsHealthy          bool              `json:"isHealthy"`
	IsPaused           bool              `json:"isPaused"`
	SourceChainSynced  bool              `json:"sourceChainSynced"`
	TargetChainSynced  bool              `json:"targetChainSynced"`
	LastProcessedBlock uint64            `json:"lastProcessedBlock"`
	PendingRequests    int               `json:"pendingRequests"`
	ProcessedRequests  int               `json:"processedRequests"`
	FailedRequests     int               `json:"failedRequests"`
	RateLimitStatus    RateLimitStatus   `json:"rateLimitStatus"`
	MPCSignersOnline   int               `json:"mpcSignersOnline"`
	LastUpdated        time.Time         `json:"lastUpdated"`
}
