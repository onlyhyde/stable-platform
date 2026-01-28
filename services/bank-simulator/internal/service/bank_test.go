package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/model"
)

func newTestConfig() *config.Config {
	return &config.Config{
		Port:           "4350",
		WebhookURL:     "",
		WebhookSecret:  "test-secret",
		DefaultBalance: "10000.00",
	}
}

func newTestService() *BankService {
	return NewBankService(newTestConfig())
}

func createTestAccount(t *testing.T, svc *BankService, name, currency, balance string) *model.Account {
	t.Helper()
	req := &model.CreateAccountRequest{
		Name:     name,
		Currency: currency,
		Balance:  balance,
	}
	acc, err := svc.CreateAccount(req)
	if err != nil {
		t.Fatalf("createTestAccount() error: %v", err)
	}
	return acc
}

// --- NewBankService ---

func TestNewBankService(t *testing.T) {
	cfg := newTestConfig()
	svc := NewBankService(cfg)
	if svc == nil {
		t.Fatal("NewBankService() returned nil")
	}
	if svc.cfg != cfg {
		t.Error("cfg not set correctly")
	}
	if svc.accounts == nil {
		t.Error("accounts map is nil")
	}
	if svc.transfers == nil {
		t.Error("transfers map is nil")
	}
}

// --- CreateAccount ---

func TestCreateAccount_DefaultBalance(t *testing.T) {
	svc := newTestService()

	acc, err := svc.CreateAccount(&model.CreateAccountRequest{
		Name:     "Alice",
		Currency: "USD",
	})
	if err != nil {
		t.Fatalf("CreateAccount() error = %v", err)
	}
	if acc.Balance != "10000.00" {
		t.Errorf("Balance = %q, want %q", acc.Balance, "10000.00")
	}
	if acc.Status != model.AccountStatusActive {
		t.Errorf("Status = %q, want %q", acc.Status, model.AccountStatusActive)
	}
	if acc.Name != "Alice" {
		t.Errorf("Name = %q, want %q", acc.Name, "Alice")
	}
	if acc.Currency != "USD" {
		t.Errorf("Currency = %q, want %q", acc.Currency, "USD")
	}
	if acc.ID == "" {
		t.Error("ID is empty")
	}
	if acc.AccountNo == "" {
		t.Error("AccountNo is empty")
	}
	if acc.CreatedAt.IsZero() {
		t.Error("CreatedAt is zero")
	}
}

func TestCreateAccount_CustomBalance(t *testing.T) {
	svc := newTestService()

	acc, err := svc.CreateAccount(&model.CreateAccountRequest{
		Name:     "Bob",
		Currency: "EUR",
		Balance:  "5000.50",
	})
	if err != nil {
		t.Fatalf("CreateAccount() error = %v", err)
	}
	if acc.Balance != "5000.50" {
		t.Errorf("Balance = %q, want %q", acc.Balance, "5000.50")
	}
}

func TestCreateAccount_InvalidBalanceFormat(t *testing.T) {
	svc := newTestService()

	_, err := svc.CreateAccount(&model.CreateAccountRequest{
		Name:     "Bad",
		Currency: "USD",
		Balance:  "not-a-number",
	})
	if err == nil {
		t.Fatal("CreateAccount() error = nil, want error for invalid balance")
	}
	if !strings.Contains(err.Error(), "invalid balance format") {
		t.Errorf("error = %q, want to contain 'invalid balance format'", err.Error())
	}
}

func TestCreateAccount_ZeroBalance(t *testing.T) {
	svc := newTestService()

	acc, err := svc.CreateAccount(&model.CreateAccountRequest{
		Name:     "Zero",
		Currency: "USD",
		Balance:  "0.00",
	})
	if err != nil {
		t.Fatalf("CreateAccount() error = %v", err)
	}
	if acc.Balance != "0.00" {
		t.Errorf("Balance = %q, want %q", acc.Balance, "0.00")
	}
}

func TestCreateAccount_UniqueAccountNumbers(t *testing.T) {
	svc := newTestService()

	acc1 := createTestAccount(t, svc, "A1", "USD", "100.00")
	// Small sleep to ensure different timestamp-based account numbers
	time.Sleep(time.Millisecond)
	acc2 := createTestAccount(t, svc, "A2", "USD", "100.00")

	if acc1.AccountNo == acc2.AccountNo {
		t.Errorf("account numbers should be unique: %q == %q", acc1.AccountNo, acc2.AccountNo)
	}
	if acc1.ID == acc2.ID {
		t.Errorf("IDs should be unique: %q == %q", acc1.ID, acc2.ID)
	}
}

// --- GetAccount ---

func TestGetAccount_Exists(t *testing.T) {
	svc := newTestService()
	created := createTestAccount(t, svc, "Test", "USD", "1000.00")

	got, err := svc.GetAccount(created.AccountNo)
	if err != nil {
		t.Fatalf("GetAccount() error = %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
	if got.Name != "Test" {
		t.Errorf("Name = %q, want %q", got.Name, "Test")
	}
}

func TestGetAccount_NotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.GetAccount("NONEXISTENT")
	if err == nil {
		t.Fatal("GetAccount() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("error = %q, want to contain 'not found'", err.Error())
	}
}

// --- GetAllAccounts ---

func TestGetAllAccounts_Empty(t *testing.T) {
	svc := newTestService()

	accounts := svc.GetAllAccounts()
	if len(accounts) != 0 {
		t.Errorf("len = %d, want 0", len(accounts))
	}
}

func TestGetAllAccounts_Multiple(t *testing.T) {
	svc := newTestService()
	createTestAccount(t, svc, "A", "USD", "100.00")
	time.Sleep(time.Millisecond)
	createTestAccount(t, svc, "B", "EUR", "200.00")
	time.Sleep(time.Millisecond)
	createTestAccount(t, svc, "C", "GBP", "300.00")

	accounts := svc.GetAllAccounts()
	if len(accounts) != 3 {
		t.Errorf("len = %d, want 3", len(accounts))
	}
}

// --- Transfer ---

func TestTransfer_Success(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "From", "USD", "1000.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "To", "USD", "500.00")

	transfer, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "200.00",
		Reference:     "test-ref",
	})
	if err != nil {
		t.Fatalf("Transfer() error = %v", err)
	}

	if transfer.Status != model.TransferStatusCompleted {
		t.Errorf("Status = %q, want %q", transfer.Status, model.TransferStatusCompleted)
	}
	if transfer.Amount != "200.00" {
		t.Errorf("Amount = %q, want %q", transfer.Amount, "200.00")
	}
	if transfer.Reference != "test-ref" {
		t.Errorf("Reference = %q, want %q", transfer.Reference, "test-ref")
	}
	if transfer.CompletedAt == nil {
		t.Error("CompletedAt is nil")
	}

	// Verify balances
	fromAcc, _ := svc.GetAccount(from.AccountNo)
	toAcc, _ := svc.GetAccount(to.AccountNo)

	if fromAcc.Balance != "800.00" {
		t.Errorf("from Balance = %q, want %q", fromAcc.Balance, "800.00")
	}
	if toAcc.Balance != "700.00" {
		t.Errorf("to Balance = %q, want %q", toAcc.Balance, "700.00")
	}
}

