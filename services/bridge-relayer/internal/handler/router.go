package handler

import (
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/domain"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/executor"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/fraud"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/guardian"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/monitor"
	"github.com/stablenet/stable-platform/services/bridge-relayer/internal/mpc"
)

// Handler handles HTTP requests
type Handler struct {
	executor        *executor.BridgeExecutor
	monitor         *monitor.EventMonitor
	fraudMonitor    *fraud.FraudMonitor
	guardianMonitor *guardian.GuardianMonitor
	mpcClient       *mpc.SignerClient
	startTime       time.Time
}

// NewHandler creates a new HTTP handler
func NewHandler(
	exec *executor.BridgeExecutor,
	mon *monitor.EventMonitor,
	fraudMon *fraud.FraudMonitor,
	guardianMon *guardian.GuardianMonitor,
	mpc *mpc.SignerClient,
) *Handler {
	return &Handler{
		executor:        exec,
		monitor:         mon,
		fraudMonitor:    fraudMon,
		guardianMonitor: guardianMon,
		mpcClient:       mpc,
		startTime:       time.Now(),
	}
}

// RegisterRoutes registers all HTTP routes
func (h *Handler) RegisterRoutes(r *gin.Engine) {
	// Health and status endpoints (Kubernetes probes compatible)
	r.GET("/health", h.HealthCheck)
	r.GET("/ready", h.ReadyCheck)
	r.GET("/live", h.LiveCheck)
	r.GET("/status", h.GetStatus)
	r.GET("/metrics", h.GetMetrics)

	// API v1 group
	api := r.Group("/api/v1")
	{
		// Bridge operations
		api.GET("/requests", h.GetPendingRequests)
		api.GET("/requests/:id", h.GetRequest)

		// Statistics
		api.GET("/stats", h.GetStats)

		// Admin operations
		admin := api.Group("/admin")
		{
			admin.POST("/pause", h.Pause)
			admin.POST("/resume", h.Resume)
		}

		// MPC status
		api.GET("/mpc/status", h.GetMPCStatus)

		// Guardian status
		api.GET("/guardian/status", h.GetGuardianStatus)
		api.GET("/guardian/proposals", h.GetActiveProposals)

		// Fraud monitoring
		api.GET("/fraud/alerts", h.GetFraudAlerts)
		api.GET("/fraud/proofs", h.GetFraudProofs)
	}
}

// HealthCheck handles health check requests
func (h *Handler) HealthCheck(c *gin.Context) {
	isPaused := h.executor.IsPaused() || h.guardianMonitor.IsPaused()

	status := "ok"
	if isPaused {
		status = "paused"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    status,
		"service":   "bridge-relayer",
		"version":   "1.0.0",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"uptime":    time.Since(h.startTime).String(),
	})
}

// ReadyCheck handles readiness probe requests
func (h *Handler) ReadyCheck(c *gin.Context) {
	// Service is ready if it has MPC quorum and is not paused by guardian
	hasQuorum := h.mpcClient.HasQuorum()
	isPaused := h.guardianMonitor.IsPaused()

	ready := hasQuorum && !isPaused

	statusCode := http.StatusOK
	if !ready {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, gin.H{
		"ready":     ready,
		"service":   "bridge-relayer",
		"hasQuorum": hasQuorum,
		"isPaused":  isPaused,
	})
}

// LiveCheck handles liveness probe requests
func (h *Handler) LiveCheck(c *gin.Context) {
	// Service is alive if it can respond
	c.JSON(http.StatusOK, gin.H{
		"alive":   true,
		"service": "bridge-relayer",
	})
}

// GetStatus returns detailed status information
func (h *Handler) GetStatus(c *gin.Context) {
	onlineSigners, _ := h.mpcClient.HealthCheck(c.Request.Context())
	isPaused, pauseReason, pausedAt, pausedBy := h.guardianMonitor.GetPauseInfo()

	status := domain.RelayerStatus{
		IsHealthy:          !isPaused && h.mpcClient.HasQuorum(),
		IsPaused:           isPaused || h.executor.IsPaused(),
		SourceChainSynced:  true, // Would check actual sync status
		TargetChainSynced:  true,
		LastProcessedBlock: h.monitor.GetLastProcessedBlock(),
		PendingRequests:    h.executor.GetPendingRequestCount(),
		ProcessedRequests:  h.executor.GetProcessedCount(),
		FailedRequests:     h.executor.GetFailedCount(),
		MPCSignersOnline:   onlineSigners,
		LastUpdated:        time.Now(),
	}

	response := gin.H{
		"status": status,
	}

	if isPaused {
		response["pauseInfo"] = gin.H{
			"reason":   pauseReason,
			"pausedAt": pausedAt,
			"pausedBy": pausedBy,
		}
	}

	c.JSON(http.StatusOK, response)
}

