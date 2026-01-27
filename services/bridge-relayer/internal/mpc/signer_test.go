package mpc

import (
	"context"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/config"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
)

func TestNewSignerClient(t *testing.T) {
	cfg := config.MPCConfig{
		SignerEndpoints: []string{"http://signer1:8080", "http://signer2:8080", "http://signer3:8080"},
		Threshold:       2,
		TotalSigners:    3,
		Timeout:         30 * time.Second,
	}

	client := NewSignerClient(cfg)

	if client == nil {
		t.Fatal("expected client to be created")
	}
	if len(client.endpoints) != 3 {
		t.Errorf("expected 3 endpoints, got %d", len(client.endpoints))
	}
	if client.threshold != 2 {
		t.Errorf("expected threshold 2, got %d", client.threshold)
	}
	if client.totalSigners != 3 {
		t.Errorf("expected totalSigners 3, got %d", client.totalSigners)
	}
	if client.timeout != 30*time.Second {
		t.Errorf("expected timeout 30s, got %v", client.timeout)
	}
}

func TestSignerClient_GetThreshold(t *testing.T) {
	cfg := config.MPCConfig{
		SignerEndpoints: []string{"http://signer1:8080"},
		Threshold:       5,
		TotalSigners:    7,
		Timeout:         30 * time.Second,
	}

	client := NewSignerClient(cfg)
	if client.GetThreshold() != 5 {
		t.Errorf("expected threshold 5, got %d", client.GetThreshold())
	}
}

func TestSignerClient_GetTotalSigners(t *testing.T) {
	cfg := config.MPCConfig{
		SignerEndpoints: []string{"http://signer1:8080"},
		Threshold:       5,
		TotalSigners:    7,
		Timeout:         30 * time.Second,
	}

	client := NewSignerClient(cfg)
	if client.GetTotalSigners() != 7 {
		t.Errorf("expected totalSigners 7, got %d", client.GetTotalSigners())
	}
}

func TestSignerClient_GetOnlineSignerCount(t *testing.T) {
	cfg := config.MPCConfig{
		SignerEndpoints: []string{"http://signer1:8080", "http://signer2:8080"},
		Threshold:       2,
		TotalSigners:    2,
		Timeout:         30 * time.Second,
	}

	client := NewSignerClient(cfg)

	// Initially no signers online
	if client.GetOnlineSignerCount() != 0 {
		t.Errorf("expected 0 online signers initially, got %d", client.GetOnlineSignerCount())
	}

	// Manually set signer status
	client.mu.Lock()
	client.signerStatus[0] = true
	client.signerStatus[1] = true
	client.mu.Unlock()

	if client.GetOnlineSignerCount() != 2 {
		t.Errorf("expected 2 online signers, got %d", client.GetOnlineSignerCount())
	}
}

func TestSignerClient_HasQuorum(t *testing.T) {
	cfg := config.MPCConfig{
		SignerEndpoints: []string{"http://signer1:8080", "http://signer2:8080", "http://signer3:8080"},
		Threshold:       2,
		TotalSigners:    3,
		Timeout:         30 * time.Second,
	}

	client := NewSignerClient(cfg)

	// Initially no quorum
	if client.HasQuorum() {
		t.Error("expected no quorum initially")
	}

	// Set 1 signer online (below threshold)
	client.mu.Lock()
	client.signerStatus[0] = true
	client.mu.Unlock()

	if client.HasQuorum() {
		t.Error("expected no quorum with 1 signer")
	}

	// Set 2 signers online (at threshold)
	client.mu.Lock()
	client.signerStatus[1] = true
	client.mu.Unlock()

	if !client.HasQuorum() {
		t.Error("expected quorum with 2 signers (threshold=2)")
	}
}

