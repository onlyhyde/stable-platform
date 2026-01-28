package service

import (
	"math/rand"
	"testing"
	"time"

	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/onramp-simulator/internal/model"
)

// newTestService creates a service with test configuration.
// ProcessingTime is set high to prevent background goroutines from
// interfering with synchronous test assertions.
func newTestService() *OnRampService {
	cfg := &config.Config{
		Port:                   "4352",
		BaseURL:                "http://localhost:4352",
		WebhookURL:             "",
		WebhookSecret:          "test-secret",
		PGSimulatorURL:         "http://localhost:4351",
		BankSimulatorURL:       "http://localhost:4350",
		ProcessingTime:         3600,
		SuccessRate:            95,
		KYCProcessingTime:      3600,
		KYCSuccessRate:         90,
		TransferProcessingTime: 3600,
		TransferSuccessRate:    95,
		RefundProcessingTime:   3600,
		USDToUSDC:              "0.998",
	}
	return NewOnRampService(cfg)
}

// setupUserWithKYC creates a user with approved KYC for testing
func setupUserWithKYC(t *testing.T, svc *OnRampService, userID string) {
	t.Helper()

	// Create KYC record directly in the map (bypass async processing)
	now := time.Now()
	expiresAt := now.AddDate(1, 0, 0)

	svc.mu.Lock()
	svc.kycRecords[userID] = &model.KYCRecord{
		ID:         "kyc-" + userID,
		UserID:     userID,
		Level:      model.KYCLevelBasic,
		Status:     model.KYCStatusApproved,
		ApprovedAt: &now,
		ExpiresAt:  &expiresAt,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	svc.mu.Unlock()
}

func TestGetQuote(t *testing.T) {
	svc := newTestService()

	tests := []struct {
		name    string
		req     *model.QuoteRequest
		wantErr bool
	}{
		{
			name: "Valid quote 100 USD",
			req: &model.QuoteRequest{
				FiatAmount:     "100",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			},
			wantErr: false,
		},
		{
			name: "Valid quote 1000 USD",
			req: &model.QuoteRequest{
				FiatAmount:     "1000",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			},
			wantErr: false,
		},
		{
			name: "Valid quote decimal amount",
			req: &model.QuoteRequest{
				FiatAmount:     "99.99",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			},
			wantErr: false,
		},
		{
			name: "Valid quote small amount",
			req: &model.QuoteRequest{
				FiatAmount:     "1.50",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			},
			wantErr: false,
		},
		{
			name: "Invalid fiat amount - letters",
			req: &model.QuoteRequest{
				FiatAmount:     "abc",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			},
			wantErr: true,
		},
		{
			name: "Invalid fiat amount - empty",
			req: &model.QuoteRequest{
				FiatAmount:     "",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			},
			wantErr: true,
		},
		{
			name: "Invalid fiat amount - special chars",
			req: &model.QuoteRequest{
				FiatAmount:     "$100",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := svc.GetQuote(tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetQuote() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}
			if resp.FiatAmount != tt.req.FiatAmount {
				t.Errorf("GetQuote() FiatAmount = %v, want %v", resp.FiatAmount, tt.req.FiatAmount)
			}
			if resp.ExchangeRate != "0.99800000" {
				t.Errorf("GetQuote() ExchangeRate = %v, want 0.99800000", resp.ExchangeRate)
			}
			if resp.FeePercent != "1.5" {
				t.Errorf("GetQuote() FeePercent = %v, want 1.5", resp.FeePercent)
			}
			if resp.CryptoAmount == "" {
				t.Error("GetQuote() CryptoAmount is empty")
			}
			if resp.ExpiresAt == "" {
				t.Error("GetQuote() ExpiresAt is empty")
			}
			if resp.Fee == "" {
				t.Error("GetQuote() Fee is empty")
			}
		})
	}
}

func TestGetQuoteFeeCalculation(t *testing.T) {
	svc := newTestService()

	tests := []struct {
		name       string
		fiatAmount string
		wantFee    string
		wantCrypto string
	}{
		{
			// 100 * 0.015 = 1.50 fee; (100 - 1.50) * 0.998 = 98.303000
			name:       "100 USD",
			fiatAmount: "100",
			wantFee:    "1.50",
			wantCrypto: "98.303000",
		},
		{
			// 1000 * 0.015 = 15.00 fee; (1000 - 15) * 0.998 = 983.030000
			name:       "1000 USD",
			fiatAmount: "1000",
			wantFee:    "15.00",
			wantCrypto: "983.030000",
		},
		{
			// 50 * 0.015 = 0.75 fee; (50 - 0.75) * 0.998 = 49.151500
			name:       "50 USD",
			fiatAmount: "50",
			wantFee:    "0.75",
			wantCrypto: "49.151500",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := svc.GetQuote(&model.QuoteRequest{
				FiatAmount:     tt.fiatAmount,
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
			})
			if err != nil {
				t.Fatalf("GetQuote() unexpected error: %v", err)
			}
			if resp.Fee != tt.wantFee {
				t.Errorf("GetQuote() Fee = %v, want %v", resp.Fee, tt.wantFee)
			}
			if resp.CryptoAmount != tt.wantCrypto {
				t.Errorf("GetQuote() CryptoAmount = %v, want %v", resp.CryptoAmount, tt.wantCrypto)
			}
		})
	}
}

