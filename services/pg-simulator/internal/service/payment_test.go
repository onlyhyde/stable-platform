package service

import (
	"testing"
	"time"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/model"
)

func TestValidateLuhn(t *testing.T) {
	tests := []struct {
		name      string
		cardNum   string
		wantErr   bool
	}{
		// Valid test card numbers (from Stripe test cards)
		{"Valid Visa", "4242424242424242", false},
		{"Valid Visa with spaces", "4242 4242 4242 4242", false},
		{"Valid Visa with dashes", "4242-4242-4242-4242", false},
		{"Valid Mastercard", "5555555555554444", false},
		{"Valid AmEx", "378282246310005", false},
		{"Valid AmEx 2", "371449635398431", false},
		{"Valid Discover", "6011111111111117", false},
		{"Valid Visa 13 digit", "4222222222222", false},

		// Invalid card numbers
		{"Invalid checksum", "4242424242424241", true},
		{"Invalid all zeros", "0000000000000000", true},
		{"Too short", "424242424242", true},
		{"Too long", "42424242424242424242", true},
		{"Empty", "", true},
		{"Invalid characters only", "abcdefghijklm", true},
		{"Single digit", "4", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateLuhn(tt.cardNum)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateLuhn(%q) error = %v, wantErr %v", tt.cardNum, err, tt.wantErr)
			}
		})
	}
}

func TestValidateCVV(t *testing.T) {
	tests := []struct {
		name    string
		cvv     string
		brand   string
		wantErr bool
	}{
		// Valid CVV
		{"Valid 3-digit CVV for Visa", "123", "visa", false},
		{"Valid 3-digit CVV for Mastercard", "456", "mastercard", false},
		{"Valid 3-digit CVV for Discover", "789", "discover", false},
		{"Valid 4-digit CVV for AmEx", "1234", "amex", false},

		// Invalid CVV
		{"Too short for Visa", "12", "visa", true},
		{"Too long for Visa", "1234", "visa", true},
		{"Too short for AmEx", "123", "amex", true},
		{"Too long for AmEx", "12345", "amex", true},
		{"Empty CVV", "", "visa", true},
		{"CVV with letters", "12a", "visa", true},
		{"CVV with spaces", "1 3", "visa", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCVV(tt.cvv, tt.brand)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateCVV(%q, %q) error = %v, wantErr %v", tt.cvv, tt.brand, err, tt.wantErr)
			}
		})
	}
}

func TestValidateExpiry(t *testing.T) {
	now := time.Now()
	currentYear := now.Year()
	currentMonth := int(now.Month())

	// Calculate next month for valid test case
	nextMonth := currentMonth + 1
	nextMonthYear := currentYear
	if nextMonth > 12 {
		nextMonth = 1
		nextMonthYear++
	}

	// Calculate previous month for expired test case
	prevMonth := currentMonth - 1
	prevMonthYear := currentYear
	if prevMonth < 1 {
		prevMonth = 12
		prevMonthYear--
	}

	tests := []struct {
		name      string
		expMonth  string
		expYear   string
		wantErr   bool
	}{
		// Valid expiry
		{"Current month (valid until end of month)", intToStr(currentMonth), intToStr(currentYear), false},
		{"Next month", intToStr(nextMonth), intToStr(nextMonthYear), false},
		{"Next year", "12", intToStr(currentYear + 1), false},
		{"2-digit year format", "12", intToStr(currentYear + 1 - 2000), false},
		{"Far future (10 years)", "01", intToStr(currentYear + 10), false},

		// Invalid expiry
		{"Previous month (expired)", intToStr(prevMonth), intToStr(prevMonthYear), true},
		{"Previous year (expired)", "12", intToStr(currentYear - 1), true},
		{"Invalid month 0", "0", intToStr(currentYear + 1), true},
		{"Invalid month 13", "13", intToStr(currentYear + 1), true},
		{"Invalid month letters", "ab", intToStr(currentYear + 1), true},
		{"Invalid year letters", "12", "abcd", true},
		{"Too far in future (25 years)", "12", intToStr(currentYear + 25), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateExpiry(tt.expMonth, tt.expYear)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateExpiry(%q, %q) error = %v, wantErr %v", tt.expMonth, tt.expYear, err, tt.wantErr)
			}
		})
	}
}

