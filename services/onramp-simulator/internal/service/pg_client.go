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

// PGClient is a client for pg-simulator API
type PGClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewPGClient creates a new PG client
func NewPGClient(baseURL string) *PGClient {
	return &PGClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// CheckoutSessionRequest represents a request to create a checkout session
type CheckoutSessionRequest struct {
	MerchantID    string `json:"merchantId"`
	OrderID       string `json:"orderId"`
	OrderName     string `json:"orderName"`
	Amount        string `json:"amount"`
	Currency      string `json:"currency"`
	CustomerEmail string `json:"customerEmail,omitempty"`
	ReturnURL     string `json:"returnUrl"`
	CancelURL     string `json:"cancelUrl"`
}

// CheckoutSessionResponse represents the response from creating a checkout session
type CheckoutSessionResponse struct {
	ID          string    `json:"id"`
	MerchantID  string    `json:"merchantId"`
	OrderID     string    `json:"orderId"`
	CheckoutURL string    `json:"checkoutUrl"`
	Amount      string    `json:"amount"`
	Currency    string    `json:"currency"`
	Status      string    `json:"status"`
	ExpiresAt   time.Time `json:"expiresAt"`
	CreatedAt   time.Time `json:"createdAt"`
}

// RefundRequest represents a refund request
type RefundRequest struct {
	PaymentID string `json:"paymentId"`
	Amount    string `json:"amount"`
	Reason    string `json:"reason"`
}

// RefundResponse represents the response from a refund request
type RefundResponse struct {
	ID        string `json:"id"`
	PaymentID string `json:"paymentId"`
	Amount    string `json:"amount"`
	Status    string `json:"status"`
	Reason    string `json:"reason"`
}

// CreateCheckoutSession creates a new checkout session
func (c *PGClient) CreateCheckoutSession(req *CheckoutSessionRequest) (*CheckoutSessionResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/checkout-sessions",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		log.Printf("PG create checkout session failed: %v", err)
		return nil, fmt.Errorf("failed to connect to PG: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		log.Printf("PG create checkout session returned status %d: %s", resp.StatusCode, string(respBody))
		return nil, fmt.Errorf("PG returned status %d", resp.StatusCode)
	}

	var result CheckoutSessionResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// RequestRefund sends a refund request to PG
func (c *PGClient) RequestRefund(paymentID, amount, reason string) (*RefundResponse, error) {
	req := RefundRequest{
		PaymentID: paymentID,
		Amount:    amount,
		Reason:    reason,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/refunds",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		log.Printf("PG refund request failed: %v", err)
		return nil, fmt.Errorf("failed to connect to PG: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		log.Printf("PG refund request returned status %d: %s", resp.StatusCode, string(respBody))
		return nil, fmt.Errorf("PG returned status %d", resp.StatusCode)
	}

	var result RefundResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