func TestCreateOrderWithoutKYC(t *testing.T) {
	svc := newTestService()

	// Test order creation without KYC - should return kyc_required status
	order, err := svc.CreateOrder(&model.CreateOrderRequest{
		UserID:         "user-no-kyc",
		WalletAddress:  "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", // Valid EVM address
		FiatAmount:     "100",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
		PaymentMethod:  model.PaymentMethodCard,
		ChainID:        1,
	})
	if err != nil {
		t.Fatalf("CreateOrder() error = %v", err)
	}
	if order.Status != model.OrderStatusKYCRequired {
		t.Errorf("CreateOrder() Status = %v, want %v", order.Status, model.OrderStatusKYCRequired)
	}
	if order.FailureReason != "kyc_required" {
		t.Errorf("CreateOrder() FailureReason = %v, want kyc_required", order.FailureReason)
	}
}

func TestCreateOrderWithKYC(t *testing.T) {
	svc := newTestService()

	// Setup KYC for test users
	setupUserWithKYC(t, svc, "user-card")
	setupUserWithKYC(t, svc, "user-bank")
	setupUserWithKYC(t, svc, "user-apple")
	setupUserWithKYC(t, svc, "user-err")

	tests := []struct {
		name       string
		req        *model.CreateOrderRequest
		wantErr    bool
		wantStatus model.OrderStatus
	}{
		{
			name: "Valid order with card (pending payment - PG unavailable)",
			req: &model.CreateOrderRequest{
				UserID:         "user-card",
				WalletAddress:  "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", // Valid EVM address
				FiatAmount:     "100",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
				PaymentMethod:  model.PaymentMethodCard,
				ChainID:        1,
			},
			wantErr:    false,
			wantStatus: model.OrderStatusFailed, // PG not available in test
		},
		{
			name: "Valid order with bank transfer (no bank account)",
			req: &model.CreateOrderRequest{
				UserID:         "user-bank",
				WalletAddress:  "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359", // Valid EVM address
				FiatAmount:     "100",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
				PaymentMethod:  model.PaymentMethodBankTransfer,
				ChainID:        10,
			},
			wantErr: true, // Bank account required
		},
		{
			name: "Invalid fiat amount",
			req: &model.CreateOrderRequest{
				UserID:         "user-err",
				WalletAddress:  "0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb", // Valid EVM address
				FiatAmount:     "not-a-number",
				FiatCurrency:   "USD",
				CryptoCurrency: "USDC",
				PaymentMethod:  model.PaymentMethodCard,
				ChainID:        1,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			order, err := svc.CreateOrder(tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("CreateOrder() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}
			if order.ID == "" {
				t.Error("CreateOrder() ID is empty")
			}
			if tt.wantStatus != "" && order.Status != tt.wantStatus {
				t.Errorf("CreateOrder() Status = %v, want %v", order.Status, tt.wantStatus)
			}
			if order.UserID != tt.req.UserID {
				t.Errorf("CreateOrder() UserID = %v, want %v", order.UserID, tt.req.UserID)
			}
		})
	}
}

func TestKYCSubmission(t *testing.T) {
	svc := newTestService()

	// Test KYC submission
	record, err := svc.SubmitKYC(&model.SubmitKYCRequest{
		UserID: "user-kyc-test",
		Level:  model.KYCLevelBasic,
		Documents: model.KYCDocuments{
			IDType:      "passport",
			IDNumber:    "M12345678",
			FullName:    "Test User",
			DateOfBirth: "1990-01-15",
			Nationality: "US",
			Address: &model.KYCAddress{
				Street:     "123 Test St",
				City:       "Test City",
				Country:    "US",
				PostalCode: "12345",
			},
		},
	})
	if err != nil {
		t.Fatalf("SubmitKYC() error = %v", err)
	}
	if record.Status != model.KYCStatusPending {
		t.Errorf("SubmitKYC() Status = %v, want %v", record.Status, model.KYCStatusPending)
	}
	if record.Level != model.KYCLevelBasic {
		t.Errorf("SubmitKYC() Level = %v, want %v", record.Level, model.KYCLevelBasic)
	}

	// Test duplicate submission
	_, err = svc.SubmitKYC(&model.SubmitKYCRequest{
		UserID: "user-kyc-test",
		Level:  model.KYCLevelBasic,
		Documents: model.KYCDocuments{
			IDType:      "passport",
			IDNumber:    "M12345678",
			FullName:    "Test User",
			DateOfBirth: "1990-01-15",
			Nationality: "US",
		},
	})
	if err != ErrKYCAlreadyPending {
		t.Errorf("SubmitKYC() duplicate error = %v, want %v", err, ErrKYCAlreadyPending)
	}
}

func TestKYCStatus(t *testing.T) {
	svc := newTestService()

	// Test status for user without KYC
	status, err := svc.GetKYCStatus("user-no-kyc")
	if err != nil {
		t.Fatalf("GetKYCStatus() error = %v", err)
	}
	if status.Status != model.KYCStatusNone {
		t.Errorf("GetKYCStatus() Status = %v, want %v", status.Status, model.KYCStatusNone)
	}
	if status.Level != model.KYCLevelNone {
		t.Errorf("GetKYCStatus() Level = %v, want %v", status.Level, model.KYCLevelNone)
	}

	// Setup user with approved KYC
	setupUserWithKYC(t, svc, "user-with-kyc")

	status, err = svc.GetKYCStatus("user-with-kyc")
	if err != nil {
		t.Fatalf("GetKYCStatus() error = %v", err)
	}
	if status.Status != model.KYCStatusApproved {
		t.Errorf("GetKYCStatus() Status = %v, want %v", status.Status, model.KYCStatusApproved)
	}
	if status.Level != model.KYCLevelBasic {
		t.Errorf("GetKYCStatus() Level = %v, want %v", status.Level, model.KYCLevelBasic)
	}
}

func TestKYCRequirements(t *testing.T) {
	svc := newTestService()

	requirements := svc.GetKYCRequirements()
	if requirements == nil {
		t.Fatal("GetKYCRequirements() returned nil")
	}
	if len(requirements.Levels) != 3 {
		t.Errorf("GetKYCRequirements() levels count = %d, want 3", len(requirements.Levels))
	}
	if len(requirements.Levels[model.KYCLevelNone].Requirements) != 0 {
		t.Errorf("GetKYCRequirements() none level should have no requirements")
	}
	if len(requirements.Levels[model.KYCLevelBasic].Requirements) != 4 {
		t.Errorf("GetKYCRequirements() basic level requirements = %d, want 4", len(requirements.Levels[model.KYCLevelBasic].Requirements))
	}
	if len(requirements.Levels[model.KYCLevelAdvanced].Requirements) != 7 {
		t.Errorf("GetKYCRequirements() advanced level requirements = %d, want 7", len(requirements.Levels[model.KYCLevelAdvanced].Requirements))
	}
}

func TestGetOrder(t *testing.T) {
	svc := newTestService()
	setupUserWithKYC(t, svc, "user-get")

	// Setup: create an order (will fail due to PG not available, but order is created)
	order, err := svc.CreateOrder(&model.CreateOrderRequest{
		UserID:         "user-get",
		WalletAddress:  "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", // Valid EVM address
		FiatAmount:     "50",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
		PaymentMethod:  model.PaymentMethodCard,
		ChainID:        1,
	})
	if err != nil {
		t.Fatalf("Setup CreateOrder() error: %v", err)
	}

	tests := []struct {
		name    string
		id      string
		wantErr bool
	}{
		{"Existing order", order.ID, false},
		{"Non-existent order", "non-existent-id", true},
		{"Empty ID", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := svc.GetOrder(tt.id)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetOrder(%q) error = %v, wantErr %v", tt.id, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got.ID != tt.id {
				t.Errorf("GetOrder() ID = %v, want %v", got.ID, tt.id)
			}
		})
	}
}

