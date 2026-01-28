package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/stablenet/stable-platform/services/bank-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/model"
	"github.com/stablenet/stable-platform/services/bank-simulator/internal/service"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newTestConfig() *config.Config {
	return &config.Config{
		Port:           "4350",
		WebhookURL:     "",
		WebhookSecret:  "test-secret",
		DefaultBalance: "10000.00",
	}
}

func newTestHandler() (*BankHandler, *service.BankService) {
	cfg := newTestConfig()
	svc := service.NewBankService(cfg)
	h := NewBankHandler(svc)
	return h, svc
}

func newTestRouter(h *BankHandler) *gin.Engine {
	r := gin.New()
	h.RegisterRoutes(r)
	return r
}

func createAccountViaHandler(t *testing.T, router *gin.Engine, name, currency, balance string) *model.Account {
	t.Helper()
	body := map[string]string{
		"name":     name,
		"currency": currency,
	}
	if balance != "" {
		body["balance"] = balance
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("createAccountViaHandler() status = %d, want %d", w.Code, http.StatusCreated)
	}

	var acc model.Account
	if err := json.Unmarshal(w.Body.Bytes(), &acc); err != nil {
		t.Fatalf("failed to unmarshal account: %v", err)
	}
	return &acc
}

// --- NewBankHandler ---

func TestNewBankHandler(t *testing.T) {
	cfg := newTestConfig()
	svc := service.NewBankService(cfg)
	h := NewBankHandler(svc)
	if h == nil {
		t.Fatal("NewBankHandler() returned nil")
	}
	if h.bankService != svc {
		t.Error("bankService not set correctly")
	}
}

// --- CreateAccount ---

func TestCreateAccount_Success(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	body := `{"name":"Alice","currency":"USD","balance":"5000.00"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("status = %d, want %d", w.Code, http.StatusCreated)
	}

	var acc model.Account
	if err := json.Unmarshal(w.Body.Bytes(), &acc); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if acc.Name != "Alice" {
		t.Errorf("Name = %q, want %q", acc.Name, "Alice")
	}
	if acc.Balance != "5000.00" {
		t.Errorf("Balance = %q, want %q", acc.Balance, "5000.00")
	}
}

func TestCreateAccount_DefaultBalance(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	body := `{"name":"Bob","currency":"EUR"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("status = %d, want %d", w.Code, http.StatusCreated)
	}

	var acc model.Account
	json.Unmarshal(w.Body.Bytes(), &acc)
	if acc.Balance != "10000.00" {
		t.Errorf("Balance = %q, want default %q", acc.Balance, "10000.00")
	}
}

func TestCreateAccount_EmptyBody(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts", bytes.NewBufferString(""))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp ErrorResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Error != "Invalid request format" {
		t.Errorf("error = %q, want %q", resp.Error, "Invalid request format")
	}
}

