package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"math/rand"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/model"
)

// Error definitions
var (
	ErrAccountNotFound       = fmt.Errorf("account not found")
	ErrAccountFrozen         = fmt.Errorf("account is frozen")
	ErrAccountClosed         = fmt.Errorf("account is closed")
	ErrAccountUnavailable    = fmt.Errorf("account is unavailable")
	ErrInvalidAmount         = fmt.Errorf("invalid amount")
	ErrInsufficientBalance   = fmt.Errorf("insufficient balance")
	ErrVerificationNotFound  = fmt.Errorf("verification not found")
	ErrVerificationExpired   = fmt.Errorf("verification expired")
	ErrMaxAttemptsExceeded   = fmt.Errorf("max attempts exceeded")
	ErrDebitNotFound         = fmt.Errorf("debit request not found")
	ErrDebitInvalidStatus    = fmt.Errorf("invalid status for cancellation")
	ErrAlreadyClosed         = fmt.Errorf("account is already closed")
	ErrBalanceRemaining      = fmt.Errorf("account has remaining balance")
	ErrInvalidDateFormat     = fmt.Errorf("invalid date format, expected YYYY-MM-DD")
)

// BankService handles bank operations
type BankService struct {
	cfg             *config.Config
	accounts        map[string]*model.Account           // accountNo -> Account
	transfers       map[string]*model.Transfer          // transferID -> Transfer
	transactions    map[string]*model.Transaction       // transactionID -> Transaction
	verifications   map[string]*model.Verification      // verificationID -> Verification
	debitRequests   map[string]*model.DebitRequest      // debitRequestID -> DebitRequest
	idempotencyKeys map[string]*model.IdempotencyRecord // idempotencyKey -> IdempotencyRecord
	mu              sync.RWMutex
}

