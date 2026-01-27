package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stablenet/stable-platform/services/order-router/internal/config"
	"github.com/stablenet/stable-platform/services/order-router/internal/service"
)

func newTestRouter() (*gin.Engine, *RouterHandler) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		Port:            "8087",
		RPCURL:          "http://localhost:8545",
		ChainID:         1,
		UniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
		UniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
		UniswapV3Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
		SushiSwapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
		PriceCacheTTL:   30,
		MaxHops:         3,
		MaxSplits:       5,
		DefaultSlippage: 50,
	}

	svc := service.NewRouterService(cfg)
	handler := NewRouterHandler(svc)

	r := gin.New()
	handler.RegisterRoutes(r)

	return r, handler
}

func TestNewRouterHandler(t *testing.T) {
	cfg := &config.Config{
		Port:            "8087",
		RPCURL:          "http://localhost:8545",
		ChainID:         1,
		UniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
		UniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
		UniswapV3Quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
		SushiSwapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
		PriceCacheTTL:   30,
		MaxHops:         3,
		MaxSplits:       5,
		DefaultSlippage: 50,
	}

	svc := service.NewRouterService(cfg)
	handler := NewRouterHandler(svc)

	if handler == nil {
		t.Fatal("expected handler to be created")
	}
	if handler.service == nil {
		t.Error("expected service to be set")
	}
}

func TestHealth(t *testing.T) {
	r, _ := newTestRouter()

	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if response["status"] != "healthy" {
		t.Errorf("expected status 'healthy', got %s", response["status"])
	}
	if response["service"] != "order-router" {
		t.Errorf("expected service 'order-router', got %s", response["service"])
	}
}

func TestGetQuote_ValidationErrors(t *testing.T) {
	r, _ := newTestRouter()

	tests := []struct {
		name       string
		url        string
		wantStatus int
		wantError  bool
	}{
		{
			name:       "missing all params",
			url:        "/api/v1/quote",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "missing tokenOut",
			url:        "/api/v1/quote?tokenIn=0x1234567890abcdef1234567890abcdef12345678&amountIn=1000000",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "missing tokenIn",
			url:        "/api/v1/quote?tokenOut=0x1234567890abcdef1234567890abcdef12345678&amountIn=1000000",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "missing amountIn",
			url:        "/api/v1/quote?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=0xabcdef1234567890abcdef1234567890abcdef12",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "invalid tokenIn address",
			url:        "/api/v1/quote?tokenIn=invalid&tokenOut=0x1234567890abcdef1234567890abcdef12345678&amountIn=1000000",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "invalid tokenOut address",
			url:        "/api/v1/quote?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=invalid&amountIn=1000000",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "invalid amountIn",
			url:        "/api/v1/quote?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=0xabcdef1234567890abcdef1234567890abcdef12&amountIn=invalid",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "negative amountIn",
			url:        "/api/v1/quote?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=0xabcdef1234567890abcdef1234567890abcdef12&amountIn=-100",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "invalid slippage",
			url:        "/api/v1/quote?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=0xabcdef1234567890abcdef1234567890abcdef12&amountIn=1000000&slippage=20000",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "invalid maxHops too low",
			url:        "/api/v1/quote?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=0xabcdef1234567890abcdef1234567890abcdef12&amountIn=1000000&maxHops=0",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "invalid maxHops too high",
			url:        "/api/v1/quote?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=0xabcdef1234567890abcdef1234567890abcdef12&amountIn=1000000&maxHops=20",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", tt.url, nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d", tt.wantStatus, w.Code)
			}

			if tt.wantError {
				var response map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if _, ok := response["error"]; !ok {
					t.Error("expected error in response")
				}
			}
		})
	}
}

func TestGetSplitQuote_ValidationErrors(t *testing.T) {
	r, _ := newTestRouter()

	tests := []struct {
		name       string
		url        string
		wantStatus int
	}{
		{
			name:       "missing all params",
			url:        "/api/v1/quote/split",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid maxSplits too low",
			url:        "/api/v1/quote/split?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=0xabcdef1234567890abcdef1234567890abcdef12&amountIn=1000000&maxSplits=0",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid maxSplits too high",
			url:        "/api/v1/quote/split?tokenIn=0x1234567890abcdef1234567890abcdef12345678&tokenOut=0xabcdef1234567890abcdef1234567890abcdef12&amountIn=1000000&maxSplits=20",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", tt.url, nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d", tt.wantStatus, w.Code)
			}
		})
	}
}