func TestTransfer_InsufficientBalance(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "Poor", "USD", "50.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "Rich", "USD", "10000.00")

	_, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "100.00",
	})
	if err == nil {
		t.Fatal("Transfer() error = nil, want error for insufficient balance")
	}
	if !strings.Contains(err.Error(), "insufficient balance") {
		t.Errorf("error = %q, want to contain 'insufficient balance'", err.Error())
	}

	// Verify balances unchanged
	fromAcc, _ := svc.GetAccount(from.AccountNo)
	if fromAcc.Balance != "50.00" {
		t.Errorf("from Balance = %q, want unchanged %q", fromAcc.Balance, "50.00")
	}
}

func TestTransfer_SourceNotFound(t *testing.T) {
	svc := newTestService()
	to := createTestAccount(t, svc, "To", "USD", "500.00")

	_, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: "NONEXISTENT",
		ToAccountNo:   to.AccountNo,
		Amount:        "100.00",
	})
	if err == nil {
		t.Fatal("Transfer() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "source account not found") {
		t.Errorf("error = %q, want to contain 'source account not found'", err.Error())
	}
}

func TestTransfer_DestinationNotFound(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "From", "USD", "500.00")

	_, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   "NONEXISTENT",
		Amount:        "100.00",
	})
	if err == nil {
		t.Fatal("Transfer() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "destination account not found") {
		t.Errorf("error = %q, want to contain 'destination account not found'", err.Error())
	}
}

func TestTransfer_FrozenSourceAccount(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "Frozen", "USD", "1000.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "Active", "USD", "500.00")

	if err := svc.FreezeAccount(from.AccountNo); err != nil {
		t.Fatalf("FreezeAccount() error: %v", err)
	}
	// Wait for webhook goroutine to not interfere
	time.Sleep(10 * time.Millisecond)

	_, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "100.00",
	})
	if err == nil {
		t.Fatal("Transfer() error = nil, want error for frozen source")
	}
	if !strings.Contains(err.Error(), "not active") {
		t.Errorf("error = %q, want to contain 'not active'", err.Error())
	}
}

func TestTransfer_FrozenDestinationAccount(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "Active", "USD", "1000.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "Frozen", "USD", "500.00")

	if err := svc.FreezeAccount(to.AccountNo); err != nil {
		t.Fatalf("FreezeAccount() error: %v", err)
	}
	time.Sleep(10 * time.Millisecond)

	_, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "100.00",
	})
	if err == nil {
		t.Fatal("Transfer() error = nil, want error for frozen destination")
	}
	if !strings.Contains(err.Error(), "not active") {
		t.Errorf("error = %q, want to contain 'not active'", err.Error())
	}
}

func TestTransfer_InvalidAmount(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "From", "USD", "1000.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "To", "USD", "500.00")

	_, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "abc",
	})
	if err == nil {
		t.Fatal("Transfer() error = nil, want error for invalid amount")
	}
	if !strings.Contains(err.Error(), "invalid amount") {
		t.Errorf("error = %q, want to contain 'invalid amount'", err.Error())
	}
}

func TestTransfer_BigFloatPrecision(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "Precise", "USD", "100.10")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "Target", "USD", "0.00")

	_, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "0.10",
	})
	if err != nil {
		t.Fatalf("Transfer() error = %v", err)
	}

	fromAcc, _ := svc.GetAccount(from.AccountNo)
	toAcc, _ := svc.GetAccount(to.AccountNo)

	// Verify big.Float precision: 100.10 - 0.10 = 100.00
	if fromAcc.Balance != "100.00" {
		t.Errorf("from Balance = %q, want %q", fromAcc.Balance, "100.00")
	}
	if toAcc.Balance != "0.10" {
		t.Errorf("to Balance = %q, want %q", toAcc.Balance, "0.10")
	}
}

func TestTransfer_ExactBalance(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "Exact", "USD", "500.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "Target", "USD", "0.00")

	_, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "500.00",
	})
	if err != nil {
		t.Fatalf("Transfer() error = %v", err)
	}

	fromAcc, _ := svc.GetAccount(from.AccountNo)
	if fromAcc.Balance != "0.00" {
		t.Errorf("from Balance = %q, want %q", fromAcc.Balance, "0.00")
	}
}

func TestTransfer_SetsCorrectCurrency(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "From", "EUR", "1000.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "To", "EUR", "500.00")

	transfer, err := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "100.00",
	})
	if err != nil {
		t.Fatalf("Transfer() error = %v", err)
	}
	if transfer.Currency != "EUR" {
		t.Errorf("Currency = %q, want %q", transfer.Currency, "EUR")
	}
}

// --- GetTransfer ---

