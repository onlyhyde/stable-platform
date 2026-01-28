package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// BankClient is a client for bank-simulator API
type BankClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewBankClient creates a new bank client
func NewBankClient(baseURL string) *BankClient {
	return &BankClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// VerifyAccountRequest represents a request to verify account holder
type VerifyAccountRequest struct {
	AccountNo  string `json:"accountNo"`
	HolderName string `json:"holderName"`
}

// VerifyAccountResponse represents the response from account verification
type VerifyAccountResponse struct {
	Verified   bool   `json:"verified"`
	AccountNo  string `json:"accountNo,omitempty"`
	MaskedName string `json:"maskedName,omitempty"`
	Status     string `json:"status,omitempty"`
	Reason     string `json:"reason,omitempty"`
}

// CreateDebitRequest represents a request to create a direct debit
type CreateDebitRequest struct {
	IdempotencyKey string `json:"idempotencyKey"`
	AccountNo      string `json:"accountNo"`
	Amount         string `json:"amount"`
	Currency       string `json:"currency"`
	CreditorID     string `json:"creditorId"`
	CreditorName   string `json:"creditorName"`
	Reference      string `json:"reference,omitempty"`
	Description    string `json:"description,omitempty"`
	AutoApprove    bool   `json:"autoApprove"`
}

// DebitResponse represents the response from a debit request
type DebitResponse struct {
	ID             string `json:"id"`
	IdempotencyKey string `json:"idempotencyKey"`
	AccountNo      string `json:"accountNo"`
	Amount         string `json:"amount"`
	Currency       string `json:"currency"`
	CreditorID     string `json:"creditorId"`
	CreditorName   string `json:"creditorName"`
	Status         string `json:"status"`
	FailureReason  string `json:"failureReason,omitempty"`
	TransactionID  string `json:"transactionId,omitempty"`
}

// DepositRequest represents a request to deposit funds (for refunds)
type DepositRequest struct {
	Amount      string `json:"amount"`
	Reference   string `json:"reference"`
	Description string `json:"description"`
}

// DepositResponse represents the response from a deposit request
type DepositResponse struct {
	ID            string `json:"id"`
	AccountNo     string `json:"accountNo"`
	Amount        string `json:"amount"`
	Status        string `json:"status"`
	TransactionID string `json:"transactionId"`
}

// VerifyAccount verifies that an account exists and the holder name matches
func (c *BankClient) VerifyAccount(accountNo, holderName string) (*VerifyAccountResponse, error) {
	req := VerifyAccountRequest{
		AccountNo:  accountNo,
		HolderName: holderName,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/accounts/verify",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		log.Printf("Bank verify account request failed: %v", err)
		return nil, fmt.Errorf("failed to connect to bank: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("Bank verify account returned status %d: %s", resp.StatusCode, string(respBody))
		return nil, fmt.Errorf("bank returned status %d", resp.StatusCode)
	}

	var result VerifyAccountResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// RequestDebit sends a direct debit request to the bank
func (c *BankClient) RequestDebit(accountNo, amount, currency, reference string, autoApprove bool) (*DebitResponse, error) {
	req := CreateDebitRequest{
		IdempotencyKey: fmt.Sprintf("ONRAMP_%s_%d", reference, time.Now().UnixNano()),
		AccountNo:      accountNo,
		Amount:         amount,
		Currency:       currency,
		CreditorID:     "ONRAMP_SIMULATOR",
		CreditorName:   "Onramp Service",
		Reference:      reference,
		Description:    "Crypto purchase via Onramp",
		AutoApprove:    autoApprove,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/debit-requests",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		log.Printf("Bank debit request failed: %v", err)
		return nil, fmt.Errorf("failed to connect to bank: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		log.Printf("Bank debit request returned status %d: %s", resp.StatusCode, string(respBody))
		return nil, fmt.Errorf("bank returned status %d", resp.StatusCode)
	}

	var result DebitResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// Deposit sends a deposit request to the bank (for refunds)
func (c *BankClient) Deposit(accountNo, amount, reference, description string) (*DepositResponse, error) {
	req := DepositRequest{
		Amount:      amount,
		Reference:   reference,
		Description: description,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/accounts/"+accountNo+"/deposit",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		log.Printf("Bank deposit request failed: %v", err)
		return nil, fmt.Errorf("failed to connect to bank: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("Bank deposit returned status %d: %s", resp.StatusCode, string(respBody))
		return nil, fmt.Errorf("bank returned status %d", resp.StatusCode)
	}

	var result DepositResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