func TestGetOrdersByUser(t *testing.T) {
	svc := newTestService()
	setupUserWithKYC(t, svc, "user-alpha")
	setupUserWithKYC(t, svc, "user-beta")

	// Setup: create orders for different users
	for i := 0; i < 3; i++ {
		_, err := svc.CreateOrder(&model.CreateOrderRequest{
			UserID:         "user-alpha",
			WalletAddress:  "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", // Valid EVM address
			FiatAmount:     "100",
			FiatCurrency:   "USD",
			CryptoCurrency: "USDC",
			PaymentMethod:  model.PaymentMethodCard,
			ChainID:        1,
		})
		if err != nil {
			t.Fatalf("Setup CreateOrder() error: %v", err)
		}
	}
	_, err := svc.CreateOrder(&model.CreateOrderRequest{
		UserID:         "user-beta",
		WalletAddress:  "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359", // Valid EVM address
		FiatAmount:     "200",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
		PaymentMethod:  model.PaymentMethodCard,
		ChainID:        1,
	})
	if err != nil {
		t.Fatalf("Setup CreateOrder() error: %v", err)
	}

	tests := []struct {
		name      string
		userID    string
		wantCount int
	}{
		{"User with 3 orders", "user-alpha", 3},
		{"User with 1 order", "user-beta", 1},
		{"User with no orders", "user-gamma", 0},
		{"Empty user ID", "", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			orders := svc.GetOrdersByUser(tt.userID)
			if len(orders) != tt.wantCount {
				t.Errorf("GetOrdersByUser(%q) count = %d, want %d", tt.userID, len(orders), tt.wantCount)
			}
		})
	}
}

