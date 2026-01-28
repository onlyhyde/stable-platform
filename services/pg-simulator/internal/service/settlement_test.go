package service

import (
	"testing"
	"time"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/config"
	"github.com/stablenet/stable-platform/services/pg-simulator/internal/model"
)

func TestRegisterMerchant(t *testing.T) {
	paymentSvc := NewPaymentService(&config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	})
	settlementSvc := NewSettlementService(paymentSvc)

	tests := []struct {
		name      string
		req       *model.CreateMerchantRequest
		wantErr   error
		runBefore func()
	}{
		{
			name: "Register new merchant",
			req: &model.CreateMerchantRequest{
				ID:                    "MERCHANT_001",
				Name:                  "Test Merchant",
				FeeRate:               "0.025",
				SettlementBankAccount: "BANK123456789",
			},
			wantErr: nil,
		},
		{
			name: "Register duplicate merchant",
			req: &model.CreateMerchantRequest{
				ID:                    "MERCHANT_DUP",
				Name:                  "Duplicate Merchant",
				FeeRate:               "0.03",
				SettlementBankAccount: "BANK987654321",
			},
			wantErr: ErrMerchantAlreadyExists,
			runBefore: func() {
				settlementSvc.RegisterMerchant(&model.CreateMerchantRequest{
					ID:                    "MERCHANT_DUP",
					Name:                  "Original Merchant",
					FeeRate:               "0.02",
					SettlementBankAccount: "BANK111111111",
				})
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.runBefore != nil {
				tt.runBefore()
			}

			merchant, err := settlementSvc.RegisterMerchant(tt.req)

			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Errorf("RegisterMerchant() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}

			if err != nil {
				t.Fatalf("RegisterMerchant() unexpected error: %v", err)
			}

			if merchant.ID != tt.req.ID {
				t.Errorf("Merchant ID = %v, want %v", merchant.ID, tt.req.ID)
			}
			if merchant.Name != tt.req.Name {
				t.Errorf("Merchant Name = %v, want %v", merchant.Name, tt.req.Name)
			}
			if merchant.FeeRate != tt.req.FeeRate {
				t.Errorf("Merchant FeeRate = %v, want %v", merchant.FeeRate, tt.req.FeeRate)
			}
			if merchant.Status != "active" {
				t.Errorf("Merchant Status = %v, want active", merchant.Status)
			}
		})
	}
}

func TestGetMerchant(t *testing.T) {
	paymentSvc := NewPaymentService(&config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	})
	settlementSvc := NewSettlementService(paymentSvc)

	// Register a merchant first
	settlementSvc.RegisterMerchant(&model.CreateMerchantRequest{
		ID:                    "MERCHANT_GET",
		Name:                  "Get Test Merchant",
		FeeRate:               "0.025",
		SettlementBankAccount: "BANK123456789",
	})

	tests := []struct {
		name       string
		merchantID string
		wantErr    error
	}{
		{
			name:       "Get existing merchant",
			merchantID: "MERCHANT_GET",
			wantErr:    nil,
		},
		{
			name:       "Get non-existent merchant",
			merchantID: "NONEXISTENT",
			wantErr:    ErrMerchantNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			merchant, err := settlementSvc.GetMerchant(tt.merchantID)

			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Errorf("GetMerchant() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}

			if err != nil {
				t.Fatalf("GetMerchant() unexpected error: %v", err)
			}

			if merchant.ID != tt.merchantID {
				t.Errorf("Merchant ID = %v, want %v", merchant.ID, tt.merchantID)
			}
		})
	}
}

func TestGetSettlementBatch(t *testing.T) {
	paymentSvc := NewPaymentService(&config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	})
	settlementSvc := NewSettlementService(paymentSvc)

	// Process a settlement batch to create one
	batch, _ := settlementSvc.ProcessSettlementBatch(&model.ProcessSettlementRequest{})

	tests := []struct {
		name    string
		batchID string
		wantErr error
	}{
		{
			name:    "Get existing batch",
			batchID: batch.ID,
			wantErr: nil,
		},
		{
			name:    "Get non-existent batch",
			batchID: "batch_nonexistent",
			wantErr: ErrSettlementBatchNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := settlementSvc.GetSettlementBatch(tt.batchID)

			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Errorf("GetSettlementBatch() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}

			if err != nil {
				t.Fatalf("GetSettlementBatch() unexpected error: %v", err)
			}

			if result.ID != tt.batchID {
				t.Errorf("Batch ID = %v, want %v", result.ID, tt.batchID)
			}
		})
	}
}

