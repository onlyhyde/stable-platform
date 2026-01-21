package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/model"
)

// BankService handles bank operations
type BankService struct {
	cfg       *config.Config
	accounts  map[string]*model.Account  // accountNo -> Account
	transfers map[string]*model.Transfer // transferID -> Transfer
	mu        sync.RWMutex
}

// NewBankService creates a new bank service
func NewBankService(cfg *config.Config) *BankService {
	return &BankService{
		cfg:       cfg,
		accounts:  make(map[string]*model.Account),
		transfers: make(map[string]*model.Transfer),
	}
}

// CreateAccount creates a new bank account
func (s *BankService) CreateAccount(req *model.CreateAccountRequest) (*model.Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	balance := req.Balance
	if balance == "" {
		balance = s.cfg.DefaultBalance
	}

	// Validate balance format
	if _, ok := new(big.Float).SetString(balance); !ok {
		return nil, fmt.Errorf("invalid balance format: %s", balance)
	}

	now := time.Now()
	account := &model.Account{
		ID:        uuid.New().String(),
		AccountNo: generateAccountNo(),
		Name:      req.Name,
		Currency:  req.Currency,
		Balance:   balance,
		Status:    model.AccountStatusActive,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.accounts[account.AccountNo] = account
	log.Printf("Created account: %s (%s)", account.AccountNo, account.Name)

	return account, nil
}

// GetAccount returns an account by account number
func (s *BankService) GetAccount(accountNo string) (*model.Account, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	account, exists := s.accounts[accountNo]
	if !exists {
		return nil, fmt.Errorf("account not found: %s", accountNo)
	}
	return account, nil
}

// GetAllAccounts returns all accounts
func (s *BankService) GetAllAccounts() []*model.Account {
	s.mu.RLock()
	defer s.mu.RUnlock()

	accounts := make([]*model.Account, 0, len(s.accounts))
	for _, account := range s.accounts {
		accounts = append(accounts, account)
	}
	return accounts
}

// Transfer executes a transfer between accounts
func (s *BankService) Transfer(req *model.TransferRequest) (*model.Transfer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Validate accounts exist
	fromAccount, exists := s.accounts[req.FromAccountNo]
	if !exists {
		return nil, fmt.Errorf("source account not found: %s", req.FromAccountNo)
	}

	toAccount, exists := s.accounts[req.ToAccountNo]
	if !exists {
		return nil, fmt.Errorf("destination account not found: %s", req.ToAccountNo)
	}

	// Check account status
	if fromAccount.Status != model.AccountStatusActive {
		return nil, fmt.Errorf("source account is not active")
	}
	if toAccount.Status != model.AccountStatusActive {
		return nil, fmt.Errorf("destination account is not active")
	}

	// Parse amounts
	amount, ok := new(big.Float).SetString(req.Amount)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", req.Amount)
	}

	fromBalance, _ := new(big.Float).SetString(fromAccount.Balance)
	toBalance, _ := new(big.Float).SetString(toAccount.Balance)

	// Check sufficient balance
	if fromBalance.Cmp(amount) < 0 {
		return nil, fmt.Errorf("insufficient balance")
	}

	// Execute transfer
	now := time.Now()
	newFromBalance := new(big.Float).Sub(fromBalance, amount)
	newToBalance := new(big.Float).Add(toBalance, amount)

	fromAccount.Balance = newFromBalance.Text('f', 2)
	fromAccount.UpdatedAt = now
	toAccount.Balance = newToBalance.Text('f', 2)
	toAccount.UpdatedAt = now

	transfer := &model.Transfer{
		ID:            uuid.New().String(),
		FromAccountNo: req.FromAccountNo,
		ToAccountNo:   req.ToAccountNo,
		Amount:        req.Amount,
		Currency:      fromAccount.Currency,
		Reference:     req.Reference,
		Status:        model.TransferStatusCompleted,
		CreatedAt:     now,
		CompletedAt:   &now,
	}

	s.transfers[transfer.ID] = transfer
	log.Printf("Transfer completed: %s -> %s, Amount: %s", req.FromAccountNo, req.ToAccountNo, req.Amount)

	// Send webhook notification
	go s.sendWebhook("transfer.completed", transfer)

	return transfer, nil
}

// GetTransfer returns a transfer by ID
func (s *BankService) GetTransfer(id string) (*model.Transfer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	transfer, exists := s.transfers[id]
	if !exists {
		return nil, fmt.Errorf("transfer not found: %s", id)
	}
	return transfer, nil
}

// GetTransfersByAccount returns all transfers for an account
func (s *BankService) GetTransfersByAccount(accountNo string) []*model.Transfer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var transfers []*model.Transfer
	for _, transfer := range s.transfers {
		if transfer.FromAccountNo == accountNo || transfer.ToAccountNo == accountNo {
			transfers = append(transfers, transfer)
		}
	}
	return transfers
}

// FreezeAccount freezes an account
func (s *BankService) FreezeAccount(accountNo string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	account, exists := s.accounts[accountNo]
	if !exists {
		return fmt.Errorf("account not found: %s", accountNo)
	}

	account.Status = model.AccountStatusFrozen
	account.UpdatedAt = time.Now()
	log.Printf("Account frozen: %s", accountNo)

	go s.sendWebhook("account.frozen", account)
	return nil
}

// UnfreezeAccount unfreezes an account
func (s *BankService) UnfreezeAccount(accountNo string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	account, exists := s.accounts[accountNo]
	if !exists {
		return fmt.Errorf("account not found: %s", accountNo)
	}

	if account.Status != model.AccountStatusFrozen {
		return fmt.Errorf("account is not frozen")
	}

	account.Status = model.AccountStatusActive
	account.UpdatedAt = time.Now()
	log.Printf("Account unfrozen: %s", accountNo)

	go s.sendWebhook("account.unfrozen", account)
	return nil
}

// sendWebhook sends a webhook notification
func (s *BankService) sendWebhook(eventType string, data interface{}) {
	if s.cfg.WebhookURL == "" {
		return
	}

	payload := model.WebhookPayload{
		EventType: eventType,
		Timestamp: time.Now(),
		Data:      data,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal webhook payload: %v", err)
		return
	}

	req, err := http.NewRequest("POST", s.cfg.WebhookURL, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to create webhook request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	signature := computeHMAC(body, s.cfg.WebhookSecret)
	req.Header.Set("X-Webhook-Signature", signature)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send webhook: %v", err)
		return
	}
	defer resp.Body.Close()

	log.Printf("Webhook sent: %s, status: %d", eventType, resp.StatusCode)
}

// generateAccountNo generates a random account number
func generateAccountNo() string {
	return fmt.Sprintf("BANK%d", time.Now().UnixNano()%10000000000)
}

// computeHMAC computes HMAC-SHA256 signature
func computeHMAC(data []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}