func TestCancelOrder(t *testing.T) {
	svc := newTestService()
	setupUserWithKYC(t, svc, "user-cancel")
	setupUserWithKYC(t, svc, "user-cancel2")
	setupUserWithKYC(t, svc, "user-cancel3")

	// Setup: create a pending order (set status directly since PG won't work)
	pendingOrder, err := svc.CreateOrder(&model.CreateOrderRequest{
		UserID:         "user-cancel",
		WalletAddress:  "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
		FiatAmount:     "100",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
		PaymentMethod:  model.PaymentMethodCard,
		ChainID:        1,
	})
	if err != nil {
		t.Fatalf("Setup CreateOrder() error: %v", err)
	}
	// Force status to pending for testing
	svc.mu.Lock()
	svc.orders[pendingOrder.ID].Status = model.OrderStatusPending
	svc.mu.Unlock()

	// Setup: create another order and force status to processing
	processingOrder, err := svc.CreateOrder(&model.CreateOrderRequest{
		UserID:         "user-cancel2",
		WalletAddress:  "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359",
		FiatAmount:     "200",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
		PaymentMethod:  model.PaymentMethodCard,
		ChainID:        1,
	})
	if err != nil {
		t.Fatalf("Setup CreateOrder() error: %v", err)
	}
	svc.mu.Lock()
	svc.orders[processingOrder.ID].Status = model.OrderStatusProcessing
	svc.mu.Unlock()

	// Setup: create another order and force status to completed
	completedOrder, err := svc.CreateOrder(&model.CreateOrderRequest{
		UserID:         "user-cancel3",
		WalletAddress:  "0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb",
		FiatAmount:     "300",
		FiatCurrency:   "USD",
		CryptoCurrency: "USDC",
		PaymentMethod:  model.PaymentMethodCard,
		ChainID:        1,
	})
	if err != nil {
		t.Fatalf("Setup CreateOrder() error: %v", err)
	}
	svc.mu.Lock()
	svc.orders[completedOrder.ID].Status = model.OrderStatusCompleted
	svc.mu.Unlock()

	tests := []struct {
		name    string
		id      string
		wantErr bool
	}{
		{"Cancel pending order", pendingOrder.ID, false},
		{"Cancel processing order", processingOrder.ID, true},
		{"Cancel completed order", completedOrder.ID, true},
		{"Cancel non-existent order", "non-existent-id", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := svc.CancelOrder(tt.id)
			if (err != nil) != tt.wantErr {
				t.Errorf("CancelOrder(%q) error = %v, wantErr %v", tt.id, err, tt.wantErr)
				return
			}
			if !tt.wantErr && result.Status != model.OrderStatusCancelled {
				t.Errorf("CancelOrder() Status = %v, want %v", result.Status, model.OrderStatusCancelled)
			}
		})
	}
}