func TestValidateCard(t *testing.T) {
	now := time.Now()
	futureYear := intToStr(now.Year() + 1)

	tests := []struct {
		name      string
		card      *model.CardDetails
		wantErr   bool
		wantReason string
	}{
		{
			name: "Valid Visa card",
			card: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "Test User",
			},
			wantErr: false,
		},
		{
			name: "Valid AmEx card",
			card: &model.CardDetails{
				Number:   "378282246310005",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "1234",
				Name:     "Test User",
			},
			wantErr: false,
		},
		{
			name: "Invalid card number",
			card: &model.CardDetails{
				Number:   "4242424242424241", // Bad checksum
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "Test User",
			},
			wantErr:    true,
			wantReason: "invalid_card_number",
		},
		{
			name: "Invalid CVV for Visa",
			card: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "12", // Too short
				Name:     "Test User",
			},
			wantErr:    true,
			wantReason: "invalid_cvv",
		},
		{
			name: "Expired card",
			card: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "01",
				ExpYear:  intToStr(now.Year() - 1),
				CVV:      "123",
				Name:     "Test User",
			},
			wantErr:    true,
			wantReason: "card_expired",
		},
		{
			name:    "Nil card",
			card:    nil,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCard(tt.card)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateCard() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantReason != "" && err != nil {
				if validationErr, ok := err.(*CardValidationError); ok {
					if validationErr.Reason != tt.wantReason {
						t.Errorf("validateCard() reason = %v, wantReason %v", validationErr.Reason, tt.wantReason)
					}
				}
			}
		})
	}
}

func TestDetectCardBrand(t *testing.T) {
	tests := []struct {
		name      string
		cardNum   string
		wantBrand string
	}{
		{"Visa", "4242424242424242", "visa"},
		{"Visa (4111)", "4111111111111111", "visa"},
		{"Mastercard", "5555555555554444", "mastercard"},
		{"AmEx (34)", "343434343434343", "amex"},
		{"AmEx (37)", "378282246310005", "amex"},
		{"Discover", "6011111111111117", "discover"},
		{"Unknown (starts with 9)", "9999999999999999", "unknown"},
		{"Unknown (starts with 3, not AmEx)", "3111111111111111", "unknown"},
		{"Empty", "", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			brand := detectCardBrand(tt.cardNum)
			if brand != tt.wantBrand {
				t.Errorf("detectCardBrand(%q) = %v, want %v", tt.cardNum, brand, tt.wantBrand)
			}
		})
	}
}

func TestMaskCardInfo(t *testing.T) {
	tests := []struct {
		name      string
		last4     string
		brand     string
		want      string
	}{
		{"Full info", "1234", "visa", "visa:****1234"},
		{"No last4", "", "visa", "visa:****"},
		{"No brand", "1234", "", "****1234"},
		{"No info", "", "", "N/A"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskCardInfo(tt.last4, tt.brand)
			if got != tt.want {
				t.Errorf("maskCardInfo(%q, %q) = %v, want %v", tt.last4, tt.brand, got, tt.want)
			}
		})
	}
}

func TestMaskIdempotencyKey(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want string
	}{
		{"Long key", "abcdefghijklmnop", "abcd****mnop"},
		{"Exactly 8 chars", "12345678", "****"},
		{"Short key", "12345", "****"},
		{"Empty", "", "****"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskIdempotencyKey(tt.key)
			if got != tt.want {
				t.Errorf("maskIdempotencyKey(%q) = %v, want %v", tt.key, got, tt.want)
			}
		})
	}
}

// Helper function
func intToStr(i int) string {
	return string([]byte{
		byte(i/1000) + '0',
		byte((i/100)%10) + '0',
		byte((i/10)%10) + '0',
		byte(i%10) + '0',
	})
}

