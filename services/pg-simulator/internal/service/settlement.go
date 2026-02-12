package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/stablenet/stable-platform/services/pg-simulator/internal/model"
)

// Settlement errors
var (
	ErrMerchantNotFound              = fmt.Errorf("merchant not found")
	ErrMerchantAlreadyExists         = fmt.Errorf("merchant already exists")
	ErrSettlementNotFound            = fmt.Errorf("settlement not found")
	ErrSettlementBatchNotFound       = fmt.Errorf("settlement batch not found")
	ErrInvalidAdjustmentType         = fmt.Errorf("invalid adjustment type")
	ErrInsufficientSettlementBalance = fmt.Errorf("deduction amount exceeds settlement balance")
)

const defaultFeeRate = "0.03"

// SettlementService handles settlement operations
type SettlementService struct {
	paymentService   *PaymentService
	merchants        map[string]*model.Merchant        // merchantID -> Merchant
	batches          map[string]*model.SettlementBatch  // batchID -> SettlementBatch
	settlements      map[string]*model.Settlement       // settlementID -> Settlement
	adjustments      map[string][]*model.Adjustment     // settlementID -> []Adjustment
	mu               sync.RWMutex
}

// NewSettlementService creates a new settlement service
func NewSettlementService(paymentService *PaymentService) *SettlementService {
	return &SettlementService{
		paymentService: paymentService,
		merchants:      make(map[string]*model.Merchant),
		batches:        make(map[string]*model.SettlementBatch),
		settlements:    make(map[string]*model.Settlement),
		adjustments:    make(map[string][]*model.Adjustment),
	}
}

// ========== Merchant Operations ==========