func TestMaskUserID(t *testing.T) {
	tests := []struct {
		name   string
		userID string
		want   string
	}{
		{"Email format", "john@example.com", "j****@example.com"},
		{"Email single char local", "a@test.com", "a****@test.com"},
		{"Long ID", "user123456", "us****56"},
		{"5-char ID", "abcde", "ab****de"},
		{"4-char ID (too short)", "user", "****"},
		{"3-char ID", "abc", "****"},
		{"Single char", "x", "****"},
		{"Empty", "", "****"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskUserID(tt.userID)
			if got != tt.want {
				t.Errorf("maskUserID(%q) = %v, want %v", tt.userID, got, tt.want)
			}
		})
	}
}

func TestGenerateTxHash(t *testing.T) {
	tests := []struct {
		name string
	}{
		{"First hash"},
		{"Second hash"},
		{"Third hash"},
	}

	hashes := make(map[string]bool)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash := generateTxHash()

			// Must start with "0x"
			if len(hash) < 2 || hash[:2] != "0x" {
				t.Errorf("generateTxHash() = %v, want 0x prefix", hash)
			}

			// 0x + 64 hex chars = 66 total length
			if len(hash) != 66 {
				t.Errorf("generateTxHash() length = %d, want 66", len(hash))
			}

			// Valid hex characters only (after 0x prefix)
			for _, c := range hash[2:] {
				if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
					t.Errorf("generateTxHash() contains invalid hex char: %c", c)
					break
				}
			}

			// Should be unique
			if hashes[hash] {
				t.Errorf("generateTxHash() produced duplicate hash: %v", hash)
			}
			hashes[hash] = true
		})
	}
}

