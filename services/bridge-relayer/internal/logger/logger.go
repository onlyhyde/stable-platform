// Package logger provides structured logging for the bridge-relayer service.
package logger

import (
	"log/slog"

	sharedlogger "github.com/stable-net/shared/logger"
)

// Config is the logger configuration
type Config = sharedlogger.Config

// Logger wraps shared Logger with bridge-relayer specific methods
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

// DefaultConfig returns bridge-relayer specific default configuration
func DefaultConfig() Config {
	return sharedlogger.DefaultConfigWithName("bridge-relayer")
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

// WithBridgeTransfer adds bridge transfer context
func (l *Logger) WithBridgeTransfer(transferID string) *Logger {
	return &Logger{Logger: l.Logger.With(slog.String("bridgeTransferID", transferID))}
}

// WithChains adds source and destination chain context
func (l *Logger) WithChains(sourceChain, destChain uint64) *Logger {
	return &Logger{Logger: l.Logger.With(
		slog.Uint64("sourceChain", sourceChain),
		slog.Uint64("destChain", destChain),
	)}
}

// WithTxHash adds transaction hash context
func (l *Logger) WithTxHash(txHash string) *Logger {
	return &Logger{Logger: l.Logger.With(slog.String("txHash", txHash))}
}