func TestSignerClient_SimulateSignatures(t *testing.T) {
	cfg := config.MPCConfig{
		SignerEndpoints: []string{"http://signer1:8080", "http://signer2:8080", "http://signer3:8080"},
		Threshold:       2,
		TotalSigners:    3,
		Timeout:         30 * time.Second,
	}

	client := NewSignerClient(cfg)

	msg := domain.BridgeMessage{
		RequestID:   [32]byte{1, 2, 3},
		Sender:      "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:       "0x9876543210fedcba9876543210fedcba98765432",
		Amount:      big.NewInt(1000000),
		SourceChain: 1,
		TargetChain: 137,
		Nonce:       1,
		Deadline:    uint64(time.Now().Add(1 * time.Hour).Unix()),
	}

	signatures, err := client.SimulateSignatures(msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(signatures) != 2 { // Should match threshold
		t.Errorf("expected 2 signatures (threshold), got %d", len(signatures))
	}

	// Verify signature length (65 bytes: r + s + v)
	for i, sig := range signatures {
		if len(sig) != 65 {
			t.Errorf("signature %d: expected 65 bytes, got %d", i, len(sig))
		}
		// Verify v value is 27 or 28
		if sig[64] != 27 && sig[64] != 28 {
			t.Errorf("signature %d: expected v=27 or 28, got %d", i, sig[64])
		}
	}
}

func TestSignerClient_CollectSignatures_Success(t *testing.T) {
	// Create mock servers
	var servers []*httptest.Server
	var endpoints []string

	for i := 0; i < 3; i++ {
		signerID := i
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/sign" {
				// Simulate successful signature
				resp := domain.SignatureResponse{
					SignerID:  signerID,
					Signature: make([]byte, 65),
				}
				resp.Signature[64] = 27 // v value
				json.NewEncoder(w).Encode(resp)
			}
		}))
		servers = append(servers, server)
		endpoints = append(endpoints, server.URL)
	}

	defer func() {
		for _, s := range servers {
			s.Close()
		}
	}()

	cfg := config.MPCConfig{
		SignerEndpoints: endpoints,
		Threshold:       2,
		TotalSigners:    3,
		Timeout:         5 * time.Second,
	}

	client := NewSignerClient(cfg)

	msg := domain.BridgeMessage{
		RequestID:   [32]byte{1, 2, 3},
		Sender:      "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:       "0x9876543210fedcba9876543210fedcba98765432",
		Amount:      big.NewInt(1000000),
		SourceChain: 1,
		TargetChain: 137,
		Nonce:       1,
		Deadline:    uint64(time.Now().Add(1 * time.Hour).Unix()),
	}

	signatures, err := client.CollectSignatures(context.Background(), msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(signatures) != 2 {
		t.Errorf("expected 2 signatures (threshold), got %d", len(signatures))
	}
}

func TestSignerClient_CollectSignatures_InsufficientSignatures(t *testing.T) {
	// Create mock servers - one returns error
	var servers []*httptest.Server
	var endpoints []string

	for i := 0; i < 3; i++ {
		signerID := i
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/sign" {
				if signerID < 1 {
					// Only first signer succeeds
					resp := domain.SignatureResponse{
						SignerID:  signerID,
						Signature: make([]byte, 65),
					}
					json.NewEncoder(w).Encode(resp)
				} else {
					// Others fail
					http.Error(w, "signer unavailable", http.StatusServiceUnavailable)
				}
			}
		}))
		servers = append(servers, server)
		endpoints = append(endpoints, server.URL)
	}

	defer func() {
		for _, s := range servers {
			s.Close()
		}
	}()

	cfg := config.MPCConfig{
		SignerEndpoints: endpoints,
		Threshold:       2, // Need 2 signatures
		TotalSigners:    3,
		Timeout:         5 * time.Second,
	}

	client := NewSignerClient(cfg)

	msg := domain.BridgeMessage{
		RequestID:   [32]byte{1, 2, 3},
		Sender:      "0x1234567890abcdef1234567890abcdef12345678",
		Recipient:   "0xabcdef1234567890abcdef1234567890abcdef12",
		Token:       "0x9876543210fedcba9876543210fedcba98765432",
		Amount:      big.NewInt(1000000),
		SourceChain: 1,
		TargetChain: 137,
		Nonce:       1,
		Deadline:    uint64(time.Now().Add(1 * time.Hour).Unix()),
	}

	_, err := client.CollectSignatures(context.Background(), msg)
	if err == nil {
		t.Error("expected error for insufficient signatures")
	}
}

func TestSignerClient_HealthCheck(t *testing.T) {
	// Create mock servers
	var servers []*httptest.Server
	var endpoints []string

	for i := 0; i < 3; i++ {
		signerID := i
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" {
				if signerID < 2 {
					w.WriteHeader(http.StatusOK)
				} else {
					w.WriteHeader(http.StatusServiceUnavailable)
				}
			}
		}))
		servers = append(servers, server)
		endpoints = append(endpoints, server.URL)
	}

	defer func() {
		for _, s := range servers {
			s.Close()
		}
	}()

	cfg := config.MPCConfig{
		SignerEndpoints: endpoints,
		Threshold:       2,
		TotalSigners:    3,
		Timeout:         5 * time.Second,
	}

	client := NewSignerClient(cfg)

	onlineCount, err := client.HealthCheck(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if onlineCount != 2 {
		t.Errorf("expected 2 online signers, got %d", onlineCount)
	}
}

func TestSignerClient_Concurrency(t *testing.T) {
	cfg := config.MPCConfig{
		SignerEndpoints: []string{"http://signer1:8080", "http://signer2:8080"},
		Threshold:       2,
		TotalSigners:    2,
		Timeout:         30 * time.Second,
	}

	client := NewSignerClient(cfg)

	var wg sync.WaitGroup

	// Concurrent reads and writes
	for i := 0; i < 100; i++ {
		wg.Add(2)

		// Concurrent status updates
		go func(id int) {
			defer wg.Done()
			client.mu.Lock()
			client.signerStatus[id%2] = true
			client.mu.Unlock()
		}(i)

		// Concurrent reads
		go func() {
			defer wg.Done()
			client.GetOnlineSignerCount()
			client.HasQuorum()
		}()
	}

	wg.Wait()
	// If we get here without deadlock, test passes
}