func TestGroupByMerchant(t *testing.T) {
	payments := []*model.Payment{
		{ID: "pay_1", MerchantID: "MERCHANT_A"},
		{ID: "pay_2", MerchantID: "MERCHANT_A"},
		{ID: "pay_3", MerchantID: "MERCHANT_B"},
		{ID: "pay_4", MerchantID: "MERCHANT_A"},
		{ID: "pay_5", MerchantID: "MERCHANT_C"},
	}

	result := groupByMerchant(payments)

	if len(result) != 3 {
		t.Errorf("Expected 3 merchants, got %d", len(result))
	}

	if len(result["MERCHANT_A"]) != 3 {
		t.Errorf("Expected 3 payments for MERCHANT_A, got %d", len(result["MERCHANT_A"]))
	}

	if len(result["MERCHANT_B"]) != 1 {
		t.Errorf("Expected 1 payment for MERCHANT_B, got %d", len(result["MERCHANT_B"]))
	}

	if len(result["MERCHANT_C"]) != 1 {
		t.Errorf("Expected 1 payment for MERCHANT_C, got %d", len(result["MERCHANT_C"]))
	}
}

func TestCreateAdjustment(t *testing.T) {
	paymentSvc := NewPaymentService(&config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	})
	settlementSvc := NewSettlementService(paymentSvc)

	// Create a test settlement
	settlementID := "settle_test001"
	settlementSvc.settlements[settlementID] = &model.Settlement{
		ID:          settlementID,
		MerchantID:  "MERCHANT_001",
		GrossAmount: "10000.00",
		FeeAmount:   "300.00",
		NetAmount:   "9700.00",
		Status:      model.SettlementStatusCompleted,
		CreatedAt:   time.Now(),
	}

	tests := []struct {
		name         string
		settlementID string
		req          *model.CreateAdjustmentRequest
		wantErr      error
		wantBalance  string
	}{
		{
			name:         "Deduction adjustment",
			settlementID: settlementID,
			req: &model.CreateAdjustmentRequest{
				Type:        model.AdjustmentTypeDeduction,
				Amount:      "500.00",
				Reason:      "refund",
				Description: "Customer refund",
			},
			wantErr:     nil,
			wantBalance: "9200.00",
		},
		{
			name:         "Addition adjustment",
			settlementID: settlementID,
			req: &model.CreateAdjustmentRequest{
				Type:        model.AdjustmentTypeAddition,
				Amount:      "100.00",
				Reason:      "correction",
				Description: "Fee correction",
			},
			wantErr:     nil,
			wantBalance: "9300.00",
		},
		{
			name:         "Invalid adjustment type",
			settlementID: settlementID,
			req: &model.CreateAdjustmentRequest{
				Type:   "invalid",
				Amount: "100.00",
				Reason: "test",
			},
			wantErr: ErrInvalidAdjustmentType,
		},
		{
			name:         "Settlement not found",
			settlementID: "nonexistent",
			req: &model.CreateAdjustmentRequest{
				Type:   model.AdjustmentTypeDeduction,
				Amount: "100.00",
				Reason: "test",
			},
			wantErr: ErrSettlementNotFound,
		},
		{
			name:         "Deduction exceeds balance",
			settlementID: settlementID,
			req: &model.CreateAdjustmentRequest{
				Type:   model.AdjustmentTypeDeduction,
				Amount: "99999.00",
				Reason: "excessive",
			},
			wantErr: ErrInsufficientSettlementBalance,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			adj, err := settlementSvc.CreateAdjustment(tt.settlementID, tt.req)

			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Errorf("CreateAdjustment() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}

			if err != nil {
				t.Fatalf("CreateAdjustment() unexpected error: %v", err)
			}

			if adj.Type != tt.req.Type {
				t.Errorf("Adjustment Type = %v, want %v", adj.Type, tt.req.Type)
			}

			if adj.Amount != tt.req.Amount {
				t.Errorf("Adjustment Amount = %v, want %v", adj.Amount, tt.req.Amount)
			}

			if adj.BalanceAfter != tt.wantBalance {
				t.Errorf("BalanceAfter = %v, want %v", adj.BalanceAfter, tt.wantBalance)
			}
		})
	}
}