// NewBankService creates a new bank service
func NewBankService(cfg *config.Config) *BankService {
	return &BankService{
		cfg:             cfg,
		accounts:        make(map[string]*model.Account),
		transfers:       make(map[string]*model.Transfer),
		transactions:    make(map[string]*model.Transaction),
		verifications:   make(map[string]*model.Verification),
		debitRequests:   make(map[string]*model.DebitRequest),
		idempotencyKeys: make(map[string]*model.IdempotencyRecord),
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
	log.Printf("Created account: %s (%s)", maskAccountNo(account.AccountNo), maskName(account.Name))

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
	log.Printf("Transfer completed: %s -> %s, Amount: %s", maskAccountNo(req.FromAccountNo), maskAccountNo(req.ToAccountNo), req.Amount)

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

	if account.Status == model.AccountStatusClosed {
		return ErrAccountClosed
	}

	account.Status = model.AccountStatusFrozen
	account.UpdatedAt = time.Now()
	log.Printf("Account frozen: %s", maskAccountNo(accountNo))

	// Create a copy to avoid race condition with webhook goroutine
	accountCopy := *account
	go s.sendWebhook("account.frozen", &accountCopy)
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

	if account.Status == model.AccountStatusClosed {
		return ErrAccountClosed
	}

	if account.Status != model.AccountStatusFrozen {
		return fmt.Errorf("account is not frozen")
	}

	account.Status = model.AccountStatusActive
	account.UpdatedAt = time.Now()
	log.Printf("Account unfrozen: %s", maskAccountNo(accountNo))

	// Create a copy to avoid race condition with webhook goroutine
	accountCopy := *account
	go s.sendWebhook("account.unfrozen", &accountCopy)
	return nil
}

// Deposit deposits funds into an account
func (s *BankService) Deposit(accountNo string, req *model.DepositRequest) (*model.Transaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. 계좌 조회
	account, exists := s.accounts[accountNo]
	if !exists {
		return nil, ErrAccountNotFound
	}

	// 2. 상태 확인
	if account.Status == model.AccountStatusFrozen {
		return nil, ErrAccountFrozen
	}
	if account.Status == model.AccountStatusClosed {
		return nil, ErrAccountClosed
	}

	// 3. 금액 파싱 및 검증
	amount, _, err := big.ParseFloat(req.Amount, 10, 128, big.ToNearestEven)
	if err != nil || amount.Sign() <= 0 {
		return nil, ErrInvalidAmount
	}

	// 4. 잔액 계산
	currentBalance, _, _ := big.ParseFloat(account.Balance, 10, 128, big.ToNearestEven)
	balanceBefore := account.Balance
	newBalance := new(big.Float).Add(currentBalance, amount)
	account.Balance = newBalance.Text('f', 2)
	account.UpdatedAt = time.Now()

	// 5. 트랜잭션 기록
	txn := &model.Transaction{
		ID:            uuid.New().String(),
		AccountNo:     accountNo,
		Type:          model.TransactionTypeDeposit,
		Amount:        req.Amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  account.Balance,
		Reference:     req.Reference,
		Description:   req.Description,
		CreatedAt:     time.Now(),
	}
	s.transactions[txn.ID] = txn

	log.Printf("Deposit completed: %s, Amount: %s, Balance: %s -> %s",
		maskAccountNo(accountNo), req.Amount, balanceBefore, account.Balance)

	// 6. 웹훅 발송
	txnCopy := *txn
	go s.sendWebhook("deposit.completed", &txnCopy)

	return txn, nil
}

// Withdraw withdraws funds from an account
func (s *BankService) Withdraw(accountNo string, req *model.WithdrawRequest) (*model.Transaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. 계좌 조회
	account, exists := s.accounts[accountNo]
	if !exists {
		return nil, ErrAccountNotFound
	}

	// 2. 상태 확인
	if account.Status == model.AccountStatusFrozen {
		return nil, ErrAccountFrozen
	}
	if account.Status == model.AccountStatusClosed {
		return nil, ErrAccountClosed
	}

	// 3. 금액 파싱 및 검증
	amount, _, err := big.ParseFloat(req.Amount, 10, 128, big.ToNearestEven)
	if err != nil || amount.Sign() <= 0 {
		return nil, ErrInvalidAmount
	}

	// 4. 잔액 확인
	currentBalance, _, _ := big.ParseFloat(account.Balance, 10, 128, big.ToNearestEven)
	if currentBalance.Cmp(amount) < 0 {
		return nil, ErrInsufficientBalance
	}

	// 5. 잔액 차감
	balanceBefore := account.Balance
	newBalance := new(big.Float).Sub(currentBalance, amount)
	account.Balance = newBalance.Text('f', 2)
	account.UpdatedAt = time.Now()

	// 6. 트랜잭션 기록
	txn := &model.Transaction{
		ID:            uuid.New().String(),
		AccountNo:     accountNo,
		Type:          model.TransactionTypeWithdraw,
		Amount:        req.Amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  account.Balance,
		Reference:     req.Reference,
		Description:   req.Description,
		CreatedAt:     time.Now(),
	}
	s.transactions[txn.ID] = txn

	log.Printf("Withdraw completed: %s, Amount: %s, Balance: %s -> %s",
		maskAccountNo(accountNo), req.Amount, balanceBefore, account.Balance)

	// 7. 웹훅 발송
	txnCopy := *txn
	go s.sendWebhook("withdraw.completed", &txnCopy)

	return txn, nil
}

// GetTransaction returns a transaction by ID
func (s *BankService) GetTransaction(id string) (*model.Transaction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	txn, exists := s.transactions[id]
	if !exists {
		return nil, fmt.Errorf("transaction not found: %s", id)
	}
	return txn, nil
}

// GetTransactionsByAccount returns all transactions for an account (legacy, returns raw)
func (s *BankService) GetTransactionsByAccount(accountNo string) []*model.Transaction {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var transactions []*model.Transaction
	for _, txn := range s.transactions {
		if txn.AccountNo == accountNo {
			transactions = append(transactions, txn)
		}
	}
	return transactions
}

// QueryTransactions returns filtered, paginated transaction views
func (s *BankService) QueryTransactions(query *model.TransactionQuery) (*model.TransactionListResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Parse date filters
	var fromTime, toTime time.Time
	if query.FromDate != "" {
		parsed, err := time.Parse("2006-01-02", query.FromDate)
		if err != nil {
			return nil, ErrInvalidDateFormat
		}
		fromTime = parsed
	}
	if query.ToDate != "" {
		parsed, err := time.Parse("2006-01-02", query.ToDate)
		if err != nil {
			return nil, ErrInvalidDateFormat
		}
		toTime = parsed.Add(24*time.Hour - time.Nanosecond) // End of day
	}

	// Collect matching transactions
	var filtered []*model.Transaction
	for _, txn := range s.transactions {
		if txn.AccountNo != query.AccountNo {
			continue
		}
		if query.Type != "" && string(txn.Type) != query.Type {
			continue
		}
		if !fromTime.IsZero() && txn.CreatedAt.Before(fromTime) {
			continue
		}
		if !toTime.IsZero() && txn.CreatedAt.After(toTime) {
			continue
		}
		filtered = append(filtered, txn)
	}

	totalCount := len(filtered)

	// Sort by createdAt
	descending := query.Order != "asc"
	sort.Slice(filtered, func(i, j int) bool {
		if descending {
			return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
		}
		return filtered[i].CreatedAt.Before(filtered[j].CreatedAt)
	})

	// Apply cursor-based pagination
	startIndex := 0
	if query.Cursor != "" {
		cursorID, cursorTime := decodeCursor(query.Cursor)
		if cursorID != "" {
			for i, txn := range filtered {
				if descending {
					if txn.CreatedAt.Before(cursorTime) || (txn.CreatedAt.Equal(cursorTime) && txn.ID <= cursorID) {
						startIndex = i
						break
					}
				} else {
					if txn.CreatedAt.After(cursorTime) || (txn.CreatedAt.Equal(cursorTime) && txn.ID >= cursorID) {
						startIndex = i
						break
					}
				}
			}
		}
	}

	// Apply limit
	limit := query.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	endIndex := startIndex + limit
	hasMore := false
	if endIndex < len(filtered) {
		hasMore = true
	}
	if endIndex > len(filtered) {
		endIndex = len(filtered)
	}

	pageItems := filtered[startIndex:endIndex]

	// Convert to TransactionView
	views := make([]*model.TransactionView, 0, len(pageItems))
	for _, txn := range pageItems {
		views = append(views, s.toTransactionView(txn))
	}

	// Build next cursor
	var nextCursor string
	if hasMore && len(pageItems) > 0 {
		last := pageItems[len(pageItems)-1]
		nextCursor = encodeCursor(last.ID, last.CreatedAt)
	}

	return &model.TransactionListResponse{
		Transactions: views,
		Pagination: model.PaginationInfo{
			HasMore:    hasMore,
			NextCursor: nextCursor,
			TotalCount: totalCount,
		},
	}, nil
}

// toTransactionView converts a Transaction to TransactionView with counterparty info
func (s *BankService) toTransactionView(txn *model.Transaction) *model.TransactionView {
	view := &model.TransactionView{
		ID:            txn.ID,
		AccountNo:     txn.AccountNo,
		Type:          txn.Type,
		Amount:        txn.Amount,
		BalanceBefore: txn.BalanceBefore,
		BalanceAfter:  txn.BalanceAfter,
		Reference:     txn.Reference,
		Description:   txn.Description,
		CreatedAt:     txn.CreatedAt,
	}

	// Add counterparty info based on transaction type
	switch txn.Type {
	case model.TransactionTypeTransferIn, model.TransactionTypeTransferOut:
		if cp := s.findTransferCounterparty(txn); cp != nil {
			view.Counterparty = cp
		}
	case model.TransactionTypeDebit:
		if cp := s.findDebitCounterparty(txn); cp != nil {
			view.Counterparty = cp
		}
	}

	return view
}

// findTransferCounterparty finds counterparty info from transfer records
func (s *BankService) findTransferCounterparty(txn *model.Transaction) *model.CounterpartyInfo {
	for _, transfer := range s.transfers {
		if txn.Type == model.TransactionTypeTransferOut && transfer.FromAccountNo == txn.AccountNo {
			if account, exists := s.accounts[transfer.ToAccountNo]; exists {
				return &model.CounterpartyInfo{
					AccountNo: transfer.ToAccountNo,
					Name:      account.Name,
				}
			}
		}
		if txn.Type == model.TransactionTypeTransferIn && transfer.ToAccountNo == txn.AccountNo {
			if account, exists := s.accounts[transfer.FromAccountNo]; exists {
				return &model.CounterpartyInfo{
					AccountNo: transfer.FromAccountNo,
					Name:      account.Name,
				}
			}
		}
	}
	return nil
}

// findDebitCounterparty finds creditor info from debit request records
func (s *BankService) findDebitCounterparty(txn *model.Transaction) *model.CounterpartyInfo {
	for _, debit := range s.debitRequests {
		if debit.TransactionID == txn.ID {
			return &model.CounterpartyInfo{
				CreditorID: debit.CreditorID,
				Name:       debit.CreditorName,
			}
		}
	}
	return nil
}

// encodeCursor encodes a cursor from ID and timestamp
func encodeCursor(id string, t time.Time) string {
	data := fmt.Sprintf("%s|%d", id, t.UnixNano())
	return base64.URLEncoding.EncodeToString([]byte(data))
}

// decodeCursor decodes a cursor into ID and timestamp
func decodeCursor(cursor string) (string, time.Time) {
	data, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return "", time.Time{}
	}

	parts := strings.SplitN(string(data), "|", 2)
	if len(parts) != 2 {
		return "", time.Time{}
	}

	var nanos int64
	for _, c := range parts[1] {
		if c < '0' || c > '9' {
			return "", time.Time{}
		}
		nanos = nanos*10 + int64(c-'0')
	}

	return parts[0], time.Unix(0, nanos)
}

