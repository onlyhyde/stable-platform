package model

import "time"

// IdempotencyRecord represents a cached API response for idempotency
type IdempotencyRecord struct {
	Key             string            `json:"key" db:"key"`
	Method          string            `json:"method" db:"method"`
	Path            string            `json:"path" db:"path"`
	StatusCode      int               `json:"statusCode" db:"status_code"`
	ResponseBody    []byte            `json:"responseBody" db:"response_body"`
	ResponseHeaders map[string]string `json:"responseHeaders" db:"response_headers"`
	CreatedAt       time.Time         `json:"createdAt" db:"created_at"`
	ExpiresAt       time.Time         `json:"expiresAt" db:"expires_at"`
}