func TestComputeHMAC(t *testing.T) {
	tests := []struct {
		name   string
		data   []byte
		secret string
	}{
		{"Normal payload", []byte(`{"event":"order.created"}`), "secret-key"},
		{"Empty data", []byte(""), "secret-key"},
		{"Empty secret", []byte(`{"event":"test"}`), ""},
		{"Large payload", []byte(`{"event":"order.completed","data":{"id":"abc-123","amount":"1000"}}`), "webhook-secret"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sig := computeHMAC(tt.data, tt.secret)
			if sig == "" {
				t.Error("computeHMAC() returned empty string")
			}
			// HMAC-SHA256 produces 64 hex characters
			if len(sig) != 64 {
				t.Errorf("computeHMAC() length = %d, want 64", len(sig))
			}
			// Must be deterministic
			sig2 := computeHMAC(tt.data, tt.secret)
			if sig != sig2 {
				t.Errorf("computeHMAC() not deterministic: %v != %v", sig, sig2)
			}
		})
	}
}

func TestComputeHMACDifferentInputs(t *testing.T) {
	data := []byte(`{"event":"order.created"}`)

	// Different secrets produce different signatures
	sig1 := computeHMAC(data, "secret-1")
	sig2 := computeHMAC(data, "secret-2")
	if sig1 == sig2 {
		t.Error("computeHMAC() same signature for different secrets")
	}

	// Different data produces different signatures
	sig3 := computeHMAC([]byte("data-a"), "same-secret")
	sig4 := computeHMAC([]byte("data-b"), "same-secret")
	if sig3 == sig4 {
		t.Error("computeHMAC() same signature for different data")
	}
}

func TestNewOnRampService(t *testing.T) {
	cfg := &config.Config{
		Port:                   "4352",
		BaseURL:                "http://localhost:4352",
		WebhookSecret:          "test",
		PGSimulatorURL:         "http://localhost:4351",
		BankSimulatorURL:       "http://localhost:4350",
		ProcessingTime:         5,
		SuccessRate:            90,
		KYCProcessingTime:      5,
		KYCSuccessRate:         90,
		TransferProcessingTime: 3,
		TransferSuccessRate:    95,
		RefundProcessingTime:   5,
		USDToUSDC:              "1.0",
	}

	svc := NewOnRampService(cfg)
	if svc == nil {
		t.Fatal("NewOnRampService() returned nil")
	}
	if svc.cfg != cfg {
		t.Error("NewOnRampService() cfg not set correctly")
	}
	if svc.orders == nil {
		t.Error("NewOnRampService() orders map is nil")
	}
	if svc.kycRecords == nil {
		t.Error("NewOnRampService() kycRecords map is nil")
	}
	if svc.rng == nil {
		t.Error("NewOnRampService() rng is nil")
	}
	if svc.pgClient == nil {
		t.Error("NewOnRampService() pgClient is nil")
	}
	if svc.bankClient == nil {
		t.Error("NewOnRampService() bankClient is nil")
	}
}

func TestKYCLimitsCheck(t *testing.T) {
	svc := newTestService()

	// Create a user with basic KYC (limits: daily 1000, per-tx 500)
	setupUserWithKYC(t, svc, "user-limits")

	// Test amount within limits
	kycStatus, _ := svc.GetKYCStatus("user-limits")
	err := svc.checkLimits(kycStatus, "100")
	if err != nil {
		t.Errorf("checkLimits() unexpected error for amount within limits: %v", err)
	}

	// Test amount exceeding per-transaction limit
	err = svc.checkLimits(kycStatus, "600")
	if err != ErrExceedsTransactionLimit {
		t.Errorf("checkLimits() error = %v, want %v", err, ErrExceedsTransactionLimit)
	}
}