func TestGetTransfer_Exists(t *testing.T) {
	svc := newTestService()
	from := createTestAccount(t, svc, "A", "USD", "1000.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "B", "USD", "500.00")

	created, _ := svc.Transfer(&model.TransferRequest{
		FromAccountNo: from.AccountNo,
		ToAccountNo:   to.AccountNo,
		Amount:        "100.00",
	})

	got, err := svc.GetTransfer(created.ID)
	if err != nil {
		t.Fatalf("GetTransfer() error = %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
}

func TestGetTransfer_NotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.GetTransfer("nonexistent-id")
	if err == nil {
		t.Fatal("GetTransfer() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("error = %q, want to contain 'not found'", err.Error())
	}
}

// --- GetTransfersByAccount ---

func TestGetTransfersByAccount(t *testing.T) {
	svc := newTestService()
	a := createTestAccount(t, svc, "A", "USD", "5000.00")
	time.Sleep(time.Millisecond)
	b := createTestAccount(t, svc, "B", "USD", "5000.00")
	time.Sleep(time.Millisecond)
	c := createTestAccount(t, svc, "C", "USD", "5000.00")

	// A -> B
	svc.Transfer(&model.TransferRequest{
		FromAccountNo: a.AccountNo,
		ToAccountNo:   b.AccountNo,
		Amount:        "100.00",
	})
	// B -> C
	svc.Transfer(&model.TransferRequest{
		FromAccountNo: b.AccountNo,
		ToAccountNo:   c.AccountNo,
		Amount:        "50.00",
	})
	// A -> C
	svc.Transfer(&model.TransferRequest{
		FromAccountNo: a.AccountNo,
		ToAccountNo:   c.AccountNo,
		Amount:        "25.00",
	})

	// A involved in 2 transfers (as source)
	// plus C->A = 0 so A = 2
	aTransfers := svc.GetTransfersByAccount(a.AccountNo)
	if len(aTransfers) != 2 {
		t.Errorf("A transfers = %d, want 2", len(aTransfers))
	}

	// B involved in 2 (as destination and source)
	bTransfers := svc.GetTransfersByAccount(b.AccountNo)
	if len(bTransfers) != 2 {
		t.Errorf("B transfers = %d, want 2", len(bTransfers))
	}

	// C involved in 2 (as destination for both)
	cTransfers := svc.GetTransfersByAccount(c.AccountNo)
	if len(cTransfers) != 2 {
		t.Errorf("C transfers = %d, want 2", len(cTransfers))
	}

	// Unknown account returns nil/empty
	unknown := svc.GetTransfersByAccount("UNKNOWN")
	if len(unknown) != 0 {
		t.Errorf("unknown transfers = %d, want 0", len(unknown))
	}
}

// --- FreezeAccount ---

func TestFreezeAccount_Success(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Freezable", "USD", "1000.00")

	if err := svc.FreezeAccount(acc.AccountNo); err != nil {
		t.Fatalf("FreezeAccount() error = %v", err)
	}
	time.Sleep(10 * time.Millisecond) // let webhook goroutine complete

	got, _ := svc.GetAccount(acc.AccountNo)
	if got.Status != model.AccountStatusFrozen {
		t.Errorf("Status = %q, want %q", got.Status, model.AccountStatusFrozen)
	}
}

func TestFreezeAccount_NotFound(t *testing.T) {
	svc := newTestService()

	err := svc.FreezeAccount("NONEXISTENT")
	if err == nil {
		t.Fatal("FreezeAccount() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("error = %q, want to contain 'not found'", err.Error())
	}
}

// --- UnfreezeAccount ---

func TestUnfreezeAccount_Success(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "ToUnfreeze", "USD", "1000.00")

	svc.FreezeAccount(acc.AccountNo)
	time.Sleep(10 * time.Millisecond)

	if err := svc.UnfreezeAccount(acc.AccountNo); err != nil {
		t.Fatalf("UnfreezeAccount() error = %v", err)
	}
	time.Sleep(10 * time.Millisecond)

	got, _ := svc.GetAccount(acc.AccountNo)
	if got.Status != model.AccountStatusActive {
		t.Errorf("Status = %q, want %q", got.Status, model.AccountStatusActive)
	}
}

func TestUnfreezeAccount_NotFound(t *testing.T) {
	svc := newTestService()

	err := svc.UnfreezeAccount("NONEXISTENT")
	if err == nil {
		t.Fatal("UnfreezeAccount() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("error = %q, want to contain 'not found'", err.Error())
	}
}

func TestUnfreezeAccount_NotFrozen(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Active", "USD", "1000.00")

	err := svc.UnfreezeAccount(acc.AccountNo)
	if err == nil {
		t.Fatal("UnfreezeAccount() error = nil, want error for non-frozen account")
	}
	if !strings.Contains(err.Error(), "not frozen") {
		t.Errorf("error = %q, want to contain 'not frozen'", err.Error())
	}
}

// --- Helper functions ---

func TestMaskAccountNo(t *testing.T) {
	tests := []struct {
		name      string
		accountNo string
		want      string
	}{
		{"Normal account", "BANK1234567890", "BANK****7890"},
		{"Exactly 9 chars", "BANK12345", "BANK****2345"},
		{"Short (8 chars)", "BANK1234", "****"},
		{"Shorter", "BANK", "****"},
		{"Empty", "", "****"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskAccountNo(tt.accountNo)
			if got != tt.want {
				t.Errorf("maskAccountNo(%q) = %q, want %q", tt.accountNo, got, tt.want)
			}
		})
	}
}

func TestMaskName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		want     string
	}{
		{"Normal name", "Alice", "A****"},
		{"Two chars", "Al", "A****"},
		{"Single char", "A", "A****"},
		{"Empty", "", "****"},
		{"Long name", "Alexander", "A****"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskName(tt.input)
			if got != tt.want {
				t.Errorf("maskName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestComputeHMAC(t *testing.T) {
	tests := []struct {
		name   string
		data   []byte
		secret string
	}{
		{"Normal payload", []byte(`{"event":"transfer.completed"}`), "secret-key"},
		{"Empty data", []byte(""), "secret-key"},
		{"Empty secret", []byte(`{"event":"test"}`), ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sig := computeHMAC(tt.data, tt.secret)
			if sig == "" {
				t.Error("computeHMAC() returned empty string")
			}
			// HMAC-SHA256 produces 64 hex characters
			if len(sig) != 64 {
				t.Errorf("length = %d, want 64", len(sig))
			}
			// Must be deterministic
			sig2 := computeHMAC(tt.data, tt.secret)
			if sig != sig2 {
				t.Errorf("not deterministic: %q != %q", sig, sig2)
			}
		})
	}
}

func TestComputeHMAC_DifferentSecrets(t *testing.T) {
	data := []byte(`{"event":"transfer.completed"}`)

	sig1 := computeHMAC(data, "secret-1")
	sig2 := computeHMAC(data, "secret-2")
	if sig1 == sig2 {
		t.Error("different secrets produced same signature")
	}
}

func TestComputeHMAC_DifferentData(t *testing.T) {
	sig1 := computeHMAC([]byte("data-a"), "same-secret")
	sig2 := computeHMAC([]byte("data-b"), "same-secret")
	if sig1 == sig2 {
		t.Error("different data produced same signature")
	}
}

func TestGenerateAccountNo(t *testing.T) {
	no := generateAccountNo()

	if !strings.HasPrefix(no, "BANK") {
		t.Errorf("generateAccountNo() = %q, want BANK prefix", no)
	}

	// Should be BANK followed by digits
	numPart := no[4:]
	for _, c := range numPart {
		if c < '0' || c > '9' {
			t.Errorf("generateAccountNo() contains non-digit after prefix: %q", no)
			break
		}
	}
}

func TestGenerateAccountNo_Uniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 10; i++ {
		no := generateAccountNo()
		if seen[no] {
			t.Errorf("duplicate account number: %q", no)
		}
		seen[no] = true
		time.Sleep(time.Millisecond)
	}
}

// --- Webhook tests ---

func TestSendWebhook_EmptyURL(t *testing.T) {
	svc := newTestService()
	// WebhookURL is empty by default in test config

	// Should not panic or error - just silently return
	svc.sendWebhook("transfer.completed", map[string]string{"id": "test"})
}

func TestSendWebhook_Success(t *testing.T) {
	var received bool
	var receivedBody []byte
	var receivedSig string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received = true
		receivedBody, _ = io.ReadAll(r.Body)
		receivedSig = r.Header.Get("X-Webhook-Signature")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := newTestConfig()
	cfg.WebhookURL = server.URL
	svc := NewBankService(cfg)

	svc.sendWebhook("transfer.completed", map[string]string{"id": "t1"})

	if !received {
		t.Fatal("webhook was not received")
	}
	if len(receivedBody) == 0 {
		t.Error("webhook body is empty")
	}

	// Verify the payload structure
	var payload model.WebhookPayload
	if err := json.Unmarshal(receivedBody, &payload); err != nil {
		t.Fatalf("failed to unmarshal webhook payload: %v", err)
	}
	if payload.EventType != "transfer.completed" {
		t.Errorf("EventType = %q, want %q", payload.EventType, "transfer.completed")
	}

	// Verify HMAC signature
	if receivedSig == "" {
		t.Error("X-Webhook-Signature header is empty")
	}
	expectedSig := computeHMAC(receivedBody, "test-secret")
	if receivedSig != expectedSig {
		t.Errorf("signature = %q, want %q", receivedSig, expectedSig)
	}
}

func TestSendWebhook_ServerErrorRetries(t *testing.T) {
	attempts := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := newTestConfig()
	cfg.WebhookURL = server.URL
	svc := NewBankService(cfg)

	svc.sendWebhook("test.retry", map[string]string{})

	if attempts != 3 {
		t.Errorf("attempts = %d, want 3 (retries on 5xx)", attempts)
	}
}

func TestSendWebhook_ClientErrorNoRetry(t *testing.T) {
	attempts := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	cfg := newTestConfig()
	cfg.WebhookURL = server.URL
	svc := NewBankService(cfg)

	svc.sendWebhook("test.noretry", map[string]string{})

	if attempts != 1 {
		t.Errorf("attempts = %d, want 1 (no retry on 4xx)", attempts)
	}
}

func TestSendWebhook_HMACSignature(t *testing.T) {
	var receivedBody []byte
	var receivedSig string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedBody, _ = io.ReadAll(r.Body)
		receivedSig = r.Header.Get("X-Webhook-Signature")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	secret := "my-webhook-secret"
	cfg := newTestConfig()
	cfg.WebhookURL = server.URL
	cfg.WebhookSecret = secret
	svc := NewBankService(cfg)

	svc.sendWebhook("account.frozen", map[string]string{"accountNo": "BANK123"})

	// Manually compute expected HMAC
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(receivedBody)
	expected := hex.EncodeToString(h.Sum(nil))

	if receivedSig != expected {
		t.Errorf("HMAC signature mismatch: got %q, want %q", receivedSig, expected)
	}
}

// --- Concurrency tests ---

func TestConcurrent_CreateAccount(t *testing.T) {
	svc := newTestService()

	var wg sync.WaitGroup
	count := 50
	results := make(chan *model.Account, count)
	errs := make(chan error, count)

	for i := 0; i < count; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			acc, err := svc.CreateAccount(&model.CreateAccountRequest{
				Name:     "User",
				Currency: "USD",
				Balance:  "100.00",
			})
			if err != nil {
				errs <- err
				return
			}
			results <- acc
		}(i)
	}

	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		t.Errorf("concurrent CreateAccount error: %v", err)
	}

	accounts := make(map[string]bool)
	for acc := range results {
		if accounts[acc.AccountNo] {
			t.Errorf("duplicate account number in concurrent creation: %s", acc.AccountNo)
		}
		accounts[acc.AccountNo] = true
	}

	all := svc.GetAllAccounts()
	if len(all) != count {
		t.Errorf("total accounts = %d, want %d", len(all), count)
	}
}