func TestBuildSwap_ValidationErrors(t *testing.T) {
	r, _ := newTestRouter()

	tests := []struct {
		name       string
		body       SwapRequest
		wantStatus int
	}{
		{
			name:       "empty request",
			body:       SwapRequest{},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "missing tokenIn",
			body: SwapRequest{
				TokenOut:     "0x1234567890abcdef1234567890abcdef12345678",
				AmountIn:     "1000000",
				AmountOutMin: "900000",
				Recipient:    "0xabcdef1234567890abcdef1234567890abcdef12",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "missing tokenOut",
			body: SwapRequest{
				TokenIn:      "0x1234567890abcdef1234567890abcdef12345678",
				AmountIn:     "1000000",
				AmountOutMin: "900000",
				Recipient:    "0xabcdef1234567890abcdef1234567890abcdef12",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "missing recipient",
			body: SwapRequest{
				TokenIn:      "0x1234567890abcdef1234567890abcdef12345678",
				TokenOut:     "0xabcdef1234567890abcdef1234567890abcdef12",
				AmountIn:     "1000000",
				AmountOutMin: "900000",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "invalid tokenIn",
			body: SwapRequest{
				TokenIn:      "invalid",
				TokenOut:     "0xabcdef1234567890abcdef1234567890abcdef12",
				AmountIn:     "1000000",
				AmountOutMin: "900000",
				Recipient:    "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "invalid amountIn",
			body: SwapRequest{
				TokenIn:      "0x1234567890abcdef1234567890abcdef12345678",
				TokenOut:     "0xabcdef1234567890abcdef1234567890abcdef12",
				AmountIn:     "invalid",
				AmountOutMin: "900000",
				Recipient:    "0x9876543210fedcba9876543210fedcba98765432",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "invalid slippage",
			body: SwapRequest{
				TokenIn:      "0x1234567890abcdef1234567890abcdef12345678",
				TokenOut:     "0xabcdef1234567890abcdef1234567890abcdef12",
				AmountIn:     "1000000",
				AmountOutMin: "900000",
				Recipient:    "0x9876543210fedcba9876543210fedcba98765432",
				Slippage:     20000, // > 10000 is invalid
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.body)
			req, _ := http.NewRequest("POST", "/api/v1/swap", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d", tt.wantStatus, w.Code)
			}
		})
	}
}

func TestBuildSwap_InvalidJSON(t *testing.T) {
	r, _ := newTestRouter()

	req, _ := http.NewRequest("POST", "/api/v1/swap", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestGetProtocols(t *testing.T) {
	r, _ := newTestRouter()

	req, _ := http.NewRequest("GET", "/api/v1/protocols", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var response map[string][]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	protocols, ok := response["protocols"]
	if !ok {
		t.Fatal("expected protocols in response")
	}

	if len(protocols) < 3 {
		t.Errorf("expected at least 3 protocols, got %d", len(protocols))
	}

	// Check for expected protocols
	protocolMap := make(map[string]bool)
	for _, p := range protocols {
		protocolMap[p] = true
	}

	expectedProtocols := []string{"uniswap_v3", "uniswap_v2", "sushiswap"}
	for _, expected := range expectedProtocols {
		if !protocolMap[expected] {
			t.Errorf("expected protocol %s in response", expected)
		}
	}
}

func TestRouteRegistration(t *testing.T) {
	r, _ := newTestRouter()

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/health"},
		{"GET", "/api/v1/quote"},
		{"GET", "/api/v1/quote/split"},
		{"POST", "/api/v1/swap"},
		{"GET", "/api/v1/protocols"},
	}

	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			var req *http.Request
			if route.method == "POST" {
				req, _ = http.NewRequest(route.method, route.path, bytes.NewBufferString("{}"))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req, _ = http.NewRequest(route.method, route.path, nil)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			// Should not be 404
			if w.Code == http.StatusNotFound {
				t.Errorf("route %s %s not found", route.method, route.path)
			}
		})
	}
}