func TestKYCRenewal(t *testing.T) {
	svc := newTestService()

	// Test renewal for non-existent user
	_, err := svc.RenewKYC("user-no-kyc")
	if err != ErrKYCNotFound {
		t.Errorf("RenewKYC() error = %v, want %v", err, ErrKYCNotFound)
	}

	// Create user with non-expired KYC
	setupUserWithKYC(t, svc, "user-active-kyc")

	// Test renewal for non-expired KYC
	_, err = svc.RenewKYC("user-active-kyc")
	if err != ErrKYCNotExpired {
		t.Errorf("RenewKYC() error = %v, want %v", err, ErrKYCNotExpired)
	}

	// Create user with expired KYC
	expiredTime := time.Now().AddDate(0, 0, -1) // Yesterday
	svc.mu.Lock()
	svc.kycRecords["user-expired-kyc"] = &model.KYCRecord{
		ID:        "kyc-expired",
		UserID:    "user-expired-kyc",
		Level:     model.KYCLevelBasic,
		Status:    model.KYCStatusApproved,
		ExpiresAt: &expiredTime,
		Documents: &model.KYCDocuments{
			IDType:   "passport",
			FullName: "Test User",
		},
	}
	svc.mu.Unlock()

	// Test renewal for expired KYC
	record, err := svc.RenewKYC("user-expired-kyc")
	if err != nil {
		t.Fatalf("RenewKYC() error = %v", err)
	}
	if record.Status != model.KYCStatusPending {
		t.Errorf("RenewKYC() Status = %v, want %v", record.Status, model.KYCStatusPending)
	}
	if record.RenewalOf != "kyc-expired" {
		t.Errorf("RenewKYC() RenewalOf = %v, want kyc-expired", record.RenewalOf)
	}
}

func TestGetRandomRejectionReason(t *testing.T) {
	svc := newTestService()
	svc.rng = rand.New(rand.NewSource(42))

	validReasons := map[string]bool{
		"document_unclear":      true,
		"document_expired":      true,
		"information_mismatch":  true,
		"suspicious_activity":   true,
		"unsupported_country":   true,
	}

	seen := make(map[string]bool)

	// Call multiple times to exercise randomness
	for i := 0; i < 50; i++ {
		reason := svc.getRandomRejectionReason()
		if !validReasons[reason] {
			t.Errorf("getRandomRejectionReason() = %v, not a valid reason", reason)
		}
		seen[reason] = true
	}

	// With 50 calls and 5 options, we should see at least 2 distinct reasons
	if len(seen) < 2 {
		t.Errorf("getRandomRejectionReason() returned only %d distinct reasons in 50 calls", len(seen))
	}
}

// ========== ONRAMP-06: Wallet Validation Tests ==========