// --- Deposit ---

func TestDeposit_Success(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Depositor", "USD", "1000.00")

	txn, err := svc.Deposit(acc.AccountNo, &model.DepositRequest{
		Amount:      "500.00",
		Reference:   "deposit-ref",
		Description: "Test deposit",
	})
	if err != nil {
		t.Fatalf("Deposit() error = %v", err)
	}

	if txn.Type != model.TransactionTypeDeposit {
		t.Errorf("Type = %q, want %q", txn.Type, model.TransactionTypeDeposit)
	}
	if txn.Amount != "500.00" {
		t.Errorf("Amount = %q, want %q", txn.Amount, "500.00")
	}
	if txn.BalanceBefore != "1000.00" {
		t.Errorf("BalanceBefore = %q, want %q", txn.BalanceBefore, "1000.00")
	}
	if txn.BalanceAfter != "1500.00" {
		t.Errorf("BalanceAfter = %q, want %q", txn.BalanceAfter, "1500.00")
	}
	if txn.Reference != "deposit-ref" {
		t.Errorf("Reference = %q, want %q", txn.Reference, "deposit-ref")
	}
	if txn.Description != "Test deposit" {
		t.Errorf("Description = %q, want %q", txn.Description, "Test deposit")
	}

	// Verify account balance updated
	updatedAcc, _ := svc.GetAccount(acc.AccountNo)
	if updatedAcc.Balance != "1500.00" {
		t.Errorf("Account balance = %q, want %q", updatedAcc.Balance, "1500.00")
	}
}

func TestDeposit_AccountNotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.Deposit("NONEXISTENT", &model.DepositRequest{
		Amount: "100.00",
	})
	if err != ErrAccountNotFound {
		t.Errorf("Deposit() error = %v, want ErrAccountNotFound", err)
	}
}

func TestDeposit_FrozenAccount(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Frozen", "USD", "1000.00")

	if err := svc.FreezeAccount(acc.AccountNo); err != nil {
		t.Fatalf("FreezeAccount() error: %v", err)
	}
	time.Sleep(10 * time.Millisecond)

	_, err := svc.Deposit(acc.AccountNo, &model.DepositRequest{
		Amount: "100.00",
	})
	if err != ErrAccountFrozen {
		t.Errorf("Deposit() error = %v, want ErrAccountFrozen", err)
	}
}

func TestDeposit_InvalidAmount(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Test", "USD", "1000.00")

	tests := []struct {
		name   string
		amount string
	}{
		{"non-numeric", "abc"},
		{"zero", "0.00"},
		{"negative", "-100.00"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.Deposit(acc.AccountNo, &model.DepositRequest{
				Amount: tt.amount,
			})
			if err != ErrInvalidAmount {
				t.Errorf("Deposit(%q) error = %v, want ErrInvalidAmount", tt.amount, err)
			}
		})
	}
}

func TestDeposit_BigFloatPrecision(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Precise", "USD", "0.10")

	_, err := svc.Deposit(acc.AccountNo, &model.DepositRequest{
		Amount: "0.20",
	})
	if err != nil {
		t.Fatalf("Deposit() error = %v", err)
	}

	updatedAcc, _ := svc.GetAccount(acc.AccountNo)
	if updatedAcc.Balance != "0.30" {
		t.Errorf("Balance = %q, want %q (precision issue)", updatedAcc.Balance, "0.30")
	}
}

// --- Withdraw ---