// CloseAccount closes a bank account
func (s *BankService) CloseAccount(accountNo string, req *model.CloseAccountRequest) (*model.CloseAccountResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	account, exists := s.accounts[accountNo]
	if !exists {
		return nil, ErrAccountNotFound
	}

	if account.Status == model.AccountStatusClosed {
		return nil, ErrAlreadyClosed
	}

	// Check balance unless force=true
	if !req.Force {
		balance, _, _ := big.ParseFloat(account.Balance, 10, 128, big.ToNearestEven)
		if balance != nil && balance.Sign() != 0 {
			return nil, ErrBalanceRemaining
		}
	}

	previousStatus := string(account.Status)
	now := time.Now()

	account.Status = model.AccountStatusClosed
	account.ClosedAt = &now
	account.CloseReason = req.Reason
	account.UpdatedAt = now

	log.Printf("Account closed: %s (Reason: %s, Force: %v)", maskAccountNo(accountNo), req.Reason, req.Force)

	resp := &model.CloseAccountResponse{
		AccountNo:      account.AccountNo,
		Status:         string(account.Status),
		PreviousStatus: previousStatus,
		ClosedAt:       now,
		Reason:         req.Reason,
		FinalBalance:   account.Balance,
	}

	accountCopy := *account
	go s.sendWebhook("account.closed", &accountCopy)

	return resp, nil
}