// GetMetrics returns Prometheus-compatible metrics
func (h *Handler) GetMetrics(c *gin.Context) {
	metrics := []string{
		"# HELP bridge_relayer_pending_requests Number of pending bridge requests",
		"# TYPE bridge_relayer_pending_requests gauge",
		formatMetric("bridge_relayer_pending_requests", h.executor.GetPendingRequestCount()),

		"# HELP bridge_relayer_processed_requests Total processed bridge requests",
		"# TYPE bridge_relayer_processed_requests counter",
		formatMetric("bridge_relayer_processed_requests", h.executor.GetProcessedCount()),

		"# HELP bridge_relayer_failed_requests Total failed bridge requests",
		"# TYPE bridge_relayer_failed_requests counter",
		formatMetric("bridge_relayer_failed_requests", h.executor.GetFailedCount()),

		"# HELP bridge_relayer_mpc_signers_online Number of online MPC signers",
		"# TYPE bridge_relayer_mpc_signers_online gauge",
		formatMetric("bridge_relayer_mpc_signers_online", h.mpcClient.GetOnlineSignerCount()),

		"# HELP bridge_relayer_last_processed_block Last processed block number",
		"# TYPE bridge_relayer_last_processed_block gauge",
		formatMetric("bridge_relayer_last_processed_block", int(h.monitor.GetLastProcessedBlock())),

		"# HELP bridge_relayer_uptime_seconds Relayer uptime in seconds",
		"# TYPE bridge_relayer_uptime_seconds gauge",
		formatMetric("bridge_relayer_uptime_seconds", int(time.Since(h.startTime).Seconds())),
	}

	c.String(http.StatusOK, joinMetrics(metrics))
}

// GetPendingRequests returns all pending bridge requests
func (h *Handler) GetPendingRequests(c *gin.Context) {
	requests := h.executor.GetPendingRequests()

	// Convert to response format
	response := make([]gin.H, len(requests))
	for i, req := range requests {
		response[i] = formatBridgeRequest(req)
	}

	c.JSON(http.StatusOK, gin.H{
		"count":    len(requests),
		"requests": response,
	})
}

// GetRequest returns a specific bridge request
func (h *Handler) GetRequest(c *gin.Context) {
	idHex := c.Param("id")

	// Parse request ID
	idBytes, err := hex.DecodeString(stripHexPrefix(idHex))
	if err != nil || len(idBytes) != 32 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request ID"})
		return
	}

	var requestID [32]byte
	copy(requestID[:], idBytes)

	req, exists := h.executor.GetRequest(requestID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
		return
	}

	c.JSON(http.StatusOK, formatBridgeRequest(req))
}

// GetStats returns statistics
func (h *Handler) GetStats(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"pendingRequests":   h.executor.GetPendingRequestCount(),
		"processedRequests": h.executor.GetProcessedCount(),
		"failedRequests":    h.executor.GetFailedCount(),
		"lastProcessedBlock": h.monitor.GetLastProcessedBlock(),
		"mpcSignersOnline":  h.mpcClient.GetOnlineSignerCount(),
		"mpcThreshold":      h.mpcClient.GetThreshold(),
		"mpcTotalSigners":   h.mpcClient.GetTotalSigners(),
		"hasQuorum":         h.mpcClient.HasQuorum(),
		"uptime":            time.Since(h.startTime).String(),
	})
}

// Pause pauses the relayer
func (h *Handler) Pause(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Reason = "manual pause"
	}

	h.executor.Pause()
	h.monitor.Pause()

	c.JSON(http.StatusOK, gin.H{
		"status":  "paused",
		"reason":  req.Reason,
		"message": "Bridge relayer paused successfully",
	})
}

