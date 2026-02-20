// Package logger provides structured logging for the onramp-simulator service.
package logger

import (
	"log/slog"

	sharedlogger "github.com/stable-net/shared/logger"
)

// Config is the logger configuration
type Config = sharedlogger.Config

// Logger wraps shared Logger with onramp-simulator specific methods
type Logger struct {
	*sharedlogger.Logger
}

// Re-export shared global functions
var (
	Init    = sharedlogger.Init
	Default = sharedlogger.Default
	Debug   = sharedlogger.Debug
	Info    = sharedlogger.Info
	Warn    = sharedlogger.Warn
	Error   = sharedlogger.Error
)

// DefaultConfig returns onramp-simulator specific default configuration
func DefaultConfig() Config {
	return sharedlogger.DefaultConfigWithName("onramp-simulator")
}

// New creates a new logger (compatible with existing call sites)
func New(cfg Config) *Logger {
	return &Logger{Logger: sharedlogger.New(cfg)}
}

// NewDefault creates a logger with default configuration
func NewDefault() *Logger {
	return New(DefaultConfig())
}

// With creates a child logger with additional attributes
func (l *Logger) With(args ...any) *Logger {
	return &Logger{Logger: l.Logger.With(args...)}
}

// WithOrder adds order context for onramp operations
func (l *Logger) WithOrder(orderID string) *Logger {
	return &Logger{Logger: l.Logger.With(slog.String("orderID", orderID))}
}