// VerifyAccount verifies account holder name
func (s *BankService) VerifyAccount(req *model.VerifyAccountRequest) (*model.VerifyAccountResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	account, exists := s.accounts[req.AccountNo]
	if !exists {
		return nil, ErrAccountNotFound
	}

	if account.Status != model.AccountStatusActive {
		return nil, ErrAccountUnavailable
	}

	// 이름 비교 (공백 제거 후 비교)
	normalizedInput := strings.ReplaceAll(req.HolderName, " ", "")
	normalizedAccount := strings.ReplaceAll(account.Name, " ", "")

	if normalizedInput == normalizedAccount {
		return &model.VerifyAccountResponse{
			Verified:   true,
			AccountNo:  account.AccountNo,
			MaskedName: maskHolderName(account.Name),
			Status:     string(account.Status),
		}, nil
	}

	return &model.VerifyAccountResponse{
		Verified: false,
		Reason:   "name_mismatch",
	}, nil
}

// InitiateVerification starts a 1-won verification process
func (s *BankService) InitiateVerification(req *model.InitiateVerificationRequest) (*model.InitiateVerificationResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	account, exists := s.accounts[req.AccountNo]
	if !exists {
		return nil, ErrAccountNotFound
	}

	if account.Status != model.AccountStatusActive {
		return nil, ErrAccountUnavailable
	}

	// 4자리 랜덤 코드 생성
	code := fmt.Sprintf("%04d", rand.Intn(10000))

	verification := &model.Verification{
		ID:          uuid.New().String(),
		AccountNo:   req.AccountNo,
		Code:        code,
		Status:      model.VerificationStatusPending,
		Attempts:    0,
		MaxAttempts: 3,
		ExpiresAt:   time.Now().Add(5 * time.Minute),
		CreatedAt:   time.Now(),
	}

	s.verifications[verification.ID] = verification

	// 1원 입금 시뮬레이션 (내부 트랜잭션)
	depositorName := "인증" + code

	log.Printf("Verification initiated: %s, code: %s", maskAccountNo(req.AccountNo), code)

	return &model.InitiateVerificationResponse{
		VerificationID:    verification.ID,
		AccountNo:         req.AccountNo,
		Amount:            "1",
		DepositorName:     depositorName,
		ExpiresAt:         verification.ExpiresAt,
		AttemptsRemaining: verification.MaxAttempts,
	}, nil
}