func TestValidateWallet(t *testing.T) {
	svc := newTestService()

	tests := []struct {
		name      string
		req       *ValidateWalletRequest
		wantValid bool
		wantError string
	}{
		{
			name: "Valid address on Ethereum",
			req: &ValidateWalletRequest{
				Address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
				ChainID: 1,
			},
			wantValid: true,
		},
		{
			name: "Valid address on Polygon",
			req: &ValidateWalletRequest{
				Address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
				ChainID: 137,
			},
			wantValid: true,
		},
		{
			name: "Valid address on Arbitrum",
			req: &ValidateWalletRequest{
				Address: "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359",
				ChainID: 42161,
			},
			wantValid: true,
		},
		{
			name: "Valid address on Optimism",
			req: &ValidateWalletRequest{
				Address: "0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb",
				ChainID: 10,
			},
			wantValid: true,
		},
		{
			name: "Valid address on Base",
			req: &ValidateWalletRequest{
				Address: "0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb",
				ChainID: 8453,
			},
			wantValid: true,
		},
		{
			name: "Valid address on Sepolia testnet",
			req: &ValidateWalletRequest{
				Address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
				ChainID: 11155111,
			},
			wantValid: true,
		},
		{
			name: "Valid uppercase address",
			req: &ValidateWalletRequest{
				Address: "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED",
				ChainID: 1,
			},
			wantValid: true,
		},
		{
			name: "Invalid address - too short",
			req: &ValidateWalletRequest{
				Address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1bea",
				ChainID: 1,
			},
			wantValid: false,
			wantError: "invalid wallet address format",
		},
		{
			name: "Invalid address - too long",
			req: &ValidateWalletRequest{
				Address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed1",
				ChainID: 1,
			},
			wantValid: false,
			wantError: "invalid wallet address format",
		},
		{
			name: "Invalid address - missing 0x prefix",
			req: &ValidateWalletRequest{
				Address: "5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
				ChainID: 1,
			},
			wantValid: false,
			wantError: "invalid wallet address format",
		},
		{
			name: "Invalid address - invalid hex characters",
			req: &ValidateWalletRequest{
				Address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaeg",
				ChainID: 1,
			},
			wantValid: false,
			wantError: "invalid wallet address format",
		},
		{
			name: "Empty address",
			req: &ValidateWalletRequest{
				Address: "",
				ChainID: 1,
			},
			wantValid: false,
			wantError: "invalid wallet address format",
		},
		{
			name: "Unsupported chain - BSC",
			req: &ValidateWalletRequest{
				Address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
				ChainID: 56,
			},
			wantValid: false,
			wantError: "unsupported chain",
		},
		{
			name: "Unsupported chain - Avalanche",
			req: &ValidateWalletRequest{
				Address: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
				ChainID: 43114,
			},
			wantValid: false,
			wantError: "unsupported chain",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.ValidateWallet(tt.req)

			if result.Valid != tt.wantValid {
				t.Errorf("ValidateWallet() valid = %v, want %v", result.Valid, tt.wantValid)
			}

			if tt.wantError != "" && result.Error != tt.wantError {
				t.Errorf("ValidateWallet() error = %v, want %v", result.Error, tt.wantError)
			}

			if tt.wantValid {
				if result.ChecksumAddress == "" {
					t.Error("ValidateWallet() ChecksumAddress should not be empty for valid address")
				}
				if result.ChainName == "" {
					t.Error("ValidateWallet() ChainName should not be empty for valid address")
				}
				if result.ChainID != tt.req.ChainID {
					t.Errorf("ValidateWallet() ChainID = %v, want %v", result.ChainID, tt.req.ChainID)
				}
			}
		})
	}
}

func TestValidateWalletChecksumWarning(t *testing.T) {
	svc := newTestService()

	// Address with incorrect mixed case (valid format but wrong checksum)
	req := &ValidateWalletRequest{
		Address: "0x5aAeb6053f3e94C9b9a09F33669435E7eF1BeAed", // Wrong checksum
		ChainID: 1,
	}

	result := svc.ValidateWallet(req)

	if !result.Valid {
		t.Error("Address should be valid despite wrong checksum")
	}

	// Should have checksum warning
	if len(result.Warnings) == 0 {
		t.Error("Should have checksum warning for mixed-case address with wrong checksum")
	}

	// Checksum address should be correct
	expectedChecksum := "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
	if result.ChecksumAddress != expectedChecksum {
		t.Errorf("ChecksumAddress = %v, want %v", result.ChecksumAddress, expectedChecksum)
	}
}

func TestGetRateManager(t *testing.T) {
	svc := newTestService()

	rm := svc.GetRateManager()
	if rm == nil {
		t.Fatal("GetRateManager() returned nil")
	}

	// Verify it's the same instance
	rm2 := svc.GetRateManager()
	if rm != rm2 {
		t.Error("GetRateManager() should return same instance")
	}

	// Verify rate manager is functional
	_, err := rm.GetRate("USD", "USDC")
	if err != nil {
		t.Errorf("RateManager should have USD/USDC rate: %v", err)
	}
}