func TestGetAdjustments(t *testing.T) {
	paymentSvc := NewPaymentService(&config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	})
	settlementSvc := NewSettlementService(paymentSvc)

	// Create a test settlement with adjustments
	settlementID := "settle_adj_test"
	settlementSvc.settlements[settlementID] = &model.Settlement{
		ID:          settlementID,
		MerchantID:  "MERCHANT_001",
		GrossAmount: "10000.00",
		FeeAmount:   "300.00",
		NetAmount:   "9700.00",
		Status:      model.SettlementStatusCompleted,
		CreatedAt:   time.Now(),
	}

	// Add some adjustments
	settlementSvc.CreateAdjustment(settlementID, &model.CreateAdjustmentRequest{
		Type:   model.AdjustmentTypeDeduction,
		Amount: "200.00",
		Reason: "refund",
	})
	settlementSvc.CreateAdjustment(settlementID, &model.CreateAdjustmentRequest{
		Type:   model.AdjustmentTypeAddition,
		Amount: "50.00",
		Reason: "bonus",
	})

	tests := []struct {
		name         string
		settlementID string
		wantErr      error
		wantCount    int
	}{
		{
			name:         "Get existing adjustments",
			settlementID: settlementID,
			wantErr:      nil,
			wantCount:    2,
		},
		{
			name:         "Settlement not found",
			settlementID: "nonexistent",
			wantErr:      ErrSettlementNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := settlementSvc.GetAdjustments(tt.settlementID)

			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Errorf("GetAdjustments() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}

			if err != nil {
				t.Fatalf("GetAdjustments() unexpected error: %v", err)
			}

			if len(result.Adjustments) != tt.wantCount {
				t.Errorf("Adjustment count = %d, want %d", len(result.Adjustments), tt.wantCount)
			}

			// Verify summary calculations
			if result.Summary == nil {
				t.Fatal("Summary should not be nil")
			}
		})
	}
}

func TestGetMerchantSettlements(t *testing.T) {
	paymentSvc := NewPaymentService(&config.Config{
		SuccessRate:      100,
		BankSimulatorURL: "http://localhost:4350",
	})
	settlementSvc := NewSettlementService(paymentSvc)

	// Create test settlements
	now := time.Now()
	settlementSvc.settlements["settle_1"] = &model.Settlement{
		ID:         "settle_1",
		MerchantID: "MERCHANT_HIST",
		Status:     model.SettlementStatusCompleted,
		CreatedAt:  now,
	}
	settlementSvc.settlements["settle_2"] = &model.Settlement{
		ID:         "settle_2",
		MerchantID: "MERCHANT_HIST",
		Status:     model.SettlementStatusCompleted,
		CreatedAt:  now.Add(-24 * time.Hour),
	}
	settlementSvc.settlements["settle_3"] = &model.Settlement{
		ID:         "settle_3",
		MerchantID: "MERCHANT_OTHER",
		Status:     model.SettlementStatusCompleted,
		CreatedAt:  now,
	}

	t.Run("Get settlements for merchant", func(t *testing.T) {
		result := settlementSvc.GetMerchantSettlements("MERCHANT_HIST", "", "", "")

		if result.Total != 2 {
			t.Errorf("Total = %d, want 2", result.Total)
		}
	})

	t.Run("Get settlements with status filter", func(t *testing.T) {
		result := settlementSvc.GetMerchantSettlements("MERCHANT_HIST", "completed", "", "")

		if result.Total != 2 {
			t.Errorf("Total = %d, want 2", result.Total)
		}
	})

	t.Run("Get settlements for non-existent merchant", func(t *testing.T) {
		result := settlementSvc.GetMerchantSettlements("NONEXISTENT", "", "", "")

		if result.Total != 0 {
			t.Errorf("Total = %d, want 0", result.Total)
		}
	})
}

func TestNewBuffer(t *testing.T) {
	data := []byte("test data")
	buf := newBuffer(data)

	if buf.String() != "test data" {
		t.Errorf("newBuffer() = %v, want 'test data'", buf.String())
	}
}