// CompleteVerification completes a 1-won verification process
func (s *BankService) CompleteVerification(req *model.CompleteVerificationRequest) (*model.CompleteVerificationResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	verification, exists := s.verifications[req.VerificationID]
	if !exists {
		return nil, ErrVerificationNotFound
	}

	// 만료 확인
	if time.Now().After(verification.ExpiresAt) {
		verification.Status = model.VerificationStatusExpired
		return nil, ErrVerificationExpired
	}

	// 시도 횟수 확인
	if verification.Attempts >= verification.MaxAttempts {
		verification.Status = model.VerificationStatusFailed
		return nil, ErrMaxAttemptsExceeded
	}

	verification.Attempts++

	// 코드 확인
	if req.Code == verification.Code {
		verification.Status = model.VerificationStatusVerified
		now := time.Now()
		verification.VerifiedAt = &now

		log.Printf("Verification completed: %s", maskAccountNo(verification.AccountNo))

		return &model.CompleteVerificationResponse{
			Verified:       true,
			VerificationID: verification.ID,
			AccountNo:      verification.AccountNo,
		}, nil
	}

	attemptsRemaining := verification.MaxAttempts - verification.Attempts

	log.Printf("Verification failed attempt: %s, remaining: %d", maskAccountNo(verification.AccountNo), attemptsRemaining)

	return &model.CompleteVerificationResponse{
		Verified:          false,
		VerificationID:    verification.ID,
		Reason:            "invalid_code",
		AttemptsRemaining: attemptsRemaining,
	}, nil
}

// GetVerification returns a verification by ID
func (s *BankService) GetVerification(id string) (*model.Verification, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	verification, exists := s.verifications[id]
	if !exists {
		return nil, ErrVerificationNotFound
	}
	return verification, nil
}

// maskHolderName returns a masked representation of account holder name
// (첫 글자 + * + 마지막 글자, e.g., "홍길동" → "홍*동")
func maskHolderName(name string) string {
	runes := []rune(name)
	if len(runes) <= 1 {
		return name
	}
	if len(runes) == 2 {
		return string(runes[0]) + "*"
	}
	// 첫 글자 + * + 마지막 글자
	masked := string(runes[0])
	for i := 1; i < len(runes)-1; i++ {
		masked += "*"
	}
	masked += string(runes[len(runes)-1])
	return masked
}