func TestMaskAccountNo(t *testing.T) {
	tests := []struct {
		name      string
		accountNo string
		want      string
	}{
		{"Normal account", "BANK1234567890", "BANK****7890"},
		{"Short account (8 chars)", "BANK1234", "BANK1234"},
		{"Very short", "BANK12", "BANK12"},
		{"Long account", "BANK12345678901234", "BANK****1234"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskAccountNo(tt.accountNo)
			if got != tt.want {
				t.Errorf("maskAccountNo(%q) = %v, want %v", tt.accountNo, got, tt.want)
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
		{"Korean 3 chars", "홍길동", "홍*동"},
		{"Korean 2 chars", "홍길", "홍*"},
		{"Korean 1 char", "홍", "홍"},
		{"English name", "John", "J*n"},
		{"Two chars", "AB", "A*"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := maskName(tt.input)
			if got != tt.want {
				t.Errorf("maskName(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestWalletCRUD(t *testing.T) {
	cfg := &config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	}
	svc := NewPaymentService(cfg)

	now := time.Now()
	futureYear := intToStr(now.Year() + 1)

	// Test Create Wallet
	t.Run("Create Wallet", func(t *testing.T) {
		req := &model.CreateWalletRequest{
			UserID: "USER_001",
			Name:   "내 카카오페이",
			Type:   model.WalletTypeKakao,
			DefaultCard: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "홍길동",
			},
		}

		wallet, err := svc.CreateWallet(req)
		if err != nil {
			t.Fatalf("CreateWallet failed: %v", err)
		}

		if wallet.ID == "" {
			t.Error("Wallet ID should not be empty")
		}
		if wallet.UserID != "USER_001" {
			t.Errorf("UserID = %v, want USER_001", wallet.UserID)
		}
		if wallet.Type != model.WalletTypeKakao {
			t.Errorf("Type = %v, want kakao", wallet.Type)
		}
		if wallet.CardLast4 != "4242" {
			t.Errorf("CardLast4 = %v, want 4242", wallet.CardLast4)
		}
		if wallet.CardBrand != "visa" {
			t.Errorf("CardBrand = %v, want visa", wallet.CardBrand)
		}
		if wallet.Status != model.WalletStatusActive {
			t.Errorf("Status = %v, want active", wallet.Status)
		}
	})

	// Test Create Wallet with invalid card
	t.Run("Create Wallet with invalid card", func(t *testing.T) {
		req := &model.CreateWalletRequest{
			UserID: "USER_002",
			Name:   "잘못된 지갑",
			Type:   model.WalletTypeNaver,
			DefaultCard: &model.CardDetails{
				Number:   "1234567890123456", // Invalid card number
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "홍길동",
			},
		}

		_, err := svc.CreateWallet(req)
		if err == nil {
			t.Error("CreateWallet should fail with invalid card")
		}
	})

	// Test Get Wallet
	t.Run("Get Wallet", func(t *testing.T) {
		// First create a wallet
		req := &model.CreateWalletRequest{
			UserID: "USER_003",
			Name:   "테스트 지갑",
			Type:   model.WalletTypeToss,
			DefaultCard: &model.CardDetails{
				Number:   "5555555555554444",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "테스트",
			},
		}
		created, _ := svc.CreateWallet(req)

		// Get the wallet
		wallet, err := svc.GetWallet(created.ID)
		if err != nil {
			t.Fatalf("GetWallet failed: %v", err)
		}
		if wallet.ID != created.ID {
			t.Errorf("Wallet ID mismatch")
		}
	})

	// Test Get Wallet - Not Found
	t.Run("Get Wallet Not Found", func(t *testing.T) {
		_, err := svc.GetWallet("nonexistent-id")
		if err != ErrWalletNotFound {
			t.Errorf("Expected ErrWalletNotFound, got %v", err)
		}
	})

	// Test Get Wallets By User
	t.Run("Get Wallets By User", func(t *testing.T) {
		// Create multiple wallets for a user
		for i := 0; i < 3; i++ {
			req := &model.CreateWalletRequest{
				UserID: "USER_MULTI",
				Name:   "지갑",
				Type:   model.WalletTypeKakao,
				DefaultCard: &model.CardDetails{
					Number:   "4242424242424242",
					ExpMonth: "12",
					ExpYear:  futureYear,
					CVV:      "123",
					Name:     "테스트",
				},
			}
			svc.CreateWallet(req)
		}

		wallets := svc.GetWalletsByUser("USER_MULTI")
		if len(wallets) != 3 {
			t.Errorf("Expected 3 wallets, got %d", len(wallets))
		}
	})

	// Test Delete Wallet
	t.Run("Delete Wallet", func(t *testing.T) {
		req := &model.CreateWalletRequest{
			UserID: "USER_DELETE",
			Name:   "삭제할 지갑",
			Type:   model.WalletTypePayco,
			DefaultCard: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "테스트",
			},
		}
		created, _ := svc.CreateWallet(req)

		err := svc.DeleteWallet(created.ID)
		if err != nil {
			t.Fatalf("DeleteWallet failed: %v", err)
		}

		// Verify wallet is inactive
		wallet, _ := svc.GetWallet(created.ID)
		if wallet.Status != model.WalletStatusInactive {
			t.Errorf("Status = %v, want inactive", wallet.Status)
		}
	})
}

func TestWalletPayment(t *testing.T) {
	cfg := &config.Config{
		SuccessRate:      100, // 100% success for testing
		BankSimulatorURL: "http://localhost:4350",
	}
	svc := NewPaymentService(cfg)

	now := time.Now()
	futureYear := intToStr(now.Year() + 1)

	// Create a wallet first
	walletReq := &model.CreateWalletRequest{
		UserID: "USER_PAY",
		Name:   "결제용 지갑",
		Type:   model.WalletTypeKakao,
		DefaultCard: &model.CardDetails{
			Number:   "4242424242424242",
			ExpMonth: "12",
			ExpYear:  futureYear,
			CVV:      "123",
			Name:     "홍길동",
		},
	}
	wallet, _ := svc.CreateWallet(walletReq)

	t.Run("Wallet Payment Success", func(t *testing.T) {
		req := &model.CreatePaymentRequest{
			MerchantID: "MERCHANT_001",
			OrderID:    "ORDER_WALLET_001",
			Amount:     "30000",
			Currency:   "KRW",
			Method:     model.PaymentMethodWallet,
			WalletID:   wallet.ID,
		}

		payment, err := svc.CreatePayment(req)
		if err != nil {
			t.Fatalf("CreatePayment failed: %v", err)
		}

		if payment.Status != model.PaymentStatusApproved {
			t.Errorf("Status = %v, want approved", payment.Status)
		}
		if payment.WalletID != wallet.ID {
			t.Errorf("WalletID = %v, want %v", payment.WalletID, wallet.ID)
		}
		if payment.WalletType != model.WalletTypeKakao {
			t.Errorf("WalletType = %v, want kakao", payment.WalletType)
		}
		if payment.CardLast4 != "4242" {
			t.Errorf("CardLast4 = %v, want 4242", payment.CardLast4)
		}
	})

	t.Run("Wallet Payment Without WalletID", func(t *testing.T) {
		req := &model.CreatePaymentRequest{
			MerchantID: "MERCHANT_001",
			OrderID:    "ORDER_WALLET_002",
			Amount:     "30000",
			Currency:   "KRW",
			Method:     model.PaymentMethodWallet,
			// WalletID is missing
		}

		_, err := svc.CreatePayment(req)
		if err != ErrWalletIDRequired {
			t.Errorf("Expected ErrWalletIDRequired, got %v", err)
		}
	})

	t.Run("Wallet Payment with Nonexistent Wallet", func(t *testing.T) {
		req := &model.CreatePaymentRequest{
			MerchantID: "MERCHANT_001",
			OrderID:    "ORDER_WALLET_003",
			Amount:     "30000",
			Currency:   "KRW",
			Method:     model.PaymentMethodWallet,
			WalletID:   "nonexistent-wallet-id",
		}

		_, err := svc.CreatePayment(req)
		if err != ErrWalletNotFound {
			t.Errorf("Expected ErrWalletNotFound, got %v", err)
		}
	})

	t.Run("Wallet Payment with Inactive Wallet", func(t *testing.T) {
		// Create and delete a wallet
		inactiveReq := &model.CreateWalletRequest{
			UserID: "USER_INACTIVE",
			Name:   "비활성 지갑",
			Type:   model.WalletTypeToss,
			DefaultCard: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "테스트",
			},
		}
		inactiveWallet, _ := svc.CreateWallet(inactiveReq)
		svc.DeleteWallet(inactiveWallet.ID)

		req := &model.CreatePaymentRequest{
			MerchantID: "MERCHANT_001",
			OrderID:    "ORDER_WALLET_004",
			Amount:     "30000",
			Currency:   "KRW",
			Method:     model.PaymentMethodWallet,
			WalletID:   inactiveWallet.ID,
		}

		_, err := svc.CreatePayment(req)
		if err != ErrWalletInactive {
			t.Errorf("Expected ErrWalletInactive, got %v", err)
		}
	})
}

func TestBankTransferPaymentValidation(t *testing.T) {
	cfg := &config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	}
	svc := NewPaymentService(cfg)

	t.Run("Bank Transfer Without BankAccount", func(t *testing.T) {
		req := &model.CreatePaymentRequest{
			MerchantID: "MERCHANT_001",
			OrderID:    "ORDER_BANK_001",
			Amount:     "50000",
			Currency:   "KRW",
			Method:     model.PaymentMethodBank,
			// BankAccount is missing
		}

		_, err := svc.CreatePayment(req)
		if err != ErrBankAccountRequired {
			t.Errorf("Expected ErrBankAccountRequired, got %v", err)
		}
	})
}

func TestCardPaymentRouting(t *testing.T) {
	cfg := &config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	}
	svc := NewPaymentService(cfg)

	now := time.Now()
	futureYear := intToStr(now.Year() + 1)

	t.Run("Card Payment Success", func(t *testing.T) {
		req := &model.CreatePaymentRequest{
			MerchantID: "MERCHANT_001",
			OrderID:    "ORDER_CARD_001",
			Amount:     "10000",
			Currency:   "KRW",
			Method:     model.PaymentMethodCard,
			Card: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "홍길동",
			},
		}

		payment, err := svc.CreatePayment(req)
		if err != nil {
			t.Fatalf("CreatePayment failed: %v", err)
		}

		if payment.Status != model.PaymentStatusApproved {
			t.Errorf("Status = %v, want approved", payment.Status)
		}
		if payment.Method != model.PaymentMethodCard {
			t.Errorf("Method = %v, want card", payment.Method)
		}
	})
}