// RegisterMerchant registers a new merchant
func (s *SettlementService) RegisterMerchant(req *model.CreateMerchantRequest) (*model.Merchant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.merchants[req.ID]; exists {
		return nil, ErrMerchantAlreadyExists
	}

	now := time.Now()
	merchant := &model.Merchant{
		ID:                    req.ID,
		Name:                  req.Name,
		FeeRate:               req.FeeRate,
		SettlementBankAccount: req.SettlementBankAccount,
		Status:                "active",
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	s.merchants[req.ID] = merchant

	log.Printf("Merchant registered: %s (%s, FeeRate: %s)", merchant.ID, merchant.Name, merchant.FeeRate)

	return merchant, nil
}

// GetMerchant returns a merchant by ID
func (s *SettlementService) GetMerchant(merchantID string) (*model.Merchant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	merchant, exists := s.merchants[merchantID]
	if !exists {
		return nil, ErrMerchantNotFound
	}
	return merchant, nil
}

// ========== Settlement Batch Operations ==========

// ProcessSettlementBatch initiates a settlement batch
func (s *SettlementService) ProcessSettlementBatch(req *model.ProcessSettlementRequest) (*model.SettlementBatch, error) {
	now := time.Now()
	batch := &model.SettlementBatch{
		ID:        "batch_" + uuid.New().String()[:8],
		Status:    model.SettlementStatusProcessing,
		CreatedAt: now,
	}

	s.mu.Lock()
	s.batches[batch.ID] = batch
	s.mu.Unlock()

	// Execute settlement asynchronously
	go s.executeSettlementBatch(batch, req)

	return batch, nil
}

// GetSettlementBatch returns a settlement batch by ID
func (s *SettlementService) GetSettlementBatch(batchID string) (*model.SettlementBatch, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	batch, exists := s.batches[batchID]
	if !exists {
		return nil, ErrSettlementBatchNotFound
	}
	return batch, nil
}

// executeSettlementBatch processes the settlement batch asynchronously
func (s *SettlementService) executeSettlementBatch(batch *model.SettlementBatch, req *model.ProcessSettlementRequest) {
	// 1. Get eligible payments
	payments := s.getSettlementEligiblePayments(req)

	if len(payments) == 0 {
		s.mu.Lock()
		batch.Status = model.SettlementStatusCompleted
		batch.Summary = &model.BatchSummary{
			TotalGross:   "0.00",
			TotalFees:    "0.00",
			TotalNet:     "0.00",
			SuccessCount: 0,
			FailedCount:  0,
		}
		now := time.Now()
		batch.CompletedAt = &now
		s.mu.Unlock()

		log.Printf("Settlement batch completed (no eligible payments): %s", batch.ID)
		s.paymentService.enqueueWebhook("settlement.batch.completed", batch)
		return
	}

	// 2. Group by merchant
	merchantPayments := groupByMerchant(payments)

	var settlements []*model.Settlement
	var totalGross, totalFees, totalNet big.Float
	successCount, failedCount := 0, 0

	for merchantID, pmts := range merchantPayments {
		settlement := s.createSettlement(batch.ID, merchantID, pmts)

		s.mu.Lock()
		s.settlements[settlement.ID] = settlement
		s.mu.Unlock()

		// 3. Deposit to merchant bank account
		err := s.depositToMerchant(settlement)

		s.mu.Lock()
		if err == nil {
			settlement.Status = model.SettlementStatusCompleted
			now := time.Now()
			settlement.SettledAt = &now
			successCount++

			gross, _ := new(big.Float).SetString(settlement.GrossAmount)
			fees, _ := new(big.Float).SetString(settlement.FeeAmount)
			net, _ := new(big.Float).SetString(settlement.NetAmount)
			if gross != nil {
				totalGross.Add(&totalGross, gross)
			}
			if fees != nil {
				totalFees.Add(&totalFees, fees)
			}
			if net != nil {
				totalNet.Add(&totalNet, net)
			}

			// Mark payments as settled
			s.paymentService.markPaymentsSettled(settlement.PaymentIDs, settlement.SettledAt)

			log.Printf("Settlement completed: %s (Merchant: %s, Net: %s)",
				settlement.ID, merchantID, settlement.NetAmount)
		} else {
			settlement.Status = model.SettlementStatusFailed
			settlement.FailureReason = err.Error()
			failedCount++

			log.Printf("Settlement failed: %s (Merchant: %s, Error: %v)",
				settlement.ID, merchantID, err)
		}
		s.mu.Unlock()

		settlements = append(settlements, settlement)
	}

	// 4. Complete batch
	s.mu.Lock()
	batch.Settlements = settlements
	batch.Summary = &model.BatchSummary{
		TotalGross:   totalGross.Text('f', 2),
		TotalFees:    totalFees.Text('f', 2),
		TotalNet:     totalNet.Text('f', 2),
		SuccessCount: successCount,
		FailedCount:  failedCount,
	}
	batch.Status = model.SettlementStatusCompleted
	now := time.Now()
	batch.CompletedAt = &now
	s.mu.Unlock()

	log.Printf("Settlement batch completed: %s (Success: %d, Failed: %d, Net: %s)",
		batch.ID, successCount, failedCount, batch.Summary.TotalNet)

	// 5. Send webhook
	s.paymentService.enqueueWebhook("settlement.batch.completed", batch)
}

// getSettlementEligiblePayments returns payments eligible for settlement
// Uses PaymentService's public method instead of directly accessing its mutex
func (s *SettlementService) getSettlementEligiblePayments(req *model.ProcessSettlementRequest) []*model.Payment {
	var fromDate, toDate time.Time
	if req.FromDate != "" {
		fromDate, _ = time.Parse("2006-01-02", req.FromDate)
	}
	if req.ToDate != "" {
		toDate, _ = time.Parse("2006-01-02", req.ToDate)
		// Include the entire end date
		toDate = toDate.Add(24*time.Hour - time.Nanosecond)
	} else {
		toDate = time.Now()
	}

	return s.paymentService.GetEligiblePayments(req.MerchantID, fromDate, toDate)
}

// groupByMerchant groups payments by merchant ID
func groupByMerchant(payments []*model.Payment) map[string][]*model.Payment {
	result := make(map[string][]*model.Payment)
	for _, p := range payments {
		result[p.MerchantID] = append(result[p.MerchantID], p)
	}
	return result
}

// createSettlement creates a settlement record for a merchant
func (s *SettlementService) createSettlement(batchID, merchantID string, payments []*model.Payment) *model.Settlement {
	s.mu.RLock()
	merchant, exists := s.merchants[merchantID]
	s.mu.RUnlock()

	feeRate := defaultFeeRate
	bankAccountNo := ""
	if exists {
		feeRate = merchant.FeeRate
		bankAccountNo = merchant.SettlementBankAccount
	}

	var gross big.Float
	var paymentIDs []string

	for _, p := range payments {
		amount, _ := new(big.Float).SetString(p.Amount)
		if amount != nil {
			gross.Add(&gross, amount)
		}
		paymentIDs = append(paymentIDs, p.ID)
	}

	// Calculate fees
	feeRateVal, _ := new(big.Float).SetString(feeRate)
	if feeRateVal == nil {
		feeRateVal = new(big.Float).SetFloat64(0.03)
	}
	fee := new(big.Float).Mul(&gross, feeRateVal)
	net := new(big.Float).Sub(&gross, fee)

	return &model.Settlement{
		ID:            "settle_" + uuid.New().String()[:8],
		BatchID:       batchID,
		MerchantID:    merchantID,
		PaymentCount:  len(payments),
		PaymentIDs:    paymentIDs,
		GrossAmount:   gross.Text('f', 2),
		FeeAmount:     fee.Text('f', 2),
		NetAmount:     net.Text('f', 2),
		BankAccountNo: bankAccountNo,
		Status:        model.SettlementStatusPending,
		CreatedAt:     time.Now(),
	}
}

// depositToMerchant deposits settlement amount to merchant bank account
func (s *SettlementService) depositToMerchant(settlement *model.Settlement) error {
	if settlement.BankAccountNo == "" {
		return fmt.Errorf("merchant has no settlement bank account")
	}

	reqBody := map[string]string{
		"amount":      settlement.NetAmount,
		"reference":   settlement.ID,
		"description": fmt.Sprintf("PG settlement (%d payments)", settlement.PaymentCount),
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal deposit request: %w", err)
	}

	bankClient := s.paymentService.bankClient
	resp, err := bankClient.httpClient.Post(
		bankClient.baseURL+"/api/v1/accounts/"+settlement.BankAccountNo+"/deposit",
		"application/json",
		newBuffer(body),
	)
	if err != nil {
		return fmt.Errorf("bank deposit failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("bank deposit returned status %d", resp.StatusCode)
	}

	var result struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
		settlement.TransactionID = result.ID
	}

	return nil
}

// GetEligiblePayments returns payments matching settlement criteria with proper locking
func (s *PaymentService) GetEligiblePayments(merchantID string, fromDate, toDate time.Time) []*model.Payment {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var eligible []*model.Payment
	for _, p := range s.payments {
		if p.Status != model.PaymentStatusApproved {
			continue
		}
		if p.SettledAt != nil {
			continue
		}
		if merchantID != "" && p.MerchantID != merchantID {
			continue
		}
		if !fromDate.IsZero() && p.CreatedAt.Before(fromDate) {
			continue
		}
		if !toDate.IsZero() && p.CreatedAt.After(toDate) {
			continue
		}
		eligible = append(eligible, p)
	}
	return eligible
}

// markPaymentsSettled marks payments as settled (called from settlement service)
func (s *PaymentService) markPaymentsSettled(paymentIDs []string, settledAt *time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, pid := range paymentIDs {
		if p, ok := s.payments[pid]; ok {
			p.SettledAt = settledAt
		}
	}
}

// ========== Merchant Settlement History ==========

// GetMerchantSettlements returns settlement history for a merchant
func (s *SettlementService) GetMerchantSettlements(merchantID, status, fromDate, toDate string) *model.MerchantSettlementsResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var from, to time.Time
	if fromDate != "" {
		from, _ = time.Parse("2006-01-02", fromDate)
	}
	if toDate != "" {
		to, _ = time.Parse("2006-01-02", toDate)
		to = to.Add(24*time.Hour - time.Nanosecond)
	}

	var result []*model.Settlement
	for _, settlement := range s.settlements {
		if settlement.MerchantID != merchantID {
			continue
		}
		if status != "" && string(settlement.Status) != status {
			continue
		}
		if !from.IsZero() && settlement.CreatedAt.Before(from) {
			continue
		}
		if !to.IsZero() && settlement.CreatedAt.After(to) {
			continue
		}
		result = append(result, settlement)
	}

	return &model.MerchantSettlementsResponse{
		Settlements: result,
		Total:       len(result),
	}
}