// CreateDebitRequest creates a new direct debit request
func (s *BankService) CreateDebitRequest(req *model.CreateDebitRequestInput) (*model.DebitRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 0. 멱등성 키 확인 (중복 요청 방지)
	if existing, exists := s.idempotencyKeys[req.IdempotencyKey]; exists {
		// 24시간 이내의 요청이면 기존 결과 반환
		if time.Since(existing.CreatedAt) < 24*time.Hour {
			return s.debitRequests[existing.DebitRequestID], nil
		}
		// 만료된 키는 삭제
		delete(s.idempotencyKeys, req.IdempotencyKey)
	}

	// 1. 계좌 확인
	account, exists := s.accounts[req.AccountNo]
	if !exists {
		return nil, ErrAccountNotFound
	}

	if account.Status != model.AccountStatusActive {
		return nil, ErrAccountUnavailable
	}

	// 2. 금액 검증
	amount, _, err := big.ParseFloat(req.Amount, 10, 128, big.ToNearestEven)
	if err != nil || amount.Sign() <= 0 {
		return nil, ErrInvalidAmount
	}

	// 3. 요청 생성
	debitReq := &model.DebitRequest{
		ID:             uuid.New().String(),
		IdempotencyKey: req.IdempotencyKey,
		AccountNo:      req.AccountNo,
		Amount:         req.Amount,
		Currency:       req.Currency,
		CreditorID:     req.CreditorID,
		CreditorName:   req.CreditorName,
		Reference:      req.Reference,
		Description:    req.Description,
		WebhookURL:     req.WebhookURL,
		Status:         model.DebitRequestStatusPending,
		AutoApprove:    req.AutoApprove,
		CreatedAt:      time.Now(),
	}

	s.debitRequests[debitReq.ID] = debitReq

	// 4. 멱등성 키 저장
	s.idempotencyKeys[req.IdempotencyKey] = &model.IdempotencyRecord{
		DebitRequestID: debitReq.ID,
		CreatedAt:      time.Now(),
	}

	log.Printf("Debit request created: %s, amount: %s, creditor: %s", debitReq.ID, req.Amount, req.CreditorID)

	// 5. 자동 승인 또는 비동기 처리
	if req.AutoApprove {
		go s.processDebitRequest(debitReq.ID)
	} else {
		// 시뮬레이션: 1-3초 후 처리
		go func() {
			time.Sleep(time.Duration(1+rand.Intn(3)) * time.Second)
			s.processDebitRequest(debitReq.ID)
		}()
	}

	return debitReq, nil
}

// processDebitRequest processes a debit request asynchronously
func (s *BankService) processDebitRequest(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	debitReq, exists := s.debitRequests[id]
	if !exists || debitReq.Status != model.DebitRequestStatusPending {
		return
	}

	debitReq.Status = model.DebitRequestStatusProcessing

	// 계좌 확인
	account, exists := s.accounts[debitReq.AccountNo]
	if !exists {
		s.rejectDebitRequest(debitReq, "account_not_found")
		return
	}

	if account.Status != model.AccountStatusActive {
		s.rejectDebitRequest(debitReq, "account_unavailable")
		return
	}

	// 잔액 확인
	amount, _, _ := big.ParseFloat(debitReq.Amount, 10, 128, big.ToNearestEven)
	balance, _, _ := big.ParseFloat(account.Balance, 10, 128, big.ToNearestEven)

	if balance.Cmp(amount) < 0 {
		s.rejectDebitRequest(debitReq, "insufficient_balance")
		return
	}

	// 출금 실행
	balanceBefore := account.Balance
	newBalance := new(big.Float).Sub(balance, amount)
	account.Balance = newBalance.Text('f', 2)
	account.UpdatedAt = time.Now()

	// 트랜잭션 기록
	txn := &model.Transaction{
		ID:            uuid.New().String(),
		AccountNo:     debitReq.AccountNo,
		Type:          model.TransactionTypeDebit,
		Amount:        debitReq.Amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  account.Balance,
		Reference:     debitReq.Reference,
		Description:   fmt.Sprintf("Direct Debit by %s", debitReq.CreditorName),
		CreatedAt:     time.Now(),
	}
	s.transactions[txn.ID] = txn

	// 요청 완료
	now := time.Now()
	debitReq.Status = model.DebitRequestStatusCompleted
	debitReq.TransactionID = txn.ID
	debitReq.ProcessedAt = &now

	log.Printf("Debit request completed: %s, txnId: %s", debitReq.ID, txn.ID)

	// 웹훅 발송
	debitReqCopy := *debitReq
	go s.sendDebitWebhook("direct_debit.completed", &debitReqCopy)
}

// rejectDebitRequest marks a debit request as rejected
func (s *BankService) rejectDebitRequest(debitReq *model.DebitRequest, reason string) {
	now := time.Now()
	debitReq.Status = model.DebitRequestStatusRejected
	debitReq.FailureReason = reason
	debitReq.ProcessedAt = &now

	log.Printf("Debit request rejected: %s, reason: %s", debitReq.ID, reason)

	debitReqCopy := *debitReq
	go s.sendDebitWebhook("direct_debit.rejected", &debitReqCopy)
}