func TestWithdraw_Success(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Withdrawer", "USD", "1000.00")

	txn, err := svc.Withdraw(acc.AccountNo, &model.WithdrawRequest{
		Amount:      "300.00",
		Reference:   "withdraw-ref",
		Description: "Test withdrawal",
	})
	if err != nil {
		t.Fatalf("Withdraw() error = %v", err)
	}

	if txn.Type != model.TransactionTypeWithdraw {
		t.Errorf("Type = %q, want %q", txn.Type, model.TransactionTypeWithdraw)
	}
	if txn.Amount != "300.00" {
		t.Errorf("Amount = %q, want %q", txn.Amount, "300.00")
	}
	if txn.BalanceBefore != "1000.00" {
		t.Errorf("BalanceBefore = %q, want %q", txn.BalanceBefore, "1000.00")
	}
	if txn.BalanceAfter != "700.00" {
		t.Errorf("BalanceAfter = %q, want %q", txn.BalanceAfter, "700.00")
	}

	// Verify account balance updated
	updatedAcc, _ := svc.GetAccount(acc.AccountNo)
	if updatedAcc.Balance != "700.00" {
		t.Errorf("Account balance = %q, want %q", updatedAcc.Balance, "700.00")
	}
}

func TestWithdraw_AccountNotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.Withdraw("NONEXISTENT", &model.WithdrawRequest{
		Amount: "100.00",
	})
	if err != ErrAccountNotFound {
		t.Errorf("Withdraw() error = %v, want ErrAccountNotFound", err)
	}
}

func TestWithdraw_FrozenAccount(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Frozen", "USD", "1000.00")

	if err := svc.FreezeAccount(acc.AccountNo); err != nil {
		t.Fatalf("FreezeAccount() error: %v", err)
	}
	time.Sleep(10 * time.Millisecond)

	_, err := svc.Withdraw(acc.AccountNo, &model.WithdrawRequest{
		Amount: "100.00",
	})
	if err != ErrAccountFrozen {
		t.Errorf("Withdraw() error = %v, want ErrAccountFrozen", err)
	}
}

func TestWithdraw_InsufficientBalance(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Poor", "USD", "100.00")

	_, err := svc.Withdraw(acc.AccountNo, &model.WithdrawRequest{
		Amount: "500.00",
	})
	if err != ErrInsufficientBalance {
		t.Errorf("Withdraw() error = %v, want ErrInsufficientBalance", err)
	}

	// Verify balance unchanged
	updatedAcc, _ := svc.GetAccount(acc.AccountNo)
	if updatedAcc.Balance != "100.00" {
		t.Errorf("Balance = %q, want unchanged %q", updatedAcc.Balance, "100.00")
	}
}

func TestWithdraw_InvalidAmount(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Test", "USD", "1000.00")

	tests := []struct {
		name   string
		amount string
	}{
		{"non-numeric", "xyz"},
		{"zero", "0"},
		{"negative", "-50.00"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.Withdraw(acc.AccountNo, &model.WithdrawRequest{
				Amount: tt.amount,
			})
			if err != ErrInvalidAmount {
				t.Errorf("Withdraw(%q) error = %v, want ErrInvalidAmount", tt.amount, err)
			}
		})
	}
}

func TestWithdraw_ExactBalance(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Exact", "USD", "500.00")

	txn, err := svc.Withdraw(acc.AccountNo, &model.WithdrawRequest{
		Amount: "500.00",
	})
	if err != nil {
		t.Fatalf("Withdraw() error = %v", err)
	}
	if txn.BalanceAfter != "0.00" {
		t.Errorf("BalanceAfter = %q, want %q", txn.BalanceAfter, "0.00")
	}

	updatedAcc, _ := svc.GetAccount(acc.AccountNo)
	if updatedAcc.Balance != "0.00" {
		t.Errorf("Balance = %q, want %q", updatedAcc.Balance, "0.00")
	}
}

// --- GetTransaction ---

func TestGetTransaction_Exists(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "Test", "USD", "1000.00")

	created, _ := svc.Deposit(acc.AccountNo, &model.DepositRequest{Amount: "100.00"})
	time.Sleep(10 * time.Millisecond) // let webhook complete

	got, err := svc.GetTransaction(created.ID)
	if err != nil {
		t.Fatalf("GetTransaction() error = %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
	if got.Amount != "100.00" {
		t.Errorf("Amount = %q, want %q", got.Amount, "100.00")
	}
}

func TestGetTransaction_NotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.GetTransaction("nonexistent-txn-id")
	if err == nil {
		t.Fatal("GetTransaction() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("error = %q, want to contain 'not found'", err.Error())
	}
}

// --- GetTransactionsByAccount ---

func TestGetTransactionsByAccount(t *testing.T) {
	svc := newTestService()
	acc1 := createTestAccount(t, svc, "Acc1", "USD", "1000.00")
	time.Sleep(time.Millisecond)
	acc2 := createTestAccount(t, svc, "Acc2", "USD", "1000.00")

	// acc1: 2 deposits, 1 withdraw
	svc.Deposit(acc1.AccountNo, &model.DepositRequest{Amount: "100.00"})
	time.Sleep(10 * time.Millisecond)
	svc.Deposit(acc1.AccountNo, &model.DepositRequest{Amount: "200.00"})
	time.Sleep(10 * time.Millisecond)
	svc.Withdraw(acc1.AccountNo, &model.WithdrawRequest{Amount: "50.00"})
	time.Sleep(10 * time.Millisecond)

	// acc2: 1 deposit
	svc.Deposit(acc2.AccountNo, &model.DepositRequest{Amount: "300.00"})
	time.Sleep(10 * time.Millisecond)

	acc1Txns := svc.GetTransactionsByAccount(acc1.AccountNo)
	if len(acc1Txns) != 3 {
		t.Errorf("acc1 transactions = %d, want 3", len(acc1Txns))
	}

	acc2Txns := svc.GetTransactionsByAccount(acc2.AccountNo)
	if len(acc2Txns) != 1 {
		t.Errorf("acc2 transactions = %d, want 1", len(acc2Txns))
	}

	// Unknown account
	unknownTxns := svc.GetTransactionsByAccount("UNKNOWN")
	if len(unknownTxns) != 0 {
		t.Errorf("unknown transactions = %d, want 0", len(unknownTxns))
	}
}

// --- Concurrent Deposit/Withdraw ---

func TestConcurrent_Deposit(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "ConcurrentDeposit", "USD", "0.00")

	var wg sync.WaitGroup
	count := 100

	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			svc.Deposit(acc.AccountNo, &model.DepositRequest{Amount: "10.00"})
		}()
	}

	wg.Wait()
	time.Sleep(50 * time.Millisecond) // allow webhooks

	updatedAcc, _ := svc.GetAccount(acc.AccountNo)
	expectedBalance := new(big.Float).SetFloat64(float64(count) * 10)
	actualBalance, _ := new(big.Float).SetString(updatedAcc.Balance)

	if actualBalance.Cmp(expectedBalance) != 0 {
		t.Errorf("Balance = %s, want %s", updatedAcc.Balance, expectedBalance.Text('f', 2))
	}
}