func TestCreateAccount_InvalidJSON(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	body := `{"name":"Test", invalid}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateAccount_MissingRequiredField(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	// Missing "currency"
	body := `{"name":"Test"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateAccount_InvalidBalance(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	body := `{"name":"Test","currency":"USD","balance":"not-a-number"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "Validation failed" {
		t.Errorf("error = %q, want %q", resp["error"], "Validation failed")
	}
}

// --- GetAllAccounts ---

func TestGetAllAccounts_Empty(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/accounts", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var accounts []model.Account
	json.Unmarshal(w.Body.Bytes(), &accounts)
	if len(accounts) != 0 {
		t.Errorf("len = %d, want 0", len(accounts))
	}
}

func TestGetAllAccounts_Multiple(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	createAccountViaHandler(t, router, "A", "USD", "100.00")
	createAccountViaHandler(t, router, "B", "EUR", "200.00")

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/accounts", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var accounts []model.Account
	json.Unmarshal(w.Body.Bytes(), &accounts)
	if len(accounts) != 2 {
		t.Errorf("len = %d, want 2", len(accounts))
	}
}

// --- GetAccount ---

func TestGetAccount_Exists(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	created := createAccountViaHandler(t, router, "Test", "USD", "1000.00")

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/accounts/"+created.AccountNo, nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var acc model.Account
	json.Unmarshal(w.Body.Bytes(), &acc)
	if acc.AccountNo != created.AccountNo {
		t.Errorf("AccountNo = %q, want %q", acc.AccountNo, created.AccountNo)
	}
}

func TestGetAccount_NotFound(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/accounts/BANK9999999999", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}

	var resp ErrorResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	// Sanitized error should not expose "not found" directly
	if resp.Error != "The requested account could not be processed" {
		t.Errorf("error = %q, want sanitized message", resp.Error)
	}
}

// --- FreezeAccount ---

func TestFreezeAccount_Success(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	acc := createAccountViaHandler(t, router, "Freezable", "USD", "1000.00")

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts/"+acc.AccountNo+"/freeze", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var resp SuccessResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Message != "Account frozen" {
		t.Errorf("message = %q, want %q", resp.Message, "Account frozen")
	}
}

func TestFreezeAccount_NotFound(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts/BANK9999999999/freeze", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

// --- UnfreezeAccount ---

func TestUnfreezeAccount_Success(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	acc := createAccountViaHandler(t, router, "ToUnfreeze", "USD", "1000.00")

	// First freeze
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("POST", "/api/v1/accounts/"+acc.AccountNo+"/freeze", nil)
	router.ServeHTTP(w1, req1)

	// Then unfreeze
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/api/v1/accounts/"+acc.AccountNo+"/unfreeze", nil)
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w2.Code, http.StatusOK)
	}

	var resp SuccessResponse
	json.Unmarshal(w2.Body.Bytes(), &resp)
	if resp.Message != "Account unfrozen" {
		t.Errorf("message = %q, want %q", resp.Message, "Account unfrozen")
	}
}

func TestUnfreezeAccount_NotFrozen(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	acc := createAccountViaHandler(t, router, "Active", "USD", "1000.00")

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts/"+acc.AccountNo+"/unfreeze", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUnfreezeAccount_NotFound(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/accounts/NONEXISTENT/unfreeze", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- CreateTransfer ---

func TestCreateTransfer_Success(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	from := createAccountViaHandler(t, router, "From", "USD", "1000.00")
	to := createAccountViaHandler(t, router, "To", "USD", "500.00")

	body := map[string]string{
		"fromAccountNo": from.AccountNo,
		"toAccountNo":   to.AccountNo,
		"amount":        "200.00",
		"reference":     "test-transfer",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/transfers", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("status = %d, want %d", w.Code, http.StatusCreated)
	}

	var transfer model.Transfer
	json.Unmarshal(w.Body.Bytes(), &transfer)
	if transfer.Amount != "200.00" {
		t.Errorf("Amount = %q, want %q", transfer.Amount, "200.00")
	}
	if transfer.Status != model.TransferStatusCompleted {
		t.Errorf("Status = %q, want %q", transfer.Status, model.TransferStatusCompleted)
	}
}

func TestCreateTransfer_EmptyBody(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/transfers", bytes.NewBufferString(""))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateTransfer_InvalidJSON(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/transfers", bytes.NewBufferString("{invalid}"))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateTransfer_InsufficientBalance(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	from := createAccountViaHandler(t, router, "Poor", "USD", "50.00")
	to := createAccountViaHandler(t, router, "Rich", "USD", "10000.00")

	body := map[string]string{
		"fromAccountNo": from.AccountNo,
		"toAccountNo":   to.AccountNo,
		"amount":        "100.00",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/transfers", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp ErrorResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	// Sanitized error
	if resp.Error != "Transaction could not be completed" {
		t.Errorf("error = %q, want sanitized message", resp.Error)
	}
}

// --- GetTransfer ---

func TestGetTransfer_Exists(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	from := createAccountViaHandler(t, router, "A", "USD", "1000.00")
	to := createAccountViaHandler(t, router, "B", "USD", "500.00")

	// Create transfer
	body := map[string]string{
		"fromAccountNo": from.AccountNo,
		"toAccountNo":   to.AccountNo,
		"amount":        "100.00",
	}
	jsonBody, _ := json.Marshal(body)
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("POST", "/api/v1/transfers", bytes.NewBuffer(jsonBody))
	req1.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w1, req1)

	var created model.Transfer
	json.Unmarshal(w1.Body.Bytes(), &created)

	// Get transfer
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/v1/transfers/"+created.ID, nil)
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w2.Code, http.StatusOK)
	}

	var got model.Transfer
	json.Unmarshal(w2.Body.Bytes(), &got)
	if got.ID != created.ID {
		t.Errorf("ID = %q, want %q", got.ID, created.ID)
	}
}

func TestGetTransfer_NotFound(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/transfers/00000000-0000-0000-0000-000000000000", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

// --- GetAccountTransfers ---

func TestGetAccountTransfers(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	a := createAccountViaHandler(t, router, "A", "USD", "5000.00")
	b := createAccountViaHandler(t, router, "B", "USD", "5000.00")

	// Create 2 transfers
	for i := 0; i < 2; i++ {
		body := map[string]string{
			"fromAccountNo": a.AccountNo,
			"toAccountNo":   b.AccountNo,
			"amount":        "100.00",
		}
		jsonBody, _ := json.Marshal(body)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/transfers", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)
	}

	// Get transfers for A
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/accounts/"+a.AccountNo+"/transfers", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var transfers []model.Transfer
	json.Unmarshal(w.Body.Bytes(), &transfers)
	if len(transfers) != 2 {
		t.Errorf("len = %d, want 2", len(transfers))
	}
}

// --- Helper function tests ---

func TestSanitizeError(t *testing.T) {
	tests := []struct {
		name         string
		err          error
		resourceType string
		want         string
	}{
		{
			name:         "not found error",
			err:          errors.New("account not found: BANK123"),
			resourceType: "account",
			want:         "The requested account could not be processed",
		},
		{
			name:         "insufficient balance",
			err:          errors.New("insufficient balance"),
			resourceType: "transfer",
			want:         "Transaction could not be completed",
		},
		{
			name:         "not active error",
			err:          errors.New("source account is not active"),
			resourceType: "account",
			want:         "Account is not available for this operation",
		},
		{
			name:         "frozen error",
			err:          errors.New("account is frozen"),
			resourceType: "account",
			want:         "Account is not available for this operation",
		},
		{
			name:         "invalid error",
			err:          errors.New("invalid amount: abc"),
			resourceType: "transfer",
			want:         "Invalid request parameters",
		},
		{
			name:         "unknown error",
			err:          errors.New("some internal error"),
			resourceType: "account",
			want:         "An error occurred processing your request",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeError(tt.err, tt.resourceType)
			if got != tt.want {
				t.Errorf("sanitizeError() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestContains(t *testing.T) {
	tests := []struct {
		name   string
		s      string
		substr string
		want   bool
	}{
		{"Found at start", "not found error", "not found", true},
		{"Found in middle", "account not found here", "not found", true},
		{"Found at end", "error: not found", "not found", true},
		{"Not found", "some other error", "not found", false},
		{"Empty string", "", "not found", false},
		{"Empty substr", "some text", "", true},
		{"Exact match", "not found", "not found", true},
		{"Substr longer than s", "abc", "abcdef", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := contains(tt.s, tt.substr)
			if got != tt.want {
				t.Errorf("contains(%q, %q) = %v, want %v", tt.s, tt.substr, got, tt.want)
			}
		})
	}
}

func TestContainsHelper(t *testing.T) {
	tests := []struct {
		name   string
		s      string
		substr string
		want   bool
	}{
		{"Found", "hello world", "world", true},
		{"Not found", "hello world", "xyz", false},
		{"At start", "hello", "hel", true},
		{"At end", "hello", "llo", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := containsHelper(tt.s, tt.substr)
			if got != tt.want {
				t.Errorf("containsHelper(%q, %q) = %v, want %v", tt.s, tt.substr, got, tt.want)
			}
		})
	}
}

// --- Route registration test ---

func TestRegisterRoutes(t *testing.T) {
	h, _ := newTestHandler()
	router := newTestRouter(h)

	// Test that all routes are registered by making requests
	routes := []struct {
		method string
		path   string
	}{
		{"POST", "/api/v1/accounts"},
		{"GET", "/api/v1/accounts"},
		{"GET", "/api/v1/accounts/test123"},
		{"POST", "/api/v1/accounts/test123/freeze"},
		{"POST", "/api/v1/accounts/test123/unfreeze"},
		{"GET", "/api/v1/accounts/test123/transfers"},
		{"POST", "/api/v1/transfers"},
		{"GET", "/api/v1/transfers/test-id"},
	}

	for _, r := range routes {
		t.Run(r.method+" "+r.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			var body *bytes.Buffer
			if r.method == "POST" {
				body = bytes.NewBufferString("{}")
			} else {
				body = bytes.NewBuffer(nil)
			}
			req, _ := http.NewRequest(r.method, r.path, body)
			if r.method == "POST" {
				req.Header.Set("Content-Type", "application/json")
			}
			router.ServeHTTP(w, req)

			// Should not return 404 (route not found)
			if w.Code == http.StatusNotFound && w.Body.String() == "404 page not found" {
				t.Errorf("route %s %s not registered", r.method, r.path)
			}
		})
	}
}