// ========== Adjustment Operations ==========

// CreateAdjustment creates a settlement adjustment
func (s *SettlementService) CreateAdjustment(settlementID string, req *model.CreateAdjustmentRequest) (*model.Adjustment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Find settlement
	settlement, exists := s.settlements[settlementID]
	if !exists {
		return nil, ErrSettlementNotFound
	}

	// 2. Validate adjustment type
	if req.Type != model.AdjustmentTypeDeduction && req.Type != model.AdjustmentTypeAddition {
		return nil, ErrInvalidAdjustmentType
	}

	// 3. Parse amounts
	adjAmount, _, err := big.ParseFloat(req.Amount, 10, 128, big.ToNearestEven)
	if err != nil || adjAmount == nil {
		return nil, fmt.Errorf("invalid adjustment amount: %s", req.Amount)
	}

	currentNet, _, _ := big.ParseFloat(settlement.NetAmount, 10, 128, big.ToNearestEven)
	if currentNet == nil {
		return nil, fmt.Errorf("invalid settlement net amount")
	}

	// 4. Check deduction doesn't exceed balance
	if req.Type == model.AdjustmentTypeDeduction {
		if adjAmount.Cmp(currentNet) > 0 {
			return nil, ErrInsufficientSettlementBalance
		}
	}

	// 5. Calculate new balance
	balanceBefore := settlement.NetAmount
	var newBalance *big.Float
	if req.Type == model.AdjustmentTypeDeduction {
		newBalance = new(big.Float).Sub(currentNet, adjAmount)
	} else {
		newBalance = new(big.Float).Add(currentNet, adjAmount)
	}
	settlement.NetAmount = newBalance.Text('f', 2)

	// 6. Create adjustment record
	adj := &model.Adjustment{
		ID:            "adj_" + uuid.New().String()[:8],
		SettlementID:  settlementID,
		MerchantID:    settlement.MerchantID,
		Type:          req.Type,
		Amount:        req.Amount,
		Reason:        req.Reason,
		ReferenceID:   req.ReferenceID,
		Description:   req.Description,
		Status:        "applied",
		BalanceBefore: balanceBefore,
		BalanceAfter:  settlement.NetAmount,
		CreatedAt:     time.Now(),
	}

	s.adjustments[settlementID] = append(s.adjustments[settlementID], adj)

	log.Printf("Adjustment created: %s (Settlement: %s, Type: %s, Amount: %s, NewBalance: %s)",
		adj.ID, settlementID, req.Type, req.Amount, settlement.NetAmount)

	// 7. Send webhook
	s.paymentService.enqueueWebhook("settlement.adjusted", adj)

	return adj, nil
}