func TestConcurrent_Withdraw(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "ConcurrentWithdraw", "USD", "1000.00")

	var wg sync.WaitGroup
	var mu sync.Mutex
	successCount := 0
	count := 100

	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.Withdraw(acc.AccountNo, &model.WithdrawRequest{Amount: "50.00"})
			if err == nil {
				mu.Lock()
				successCount++
				mu.Unlock()
			}
		}()
	}

	wg.Wait()
	time.Sleep(50 * time.Millisecond)

	// Only 20 withdrawals should succeed (1000/50 = 20)
	if successCount != 20 {
		t.Errorf("successCount = %d, want 20 (only 20 x 50 can be withdrawn from 1000)", successCount)
	}

	updatedAcc, _ := svc.GetAccount(acc.AccountNo)
	if updatedAcc.Balance != "0.00" {
		t.Errorf("Balance = %q, want %q", updatedAcc.Balance, "0.00")
	}
}

func TestConcurrent_Transfer(t *testing.T) {
	svc := newTestService()

	// Create accounts with specific balance
	from := createTestAccount(t, svc, "From", "USD", "10000.00")
	time.Sleep(time.Millisecond)
	to := createTestAccount(t, svc, "To", "USD", "0.00")

	var wg sync.WaitGroup
	count := 100
	errs := make(chan error, count)

	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.Transfer(&model.TransferRequest{
				FromAccountNo: from.AccountNo,
				ToAccountNo:   to.AccountNo,
				Amount:        "100.00",
			})
			if err != nil {
				errs <- err
			}
		}()
	}

	wg.Wait()
	close(errs)

	// Count successes
	errCount := 0
	for range errs {
		errCount++
	}
	successCount := count - errCount

	// From started with 10000, each transfer costs 100
	// Maximum 100 transfers can succeed
	fromAcc, _ := svc.GetAccount(from.AccountNo)
	toAcc, _ := svc.GetAccount(to.AccountNo)

	expectedFromBalance := new(big.Float).SetFloat64(10000 - float64(successCount)*100)
	expectedToBalance := new(big.Float).SetFloat64(float64(successCount) * 100)

	actualFrom, _ := new(big.Float).SetString(fromAcc.Balance)
	actualTo, _ := new(big.Float).SetString(toAcc.Balance)

	if actualFrom.Cmp(expectedFromBalance) != 0 {
		t.Errorf("from Balance = %s, want %s", fromAcc.Balance, expectedFromBalance.Text('f', 2))
	}
	if actualTo.Cmp(expectedToBalance) != 0 {
		t.Errorf("to Balance = %s, want %s", toAcc.Balance, expectedToBalance.Text('f', 2))
	}

	// Verify sum conservation: from + to = 10000
	sum := new(big.Float).Add(actualFrom, actualTo)
	expected := new(big.Float).SetFloat64(10000)
	if sum.Cmp(expected) != 0 {
		t.Errorf("balance sum = %s, want 10000.00", sum.Text('f', 2))
	}
}

// --- VerifyAccount ---

func TestVerifyAccount_Match(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	resp, err := svc.VerifyAccount(&model.VerifyAccountRequest{
		AccountNo:  acc.AccountNo,
		HolderName: "홍길동",
	})
	if err != nil {
		t.Fatalf("VerifyAccount() error = %v", err)
	}
	if !resp.Verified {
		t.Error("Verified = false, want true")
	}
	if resp.AccountNo != acc.AccountNo {
		t.Errorf("AccountNo = %q, want %q", resp.AccountNo, acc.AccountNo)
	}
	if resp.MaskedName != "홍*동" {
		t.Errorf("MaskedName = %q, want %q", resp.MaskedName, "홍*동")
	}
	if resp.Status != "active" {
		t.Errorf("Status = %q, want %q", resp.Status, "active")
	}
}

func TestVerifyAccount_MatchWithSpaces(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍 길 동", "KRW", "1000.00")

	resp, err := svc.VerifyAccount(&model.VerifyAccountRequest{
		AccountNo:  acc.AccountNo,
		HolderName: "홍길동",
	})
	if err != nil {
		t.Fatalf("VerifyAccount() error = %v", err)
	}
	if !resp.Verified {
		t.Error("Verified = false, want true (should match ignoring spaces)")
	}
}

func TestVerifyAccount_Mismatch(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	resp, err := svc.VerifyAccount(&model.VerifyAccountRequest{
		AccountNo:  acc.AccountNo,
		HolderName: "김철수",
	})
	if err != nil {
		t.Fatalf("VerifyAccount() error = %v", err)
	}
	if resp.Verified {
		t.Error("Verified = true, want false")
	}
	if resp.Reason != "name_mismatch" {
		t.Errorf("Reason = %q, want %q", resp.Reason, "name_mismatch")
	}
}

func TestVerifyAccount_AccountNotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.VerifyAccount(&model.VerifyAccountRequest{
		AccountNo:  "BANK0000000000",
		HolderName: "홍길동",
	})
	if err != ErrAccountNotFound {
		t.Errorf("VerifyAccount() error = %v, want ErrAccountNotFound", err)
	}
}

func TestVerifyAccount_FrozenAccount(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	if err := svc.FreezeAccount(acc.AccountNo); err != nil {
		t.Fatalf("FreezeAccount() error: %v", err)
	}
	time.Sleep(10 * time.Millisecond)

	_, err := svc.VerifyAccount(&model.VerifyAccountRequest{
		AccountNo:  acc.AccountNo,
		HolderName: "홍길동",
	})
	if err != ErrAccountUnavailable {
		t.Errorf("VerifyAccount() error = %v, want ErrAccountUnavailable", err)
	}
}

// --- InitiateVerification ---

func TestInitiateVerification_Success(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	resp, err := svc.InitiateVerification(&model.InitiateVerificationRequest{
		AccountNo: acc.AccountNo,
	})
	if err != nil {
		t.Fatalf("InitiateVerification() error = %v", err)
	}

	if resp.VerificationID == "" {
		t.Error("VerificationID is empty")
	}
	if resp.AccountNo != acc.AccountNo {
		t.Errorf("AccountNo = %q, want %q", resp.AccountNo, acc.AccountNo)
	}
	if resp.Amount != "1" {
		t.Errorf("Amount = %q, want %q", resp.Amount, "1")
	}
	if !strings.HasPrefix(resp.DepositorName, "인증") {
		t.Errorf("DepositorName = %q, want prefix '인증'", resp.DepositorName)
	}
	if resp.AttemptsRemaining != 3 {
		t.Errorf("AttemptsRemaining = %d, want 3", resp.AttemptsRemaining)
	}
	if resp.ExpiresAt.Before(time.Now()) {
		t.Error("ExpiresAt should be in the future")
	}
}

func TestInitiateVerification_AccountNotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.InitiateVerification(&model.InitiateVerificationRequest{
		AccountNo: "BANK0000000000",
	})
	if err != ErrAccountNotFound {
		t.Errorf("InitiateVerification() error = %v, want ErrAccountNotFound", err)
	}
}

