package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// BodyLimit returns a middleware that limits the request body size
func BodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"error":   "request body too large",
				"message": "Request body exceeds maximum allowed size",
				"maxSize": maxBytes,
			})
			return
		}

		// Wrap the body with a limited reader
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)

		c.Next()
	}
}

// DefaultBodyLimit returns a middleware with default body limit of 1MB
func DefaultBodyLimit() gin.HandlerFunc {
	return BodyLimit(1024 * 1024) // 1MB
}
