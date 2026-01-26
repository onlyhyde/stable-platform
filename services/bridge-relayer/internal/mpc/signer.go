package mpc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
)

// SignerClient manages MPC signature collection
type SignerClient struct {
	endpoints    []string
	threshold    int
	totalSigners int
	timeout      time.Duration
	httpClient   *http.Client

	mu          sync.RWMutex
	signerStatus map[int]bool // Track which signers are online
}

// NewSignerClient creates a new MPC signer client
func NewSignerClient(cfg config.MPCConfig) *SignerClient {
	return &SignerClient{
		endpoints:    cfg.SignerEndpoints,
		threshold:    cfg.Threshold,
		totalSigners: cfg.TotalSigners,
		timeout:      cfg.Timeout,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
		signerStatus: make(map[int]bool),
	}
}

// CollectSignatures collects signatures from MPC signers for a bridge message
func (c *SignerClient) CollectSignatures(ctx context.Context, msg domain.BridgeMessage) ([][]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	// Channel to collect signature responses
	responseChan := make(chan domain.SignatureResponse, c.totalSigners)
	var wg sync.WaitGroup

	// Request signatures from all signers in parallel
	for i, endpoint := range c.endpoints {
		if i >= c.totalSigners {
			break
		}
		wg.Add(1)
		go func(signerID int, endpoint string) {
			defer wg.Done()
			c.requestSignature(ctx, signerID, endpoint, msg, responseChan)
		}(i, endpoint)
	}

	// Close response channel when all goroutines complete
	go func() {
		wg.Wait()
		close(responseChan)
	}()

	// Collect signatures
	var signatures [][]byte
	var errors []string

	for resp := range responseChan {
		if resp.Error != "" {
			errors = append(errors, fmt.Sprintf("signer %d: %s", resp.SignerID, resp.Error))
			c.signerStatus[resp.SignerID] = false
			continue
		}

		if len(resp.Signature) > 0 {
			signatures = append(signatures, resp.Signature)
			c.signerStatus[resp.SignerID] = true
		}

		// Check if we have enough signatures
		if len(signatures) >= c.threshold {
			break
		}
	}

	if len(signatures) < c.threshold {
		return nil, fmt.Errorf("insufficient signatures: got %d, need %d. Errors: %v",
			len(signatures), c.threshold, errors)
	}

	return signatures[:c.threshold], nil
}

// requestSignature requests a signature from a single MPC signer
func (c *SignerClient) requestSignature(
	ctx context.Context,
	signerID int,
	endpoint string,
	msg domain.BridgeMessage,
	responseChan chan<- domain.SignatureResponse,
) {
	req := domain.SignatureRequest{
		Message:     msg,
		SignerID:    signerID,
		RequestedAt: time.Now(),
	}

	reqBody, err := json.Marshal(req)
	if err != nil {
		responseChan <- domain.SignatureResponse{
			SignerID: signerID,
			Error:    fmt.Sprintf("failed to marshal request: %v", err),
		}
		return
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint+"/sign", bytes.NewReader(reqBody))
	if err != nil {
		responseChan <- domain.SignatureResponse{
			SignerID: signerID,
			Error:    fmt.Sprintf("failed to create request: %v", err),
		}
		return
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		responseChan <- domain.SignatureResponse{
			SignerID: signerID,
			Error:    fmt.Sprintf("request failed: %v", err),
		}
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		responseChan <- domain.SignatureResponse{
			SignerID: signerID,
			Error:    fmt.Sprintf("signer returned status %d", resp.StatusCode),
		}
		return
	}

	var sigResp domain.SignatureResponse
	if err := json.NewDecoder(resp.Body).Decode(&sigResp); err != nil {
		responseChan <- domain.SignatureResponse{
			SignerID: signerID,
			Error:    fmt.Sprintf("failed to decode response: %v", err),
		}
		return
	}

	sigResp.SignerID = signerID
	responseChan <- sigResp
}

// HealthCheck checks the health of all MPC signers
func (c *SignerClient) HealthCheck(ctx context.Context) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	results := make(chan struct {
		signerID int
		online   bool
	}, c.totalSigners)

	for i, endpoint := range c.endpoints {
		if i >= c.totalSigners {
			break
		}
		wg.Add(1)
		go func(signerID int, endpoint string) {
			defer wg.Done()
			online := c.checkSignerHealth(ctx, endpoint)
			results <- struct {
				signerID int
				online   bool
			}{signerID, online}
		}(i, endpoint)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	onlineCount := 0
	for result := range results {
		c.signerStatus[result.signerID] = result.online
		if result.online {
			onlineCount++
		}
	}

	return onlineCount, nil
}

// checkSignerHealth checks if a single signer is healthy
func (c *SignerClient) checkSignerHealth(ctx context.Context, endpoint string) bool {
	req, err := http.NewRequestWithContext(ctx, "GET", endpoint+"/health", nil)
	if err != nil {
		return false
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// GetOnlineSignerCount returns the number of online signers
func (c *SignerClient) GetOnlineSignerCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	count := 0
	for _, online := range c.signerStatus {
		if online {
			count++
		}
	}
	return count
}

// HasQuorum returns true if enough signers are online for threshold
func (c *SignerClient) HasQuorum() bool {
	return c.GetOnlineSignerCount() >= c.threshold
}

// GetThreshold returns the required signature threshold
func (c *SignerClient) GetThreshold() int {
	return c.threshold
}

// GetTotalSigners returns the total number of signers
func (c *SignerClient) GetTotalSigners() int {
	return c.totalSigners
}

// SimulateSignatures generates simulated signatures for testing
func (c *SignerClient) SimulateSignatures(msg domain.BridgeMessage) ([][]byte, error) {
	signatures := make([][]byte, c.threshold)
	for i := 0; i < c.threshold; i++ {
		// Generate a simulated 65-byte signature (r + s + v)
		sig := make([]byte, 65)
		// Fill with deterministic test data
		for j := 0; j < 65; j++ {
			sig[j] = byte((i*65 + j) % 256)
		}
		sig[64] = byte(27 + (i % 2)) // v value (27 or 28)
		signatures[i] = sig
	}
	return signatures, nil
}