func TestIdempotencyKey(t *testing.T) {
	cfg := &config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	}
	svc := NewPaymentService(cfg)

	now := time.Now()
	futureYear := intToStr(now.Year() + 1)

	t.Run("Idempotency Key Deduplication", func(t *testing.T) {
		idempotencyKey := "unique-key-12345"

		req := &model.CreatePaymentRequest{
			MerchantID:     "MERCHANT_001",
			OrderID:        "ORDER_IDEMP_001",
			Amount:         "10000",
			Currency:       "KRW",
			Method:         model.PaymentMethodCard,
			IdempotencyKey: idempotencyKey,
			Card: &model.CardDetails{
				Number:   "4242424242424242",
				ExpMonth: "12",
				ExpYear:  futureYear,
				CVV:      "123",
				Name:     "홍길동",
			},
		}

		// First request
		payment1, err := svc.CreatePayment(req)
		if err != nil {
			t.Fatalf("First CreatePayment failed: %v", err)
		}

		// Second request with same idempotency key
		payment2, err := svc.CreatePayment(req)
		if err != nil {
			t.Fatalf("Second CreatePayment failed: %v", err)
		}

		// Should return the same payment
		if payment1.ID != payment2.ID {
			t.Errorf("Expected same payment ID, got %v and %v", payment1.ID, payment2.ID)
		}
	})
}