func TestInitiateVerification_FrozenAccount(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	if err := svc.FreezeAccount(acc.AccountNo); err != nil {
		t.Fatalf("FreezeAccount() error: %v", err)
	}
	time.Sleep(10 * time.Millisecond)

	_, err := svc.InitiateVerification(&model.InitiateVerificationRequest{
		AccountNo: acc.AccountNo,
	})
	if err != ErrAccountUnavailable {
		t.Errorf("InitiateVerification() error = %v, want ErrAccountUnavailable", err)
	}
}

// --- CompleteVerification ---

func TestCompleteVerification_Success(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	// Initiate verification
	initResp, _ := svc.InitiateVerification(&model.InitiateVerificationRequest{
		AccountNo: acc.AccountNo,
	})

	// Get the verification to find the code
	verification, _ := svc.GetVerification(initResp.VerificationID)

	// Complete with correct code
	resp, err := svc.CompleteVerification(&model.CompleteVerificationRequest{
		VerificationID: initResp.VerificationID,
		Code:           verification.Code,
	})
	if err != nil {
		t.Fatalf("CompleteVerification() error = %v", err)
	}

	if !resp.Verified {
		t.Error("Verified = false, want true")
	}
	if resp.VerificationID != initResp.VerificationID {
		t.Errorf("VerificationID = %q, want %q", resp.VerificationID, initResp.VerificationID)
	}
	if resp.AccountNo != acc.AccountNo {
		t.Errorf("AccountNo = %q, want %q", resp.AccountNo, acc.AccountNo)
	}
}

func TestCompleteVerification_InvalidCode(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	// Initiate verification
	initResp, _ := svc.InitiateVerification(&model.InitiateVerificationRequest{
		AccountNo: acc.AccountNo,
	})

	// Complete with wrong code
	resp, err := svc.CompleteVerification(&model.CompleteVerificationRequest{
		VerificationID: initResp.VerificationID,
		Code:           "0000", // Wrong code
	})
	if err != nil {
		t.Fatalf("CompleteVerification() error = %v", err)
	}

	if resp.Verified {
		t.Error("Verified = true, want false")
	}
	if resp.Reason != "invalid_code" {
		t.Errorf("Reason = %q, want %q", resp.Reason, "invalid_code")
	}
	if resp.AttemptsRemaining != 2 {
		t.Errorf("AttemptsRemaining = %d, want 2", resp.AttemptsRemaining)
	}
}

func TestCompleteVerification_MaxAttempts(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	// Initiate verification
	initResp, _ := svc.InitiateVerification(&model.InitiateVerificationRequest{
		AccountNo: acc.AccountNo,
	})

	// Try 3 times with wrong code
	for i := 0; i < 3; i++ {
		svc.CompleteVerification(&model.CompleteVerificationRequest{
			VerificationID: initResp.VerificationID,
			Code:           "0000",
		})
	}

	// 4th attempt should fail with max attempts exceeded
	_, err := svc.CompleteVerification(&model.CompleteVerificationRequest{
		VerificationID: initResp.VerificationID,
		Code:           "0000",
	})
	if err != ErrMaxAttemptsExceeded {
		t.Errorf("CompleteVerification() error = %v, want ErrMaxAttemptsExceeded", err)
	}
}

func TestCompleteVerification_NotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.CompleteVerification(&model.CompleteVerificationRequest{
		VerificationID: "nonexistent-id",
		Code:           "1234",
	})
	if err != ErrVerificationNotFound {
		t.Errorf("CompleteVerification() error = %v, want ErrVerificationNotFound", err)
	}
}

func TestCompleteVerification_Expired(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	// Initiate verification
	initResp, _ := svc.InitiateVerification(&model.InitiateVerificationRequest{
		AccountNo: acc.AccountNo,
	})

	// Manually expire the verification
	verification, _ := svc.GetVerification(initResp.VerificationID)
	svc.mu.Lock()
	verification.ExpiresAt = time.Now().Add(-1 * time.Minute)
	svc.mu.Unlock()

	// Try to complete
	_, err := svc.CompleteVerification(&model.CompleteVerificationRequest{
		VerificationID: initResp.VerificationID,
		Code:           verification.Code,
	})
	if err != ErrVerificationExpired {
		t.Errorf("CompleteVerification() error = %v, want ErrVerificationExpired", err)
	}
}

// --- maskHolderName ---

func TestMaskHolderName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"three chars", "홍길동", "홍*동"},
		{"two chars", "홍길", "홍*"},
		{"one char", "홍", "홍"},
		{"empty", "", ""},
		{"four chars", "김영수철", "김**철"},
		{"english", "Alice", "A***e"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskHolderName(tt.input)
			if got != tt.expected {
				t.Errorf("maskHolderName(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

// --- CreateDebitRequest ---

func TestCreateDebitRequest_Success(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	req := &model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      acc.AccountNo,
		Amount:         "50000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
		Reference:      "ORDER_123",
		Description:    "상품 결제",
		AutoApprove:    false,
	}

	resp, err := svc.CreateDebitRequest(req)
	if err != nil {
		t.Fatalf("CreateDebitRequest() error = %v", err)
	}

	if resp.ID == "" {
		t.Error("ID is empty")
	}
	if resp.Status != model.DebitRequestStatusPending {
		t.Errorf("Status = %q, want %q", resp.Status, model.DebitRequestStatusPending)
	}
	if resp.Amount != "50000.00" {
		t.Errorf("Amount = %q, want %q", resp.Amount, "50000.00")
	}
	if resp.CreditorID != "PG_001" {
		t.Errorf("CreditorID = %q, want %q", resp.CreditorID, "PG_001")
	}
}

func TestCreateDebitRequest_AutoApprove(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	req := &model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      acc.AccountNo,
		Amount:         "50000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
		AutoApprove:    true,
	}

	resp, err := svc.CreateDebitRequest(req)
	if err != nil {
		t.Fatalf("CreateDebitRequest() error = %v", err)
	}

	// Wait for async processing
	time.Sleep(100 * time.Millisecond)

	// Get updated status
	updated, _ := svc.GetDebitRequest(resp.ID)
	if updated.Status != model.DebitRequestStatusCompleted {
		t.Errorf("Status = %q, want %q (auto-approve)", updated.Status, model.DebitRequestStatusCompleted)
	}
	if updated.TransactionID == "" {
		t.Error("TransactionID should be set after completion")
	}

	// Verify account balance deducted
	updatedAcc, _ := svc.GetAccount(acc.AccountNo)
	if updatedAcc.Balance != "50000.00" {
		t.Errorf("Balance = %q, want %q", updatedAcc.Balance, "50000.00")
	}
}

func TestCreateDebitRequest_Idempotency(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	idempotencyKey := "idem_" + uuid.New().String()
	req := &model.CreateDebitRequestInput{
		IdempotencyKey: idempotencyKey,
		AccountNo:      acc.AccountNo,
		Amount:         "10000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
		AutoApprove:    false,
	}

	// First request
	resp1, err := svc.CreateDebitRequest(req)
	if err != nil {
		t.Fatalf("First CreateDebitRequest() error = %v", err)
	}

	// Second request with same idempotency key
	resp2, err := svc.CreateDebitRequest(req)
	if err != nil {
		t.Fatalf("Second CreateDebitRequest() error = %v", err)
	}

	// Should return same debit request
	if resp1.ID != resp2.ID {
		t.Errorf("Idempotency failed: got different IDs %q and %q", resp1.ID, resp2.ID)
	}
}

func TestCreateDebitRequest_AccountNotFound(t *testing.T) {
	svc := newTestService()

	req := &model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      "BANK0000000000",
		Amount:         "10000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
	}

	_, err := svc.CreateDebitRequest(req)
	if err != ErrAccountNotFound {
		t.Errorf("CreateDebitRequest() error = %v, want ErrAccountNotFound", err)
	}
}