// Resume resumes the relayer
func (h *Handler) Resume(c *gin.Context) {
	// Check if guardian has paused the bridge
	if h.guardianMonitor.IsPaused() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Cannot resume: bridge is paused by guardian",
		})
		return
	}

	h.executor.Resume()
	h.monitor.Resume()

	c.JSON(http.StatusOK, gin.H{
		"status":  "running",
		"message": "Bridge relayer resumed successfully",
	})
}

// GetMPCStatus returns MPC signer status
func (h *Handler) GetMPCStatus(c *gin.Context) {
	onlineCount, _ := h.mpcClient.HealthCheck(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"onlineSigners": onlineCount,
		"totalSigners":  h.mpcClient.GetTotalSigners(),
		"threshold":     h.mpcClient.GetThreshold(),
		"hasQuorum":     h.mpcClient.HasQuorum(),
	})
}

// GetGuardianStatus returns guardian status
func (h *Handler) GetGuardianStatus(c *gin.Context) {
	isPaused, reason, pausedAt, pausedBy := h.guardianMonitor.GetPauseInfo()

	response := gin.H{
		"isPaused": isPaused,
	}

	if isPaused {
		response["reason"] = reason
		response["pausedAt"] = pausedAt
		response["pausedBy"] = pausedBy
	}

	c.JSON(http.StatusOK, response)
}

// GetActiveProposals returns active guardian proposals
func (h *Handler) GetActiveProposals(c *gin.Context) {
	proposals := h.guardianMonitor.GetActiveProposals()

	response := make([]gin.H, len(proposals))
	for i, p := range proposals {
		response[i] = gin.H{
			"id":            p.ID,
			"proposalType":  p.ProposalType,
			"proposer":      p.Proposer,
			"target":        p.Target,
			"approvalCount": p.ApprovalCount,
			"createdAt":     p.CreatedAt,
			"expiresAt":     p.ExpiresAt,
			"status":        p.Status,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"count":     len(proposals),
		"proposals": response,
	})
}

// GetFraudAlerts returns recent fraud alerts
func (h *Handler) GetFraudAlerts(c *gin.Context) {
	// Get alerts from channel (non-blocking)
	alerts := []fraud.FraudAlert{}
	for {
		select {
		case alert := <-h.fraudMonitor.GetAlertChannel():
			alerts = append(alerts, alert)
		default:
			goto done
		}
	}
done:

	c.JSON(http.StatusOK, gin.H{
		"count":  len(alerts),
		"alerts": alerts,
	})
}

// GetFraudProofs returns fraud proof records
func (h *Handler) GetFraudProofs(c *gin.Context) {
	records := h.fraudMonitor.GetProofRecords()

	response := make([]gin.H, len(records))
	for i, r := range records {
		response[i] = gin.H{
			"submitter":   r.Submitter,
			"proofType":   r.ProofType.String(),
			"proofHash":   hex.EncodeToString(r.ProofHash[:]),
			"submittedAt": r.SubmittedAt,
			"verified":    r.Verified,
			"isValid":     r.IsValid,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"count":  len(records),
		"proofs": response,
	})
}

// Helper functions

func formatBridgeRequest(req *domain.BridgeRequest) gin.H {
	return gin.H{
		"requestId":   hex.EncodeToString(req.RequestID[:]),
		"sender":      req.Sender,
		"recipient":   req.Recipient,
		"token":       req.Token,
		"amount":      req.Amount.String(),
		"sourceChain": req.SourceChain,
		"targetChain": req.TargetChain,
		"nonce":       req.Nonce,
		"deadline":    req.Deadline,
		"status":      req.Status.String(),
		"initiatedAt": req.InitiatedAt,
		"txHash":      req.TxHash,
	}
}

func formatMetric(name string, value int) string {
	return name + " " + intToString(value)
}

func intToString(i int) string {
	return string(rune('0'+i%10)) + func() string {
		if i < 10 {
			return ""
		}
		return intToString(i / 10)
	}()
}

func joinMetrics(metrics []string) string {
	result := ""
	for _, m := range metrics {
		result += m + "\n"
	}
	return result
}

func stripHexPrefix(s string) string {
	if len(s) >= 2 && s[0] == '0' && (s[1] == 'x' || s[1] == 'X') {
		return s[2:]
	}
	return s
}