// sendDebitWebhook sends a webhook for debit request events
func (s *BankService) sendDebitWebhook(eventType string, debitReq *model.DebitRequest) {
	// Use specific webhook URL if provided, otherwise use default
	webhookURL := debitReq.WebhookURL
	if webhookURL == "" {
		webhookURL = s.cfg.WebhookURL
	}

	if webhookURL == "" {
		return
	}

	payload := model.WebhookPayload{
		EventType: eventType,
		Timestamp: time.Now(),
		Data:      debitReq,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal debit webhook payload: %v", err)
		return
	}

	client := &http.Client{Timeout: webhookTimeout}

	req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to create debit webhook request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	signature := computeHMAC(body, s.cfg.WebhookSecret)
	req.Header.Set("X-Webhook-Signature", signature)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Debit webhook failed: %v", err)
		return
	}
	resp.Body.Close()

	log.Printf("Debit webhook sent: %s, status: %d", eventType, resp.StatusCode)
}

// GetDebitRequest returns a debit request by ID
func (s *BankService) GetDebitRequest(id string) (*model.DebitRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	debitReq, exists := s.debitRequests[id]
	if !exists {
		return nil, ErrDebitNotFound
	}
	return debitReq, nil
}

// CancelDebitRequest cancels a pending debit request
func (s *BankService) CancelDebitRequest(id string) (*model.CancelDebitRequestResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	debitReq, exists := s.debitRequests[id]
	if !exists {
		return nil, ErrDebitNotFound
	}

	if debitReq.Status != model.DebitRequestStatusPending {
		return nil, ErrDebitInvalidStatus
	}

	now := time.Now()
	debitReq.Status = model.DebitRequestStatusCancelled
	debitReq.CancelledAt = &now

	log.Printf("Debit request cancelled: %s", id)

	return &model.CancelDebitRequestResponse{
		ID:          debitReq.ID,
		Status:      string(debitReq.Status),
		CancelledAt: debitReq.CancelledAt,
	}, nil
}

// Webhook retry configuration
const (
	webhookMaxRetries     = 3
	webhookInitialBackoff = 1 * time.Second
	webhookMaxBackoff     = 10 * time.Second
	webhookTimeout        = 10 * time.Second
)

// sendWebhook sends a webhook notification with exponential backoff retry
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

	client := &http.Client{Timeout: webhookTimeout}
	backoff := webhookInitialBackoff

	for attempt := 1; attempt <= webhookMaxRetries; attempt++ {
		req, err := http.NewRequest("POST", s.cfg.WebhookURL, bytes.NewBuffer(body))
		if err != nil {
			log.Printf("Failed to create webhook request: %v", err)
			return
		}

		req.Header.Set("Content-Type", "application/json")
		signature := computeHMAC(body, s.cfg.WebhookSecret)
		req.Header.Set("X-Webhook-Signature", signature)

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Webhook attempt %d/%d failed: %v", attempt, webhookMaxRetries, err)
			if attempt < webhookMaxRetries {
				time.Sleep(backoff)
				backoff = min(backoff*2, webhookMaxBackoff)
			}
			continue
		}
		resp.Body.Close()

		// Success on 2xx status codes
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			log.Printf("Webhook sent: %s, status: %d (attempt %d)", eventType, resp.StatusCode, attempt)
			return
		}

		// Retry on 5xx server errors
		if resp.StatusCode >= 500 {
			log.Printf("Webhook attempt %d/%d got server error: %d", attempt, webhookMaxRetries, resp.StatusCode)
			if attempt < webhookMaxRetries {
				time.Sleep(backoff)
				backoff = min(backoff*2, webhookMaxBackoff)
			}
			continue
		}

		// Don't retry on 4xx client errors
		log.Printf("Webhook failed with client error: %d, not retrying", resp.StatusCode)
		return
	}

	log.Printf("Webhook failed after %d attempts: %s", webhookMaxRetries, eventType)
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

// maskAccountNo returns a masked representation of account number for logging
// Shows prefix and last 4 characters (e.g., "BANK****1234")
func maskAccountNo(accountNo string) string {
	if len(accountNo) <= 8 {
		return "****"
	}
	// Show first 4 chars (BANK) and last 4 digits
	return accountNo[:4] + "****" + accountNo[len(accountNo)-4:]
}

// maskName returns a masked representation of account holder name for logging
// Shows first character and asterisks (e.g., "J****")
func maskName(name string) string {
	if len(name) == 0 {
		return "****"
	}
	if len(name) == 1 {
		return name + "****"
	}
	return name[:1] + "****"
}