func TestCreateDebitRequest_FrozenAccount(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	if err := svc.FreezeAccount(acc.AccountNo); err != nil {
		t.Fatalf("FreezeAccount() error: %v", err)
	}
	time.Sleep(10 * time.Millisecond)

	req := &model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      acc.AccountNo,
		Amount:         "10000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
	}

	_, err := svc.CreateDebitRequest(req)
	if err != ErrAccountUnavailable {
		t.Errorf("CreateDebitRequest() error = %v, want ErrAccountUnavailable", err)
	}
}

func TestCreateDebitRequest_InvalidAmount(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	tests := []struct {
		name   string
		amount string
	}{
		{"non-numeric", "abc"},
		{"zero", "0"},
		{"negative", "-1000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &model.CreateDebitRequestInput{
				IdempotencyKey: "idem_" + uuid.New().String(),
				AccountNo:      acc.AccountNo,
				Amount:         tt.amount,
				Currency:       "KRW",
				CreditorID:     "PG_001",
				CreditorName:   "온라인쇼핑몰",
			}

			_, err := svc.CreateDebitRequest(req)
			if err != ErrInvalidAmount {
				t.Errorf("CreateDebitRequest(%q) error = %v, want ErrInvalidAmount", tt.amount, err)
			}
		})
	}
}

func TestCreateDebitRequest_InsufficientBalance(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "1000.00")

	req := &model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      acc.AccountNo,
		Amount:         "50000.00", // More than balance
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
		AutoApprove:    true,
	}

	resp, err := svc.CreateDebitRequest(req)
	if err != nil {
		t.Fatalf("CreateDebitRequest() error = %v", err)
	}

	// Wait for async processing
	time.Sleep(100 * time.Millisecond)

	// Check status
	updated, _ := svc.GetDebitRequest(resp.ID)
	if updated.Status != model.DebitRequestStatusRejected {
		t.Errorf("Status = %q, want %q", updated.Status, model.DebitRequestStatusRejected)
	}
	if updated.FailureReason != "insufficient_balance" {
		t.Errorf("FailureReason = %q, want %q", updated.FailureReason, "insufficient_balance")
	}
}

// --- GetDebitRequest ---

func TestGetDebitRequest_Exists(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	created, _ := svc.CreateDebitRequest(&model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      acc.AccountNo,
		Amount:         "10000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
	})

	got, err := svc.GetDebitRequest(created.ID)
	if err != nil {
		t.Fatalf("GetDebitRequest() error = %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
}

func TestGetDebitRequest_NotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.GetDebitRequest("nonexistent-id")
	if err != ErrDebitNotFound {
		t.Errorf("GetDebitRequest() error = %v, want ErrDebitNotFound", err)
	}
}

// --- CancelDebitRequest ---

func TestCancelDebitRequest_Success(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	// Create a pending request (no auto-approve)
	created, _ := svc.CreateDebitRequest(&model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      acc.AccountNo,
		Amount:         "10000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
		AutoApprove:    false,
	})

	// Cancel immediately
	resp, err := svc.CancelDebitRequest(created.ID)
	if err != nil {
		t.Fatalf("CancelDebitRequest() error = %v", err)
	}

	if resp.Status != string(model.DebitRequestStatusCancelled) {
		t.Errorf("Status = %q, want %q", resp.Status, model.DebitRequestStatusCancelled)
	}
	if resp.CancelledAt == nil {
		t.Error("CancelledAt should be set")
	}
}

func TestCancelDebitRequest_NotFound(t *testing.T) {
	svc := newTestService()

	_, err := svc.CancelDebitRequest("nonexistent-id")
	if err != ErrDebitNotFound {
		t.Errorf("CancelDebitRequest() error = %v, want ErrDebitNotFound", err)
	}
}

func TestCancelDebitRequest_InvalidStatus(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	// Create with auto-approve to get completed status
	created, _ := svc.CreateDebitRequest(&model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      acc.AccountNo,
		Amount:         "10000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
		AutoApprove:    true,
	})

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Try to cancel completed request
	_, err := svc.CancelDebitRequest(created.ID)
	if err != ErrDebitInvalidStatus {
		t.Errorf("CancelDebitRequest() error = %v, want ErrDebitInvalidStatus", err)
	}
}

// --- Transaction Created for Debit ---

func TestDebitRequest_CreatesTransaction(t *testing.T) {
	svc := newTestService()
	acc := createTestAccount(t, svc, "홍길동", "KRW", "100000.00")

	req := &model.CreateDebitRequestInput{
		IdempotencyKey: "idem_" + uuid.New().String(),
		AccountNo:      acc.AccountNo,
		Amount:         "25000.00",
		Currency:       "KRW",
		CreditorID:     "PG_001",
		CreditorName:   "온라인쇼핑몰",
		Reference:      "ORDER_456",
		AutoApprove:    true,
	}

	resp, _ := svc.CreateDebitRequest(req)
	time.Sleep(100 * time.Millisecond)

	// Get the completed debit request
	debitReq, _ := svc.GetDebitRequest(resp.ID)

	// Get the transaction
	txn, err := svc.GetTransaction(debitReq.TransactionID)
	if err != nil {
		t.Fatalf("GetTransaction() error = %v", err)
	}

	if txn.Type != model.TransactionTypeDebit {
		t.Errorf("Type = %q, want %q", txn.Type, model.TransactionTypeDebit)
	}
	if txn.Amount != "25000.00" {
		t.Errorf("Amount = %q, want %q", txn.Amount, "25000.00")
	}
	if txn.BalanceBefore != "100000.00" {
		t.Errorf("BalanceBefore = %q, want %q", txn.BalanceBefore, "100000.00")
	}
	if txn.BalanceAfter != "75000.00" {
		t.Errorf("BalanceAfter = %q, want %q", txn.BalanceAfter, "75000.00")
	}
	if txn.Reference != "ORDER_456" {
		t.Errorf("Reference = %q, want %q", txn.Reference, "ORDER_456")
	}
}