// GetAdjustments returns adjustments for a settlement
func (s *SettlementService) GetAdjustments(settlementID string) (*model.AdjustmentsResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	settlement, exists := s.settlements[settlementID]
	if !exists {
		return nil, ErrSettlementNotFound
	}

	adjs := s.adjustments[settlementID]

	// Calculate summary
	var totalDeductions, totalAdditions big.Float
	for _, adj := range adjs {
		amount, _ := new(big.Float).SetString(adj.Amount)
		if amount == nil {
			continue
		}
		if adj.Type == model.AdjustmentTypeDeduction {
			totalDeductions.Add(&totalDeductions, amount)
		} else {
			totalAdditions.Add(&totalAdditions, amount)
		}
	}

	netAdj := new(big.Float).Sub(&totalAdditions, &totalDeductions)
	netAdjStr := netAdj.Text('f', 2)
	// Add sign for negative
	if netAdj.Sign() < 0 {
		netAdjStr = netAdj.Text('f', 2)
	}

	return &model.AdjustmentsResponse{
		Adjustments: adjs,
		Summary: &model.AdjustmentSummary{
			TotalDeductions:   totalDeductions.Text('f', 2),
			TotalAdditions:    totalAdditions.Text('f', 2),
			NetAdjustment:     netAdjStr,
			AdjustedNetAmount: settlement.NetAmount,
		},
	}, nil
}

// newBuffer creates a bytes buffer from data
func newBuffer(data []byte) *bytes.Buffer {
	return bytes.NewBuffer(data)
}
